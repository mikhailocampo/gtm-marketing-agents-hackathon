/**
 * SessionDO — one instance per session (sid).
 * Houses SQLite journal of research parts + calendar events, serves as the
 * coupling surface between research and calendar streams.
 *
 * Skeleton only: Lane A fills `handleChat` and `getResearchReplay`; Lane B
 * fills `startCalendar` and `subscribeCalendar`.
 */

import { DurableObject } from "cloudflare:workers";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import type { UIMessage } from "ai";
import type {
  CampaignPlan,
  ChannelId,
  ResearchOutput,
  SessionState,
  SessionStatus,
  Social,
  SpotlightPayload,
} from "./types";
import type { SerializedPart } from "./serialized-parts";
import { serializeStepContent, buildUIMessages } from "./serialized-parts";
import { encodeSse, SSE_HEARTBEAT, type CalendarEvent } from "./events";
import {
  getGoogle,
  MODEL_IDS,
  ORCHESTRATOR_PROVIDER_OPTIONS,
  RESEARCH_PROVIDER_OPTIONS,
} from "./llm/google";
import {
  ORCHESTRATOR_SYSTEM_PROMPT,
  buildOrchestratorUserMessage,
} from "./orchestrator/prompts";
import { createOrchestratorTools } from "./orchestrator/tools";
import { createResearchTools } from "./research/tools";
import {
  RESEARCH_SYSTEM_PROMPT,
  buildSeedUserMessage,
} from "./research/prompts";

export type Env = {
  SESSION_DO: DurableObjectNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  APIFY_TOKEN?: string;
  APIFY_API_KEY?: string;
  R2_PUBLIC_URL?: string;
};

