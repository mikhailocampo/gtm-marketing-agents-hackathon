/**
 * SessionDO — one instance per session (sid).
 * Houses SQLite journal of research parts + calendar events, serves as the
 * coupling surface between research and calendar streams.
 *
 * Skeleton only: Lane A fills `handleChat` and `getResearchReplay`; Lane B
 * fills `startCalendar` and `subscribeCalendar`.
 */

import { DurableObject } from "cloudflare:workers";
import type {
  CampaignPlan,
  ChannelId,
  ResearchOutput,
  SessionState,
  Social,
} from "./types";
import type { SerializedPart } from "./serialized-parts";
import type { CalendarEvent } from "./events";

type Env = {
  SESSION_DO: DurableObjectNamespace;
  IMAGES: R2Bucket;
  ASSETS: Fetcher;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  APIFY_TOKEN?: string;
  DEMO_FALLBACK?: string;
  R2_PUBLIC_URL?: string;
};

export class SessionDO extends DurableObject<Env> {
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

  async handleChat(_request: Request): Promise<Response> {
    return new Response("not implemented", { status: 501 });
  }

  async getResearchReplay(): Promise<{
    researchOutput?: ResearchOutput;
    journal: SerializedPart[];
  }> {
    const state = await this.getSessionState();
    const journal = await this.readResearchJournal();
    return { researchOutput: state?.research, journal };
  }

  // ─────────────── Lane B: calendar orchestrator ───────────────

  async startCalendar(_selectedChannels: ChannelId[]): Promise<void> {
    // Lane B fills this in.
  }

  async subscribeCalendar(_request: Request): Promise<Response> {
    return new Response("not implemented", { status: 501 });
  }

  async getPlan(): Promise<CampaignPlan | null> {
    const state = await this.getSessionState();
    return state?.plan ?? null;
  }
}

export default SessionDO;