export class SessionDO extends DurableObject<Env> {
  #subscribers = new Set<WritableStreamDefaultWriter<Uint8Array>>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.blockConcurrencyWhile(async () => {
      const sql = ctx.storage.sql;
      sql.exec(`
        CREATE TABLE IF NOT EXISTS session (
          sid TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          updated_at INTEGER
        );
      `);
      sql.exec(`
        CREATE TABLE IF NOT EXISTS research_journal (
          idx INTEGER PRIMARY KEY AUTOINCREMENT,
          part TEXT NOT NULL
        );
      `);
      sql.exec(`
        CREATE TABLE IF NOT EXISTS calendar_journal (
          idx INTEGER PRIMARY KEY AUTOINCREMENT,
          event TEXT NOT NULL
        );
      `);
    });
  }

  async createSession(
    sid: string,
    input: { websiteUrl: string; socials: Social[] },
  ): Promise<void> {
    const state: SessionState = {
      sid,
      websiteUrl: input.websiteUrl,
      socials: input.socials,
      status: "researching",
      posts: [],
      startedAt: Date.now(),
    };
    this.ctx.storage.sql.exec(
      "INSERT OR REPLACE INTO session (sid, state, updated_at) VALUES (?, ?, ?);",
      sid,
      JSON.stringify(state),
      Date.now(),
    );
  }

  async getSessionState(): Promise<SessionState | null> {
    const row = this.ctx.storage.sql
      .exec<{ state: string }>("SELECT state FROM session LIMIT 1;")
      .toArray()[0];
    return row ? (JSON.parse(row.state) as SessionState) : null;
  }

  async updateSessionState(
    patch: Partial<SessionState>,
  ): Promise<SessionState | null> {
    const current = await this.getSessionState();
    if (!current) return null;
    const next: SessionState = { ...current, ...patch };
    this.ctx.storage.sql.exec(
      "UPDATE session SET state = ?, updated_at = ? WHERE sid = ?;",
      JSON.stringify(next),
      Date.now(),
      next.sid,
    );
    return next;
  }

  async appendResearchParts(parts: SerializedPart[]): Promise<void> {
    for (const part of parts) {
      this.ctx.storage.sql.exec(
        "INSERT INTO research_journal (part) VALUES (?);",
        JSON.stringify(part),
      );
    }
  }

  async readResearchJournal(): Promise<SerializedPart[]> {
    const rows = this.ctx.storage.sql
      .exec<{ part: string }>(
        "SELECT part FROM research_journal ORDER BY idx ASC;",
      )
      .toArray();
    return rows.map((r) => JSON.parse(r.part) as SerializedPart);
  }

  async appendCalendarEvent(event: CalendarEvent): Promise<void> {
    this.ctx.storage.sql.exec(
      "INSERT INTO calendar_journal (event) VALUES (?);",
      JSON.stringify(event),
    );
  }

  async readCalendarJournal(): Promise<CalendarEvent[]> {
    const rows = this.ctx.storage.sql
      .exec<{ event: string }>(
        "SELECT event FROM calendar_journal ORDER BY idx ASC;",
      )
      .toArray();
    return rows.map((r) => JSON.parse(r.event) as CalendarEvent);
  }

  // ─────────────── Lane A: research chat ───────────────

  async handleChat(request: Request): Promise<Response> {
    const state = await this.getSessionState();
    if (!state) {
      return new Response(JSON.stringify({ error: "session_not_found" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const body = (await request.json()) as { messages: UIMessage[] };
    const incoming = body.messages ?? [];

    // Auto-seed: if this is the first POST and the user hasn't typed anything,
    // synthesize the seed message from the stored websiteUrl + socials.
    let messages = incoming;
    if (incoming.length === 0) {
      const seedText = buildSeedUserMessage({
        websiteUrl: state.websiteUrl,
        socials: state.socials,
      });
      messages = [
        {
          id: "seed",
          role: "user",
          parts: [{ type: "text", text: seedText }],
        } as UIMessage,
      ];
    }

    const google = getGoogle(this.env);
    const brandContext = `${state.websiteUrl}`;
    const sid = state.sid;

    const tools = createResearchTools({
      env: this.env,
      sid,
      brandContext,
      onFinalize: async (output) => {
        await this.updateSessionState({
          research: output,
          status: "ready_to_confirm",
        });
        console.log(
          `[research:${sid.slice(0, 6)}] finalized; status=ready_to_confirm`,
        );
      },
    });

    const result = streamText({
      model: google(MODEL_IDS.RESEARCH),
      system: RESEARCH_SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools,
      stopWhen: stepCountIs(25),
      providerOptions: RESEARCH_PROVIDER_OPTIONS,
      onFinish: async ({ steps }) => {
        const parts = serializeStepContent(steps as never);
        if (parts.length > 0) {
          await this.appendResearchParts(parts);
        }
      },
    });

    return result.toUIMessageStreamResponse({
      headers: { "X-Session-Id": sid },
    });
  }

  async getResearchReplay(): Promise<{
    researchOutput?: ResearchOutput;
    journal: SerializedPart[];
    uiMessages: UIMessage[];
  }> {
    const state = await this.getSessionState();
    const journal = await this.readResearchJournal();
    // Wrap the entire journal as one synthetic assistant message so that
    // buildUIMessages can rehydrate the reasoning + tool-call + result parts.
    const uiMessages = buildUIMessages([
      {
        id: "journal",
        role: "assistant",
        content: "",
        metadata: { structured_parts: journal },
      },
    ]);
    return { researchOutput: state?.research, journal, uiMessages };
  }

  // ─────────────── Lane B: calendar orchestrator ───────────────

  async startCalendar(selectedChannels: ChannelId[]): Promise<void> {
    const state = await this.getSessionState();
    if (!state) {
      console.warn("[calendar] startCalendar: no session state");
      return;
    }
    if (!state.research) {
      await this.updateSessionState({
        status: "error",
        error: "Cannot start calendar: research not complete",
      });
      return;
    }
    await this.updateSessionState({
      status: "generating",
      plan: { ...(state.plan ?? {}), selectedChannels },
    });
    const sidTag = `[calendar:${state.sid.slice(0, 6)}]`;
    console.log(`${sidTag} startCalendar channels=${selectedChannels.join(",")}`);
    this.ctx.waitUntil(
      this.#runOrchestrator(state.sid, state.research, selectedChannels).catch(
        async (err) => {
          console.error(`${sidTag} orchestrator failed`, err);
          const message = err instanceof Error ? err.message : String(err);
          await this.updateSessionState({ status: "error", error: message });
          await this.emitSse({
            type: "error",
            message,
            ts: Date.now(),
          });
        },
      ),
    );
  }

  async #runOrchestrator(
    sid: string,
    research: ResearchOutput,
    selectedChannels: ChannelId[],
  ): Promise<void> {
    const [start, end] = dateWindow(30);
    const google = getGoogle(this.env);

    const tools = createOrchestratorTools(this.env, {
      sid,
      do: {
        emitSse: (event) => this.emitSse(event),
        setSpotlight: (s) => this.setSpotlight(s),
        setStatus: (status) => this.setStatus(status),
      },
      dateWindow: [start, end],
    });

    const result = streamText({
      model: google(MODEL_IDS.ORCHESTRATOR),
      system: ORCHESTRATOR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildOrchestratorUserMessage({
            research,
            selectedChannels,
            dateWindow: [start, end],
          }),
        },
      ],
      tools,
      stopWhen: stepCountIs(30),
      providerOptions: ORCHESTRATOR_PROVIDER_OPTIONS,
    });

    await result.consumeStream();
  }

  async emitSse(event: CalendarEvent): Promise<void> {
    await this.appendCalendarEvent(event);
    const chunk = new TextEncoder().encode(encodeSse(event));
    const writers = Array.from(this.#subscribers);
    const results = await Promise.allSettled(
      writers.map((w) => w.write(chunk)),
    );
    results.forEach((r, i) => {
      if (r.status === "rejected") this.#subscribers.delete(writers[i]);
    });
  }

  async setSpotlight(ref: {
    date: string;
    channel: ChannelId;
    payload: SpotlightPayload;
  }): Promise<void> {
    const state = await this.getSessionState();
    if (!state) return;
    const plan: CampaignPlan = {
      selectedChannels: state.plan?.selectedChannels ?? [],
      spotlightRef: { date: ref.date, channel: ref.channel, payload: ref.payload },
    };
    await this.updateSessionState({ plan });
  }

  async setStatus(status: SessionStatus): Promise<void> {
    await this.updateSessionState({ status });
  }

  async subscribeCalendar(request: Request): Promise<Response> {
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Replay journal first so reconnecting clients see prior events before live ones.
    const journal = await this.readCalendarJournal();
    if (journal.length > 0) {
      await writer.write(
        encoder.encode(journal.map(encodeSse).join("")),
      );
    }

    this.#subscribers.add(writer);

    const heartbeat = setInterval(() => {
      writer.write(encoder.encode(SSE_HEARTBEAT)).catch(() => {
        clearInterval(heartbeat);
      });
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      this.#subscribers.delete(writer);
      writer.close().catch(() => {});
    };
    request.signal.addEventListener("abort", cleanup);

    // If calendar already completed before this subscriber arrived, close after replay.
    const state = await this.getSessionState();
    if (state?.status === "done" || state?.status === "error") {
      // Keep writer open briefly so the client can read replay; then close.
      setTimeout(cleanup, 100);
    }

    return new Response(readable, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache, no-transform",
        "connection": "keep-alive",
      },
    });
  }

  async getPlan(): Promise<CampaignPlan | null> {
    const state = await this.getSessionState();
    return state?.plan ?? null;
  }
}

function dateWindow(days: number): [string, string] {
  const now = Date.now();
  const DAY = 86400000;
  const start = new Date(now + DAY).toISOString().slice(0, 10);
  const end = new Date(now + days * DAY).toISOString().slice(0, 10);
  return [start, end];
}

export default SessionDO;
