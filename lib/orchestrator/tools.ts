import { tool } from "ai";
import { z } from "zod";
import {
  ChannelIdSchema,
  type ChannelId,
  type PostVariant,
  type SpotlightPayload,
} from "../types";
import { toolError } from "../errors";
import type { CalendarEvent } from "../events";
import { generatePost } from "../generation/post";
import { validateSpotlight } from "../generation/spotlight";

type Env = {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  IMAGES: R2Bucket;
  R2_PUBLIC_URL?: string;
};

// Structural DO interface — avoids an import cycle with lib/session-do.ts.
export interface OrchestratorDo {
  emitSse(event: CalendarEvent): Promise<void>;
  setSpotlight(payload: {
    date: string;
    channel: ChannelId;
    payload: SpotlightPayload;
  }): Promise<void>;
  setStatus(status: "generating" | "done" | "error"): Promise<void>;
}

export type OrchestratorCtx = {
  sid: string;
  do: OrchestratorDo;
  dateWindow: [string, string]; // [startISO, endISO] inclusive
};

function isoInWindow(d: string, [a, b]: [string, string]) {
  return d >= a && d <= b;
}

export function createOrchestratorTools(env: Env, ctx: OrchestratorCtx) {
  const sidTag = `[calendar:${ctx.sid.slice(0, 6)}]`;

  return {
    plan_week: tool({
      description:
        "Announce the posts you intend to generate for one week. Triggers shimmer placeholders in the UI. Must be called before generate_post for that week.",
      inputSchema: z.object({
        weekNumber: z.number().int().min(1).max(4),
        slots: z
          .array(
            z.object({
              date: z.string(),
              channel: ChannelIdSchema,
              themeHint: z.string(),
            }),
          )
          .min(1)
          .max(12),
      }),
      execute: async ({ weekNumber, slots }) => {
        const outOfWindow = slots.filter(
          (s) => !isoInWindow(s.date, ctx.dateWindow),
        );
        if (outOfWindow.length > 0) {
          return toolError({
            code: "invalid_input",
            message: `Slots outside date window ${ctx.dateWindow[0]}..${ctx.dateWindow[1]}: ${outOfWindow
              .map((s) => s.date)
              .join(", ")}`,
            recoverable: true,
            retry_safe: true,
          });
        }
        console.log(`${sidTag} plan_week ${weekNumber}: ${slots.length} slots`);
        const ts = Date.now();
        for (const slot of slots) {
          await ctx.do.emitSse({
            type: "shimmer",
            date: slot.date,
            channel: slot.channel,
            ts,
          });
        }
        return { ok: true, plannedSlots: slots.length };
      },
    }),

    generate_post: tool({
      description:
        "Generate one post (copy + image) for a planned slot. Call this for every slot after plan_week. Runs in parallel up to 3 at a time.",
      inputSchema: z.object({
        date: z.string(),
        channel: ChannelIdSchema,
        prompt: z.string().min(1),
        reuseOf: z
          .object({
            kind: z.enum(["own", "competitor"]),
            postUrl: z.string().url(),
            hookText: z.string(),
          })
          .optional(),
        trendSignal: z.string().optional(),
        modality: z.enum(["image", "video", "text"]).default("image"),
      }),
      execute: async (input) => {
        if (!isoInWindow(input.date, ctx.dateWindow)) {
          return toolError({
            code: "invalid_input",
            message: `Date ${input.date} outside window ${ctx.dateWindow[0]}..${ctx.dateWindow[1]}`,
            recoverable: true,
            retry_safe: true,
          });
        }
        console.log(
          `${sidTag} generate_post ${input.date} ${input.channel} modality=${input.modality}`,
        );
        const post: PostVariant = await generatePost(env, input, {
          sid: ctx.sid,
        });
        await ctx.do.emitSse({ type: "post", post, ts: Date.now() });
        return post;
      },
    }),

    pick_spotlight: tool({
      description:
        "After all weeks are generated, pick the single most demo-worthy post and explain why. Call exactly once at the end.",
      inputSchema: z.object({
        date: z.string(),
        channel: ChannelIdSchema,
        rationale: z.object({
          sentence: z.string().min(1),
          highlights: z.array(
            z.object({ phrase: z.string(), chipId: z.string() }),
          ),
        }),
        evidenceChips: z
          .array(
            z.object({
              id: z.string(),
              kind: z.enum(["own-post", "competitor", "trend"]),
              label: z.string(),
              url: z.string().url().optional(),
              thumbnail: z.string().url().optional(),
            }),
          )
          .min(2)
          .max(3),
      }),
      execute: async (payload) => {
        const validation = validateSpotlight({
          rationale: payload.rationale,
          evidenceChips: payload.evidenceChips,
        });
        if (!validation.ok) {
          return toolError({
            code: "invalid_input",
            message: `rationale.highlights reference chipIds not in evidenceChips: ${validation.missing.join(", ")}`,
            recoverable: true,
            retry_safe: true,
          });
        }
        console.log(`${sidTag} pick_spotlight ${payload.date} ${payload.channel}`);
        await ctx.do.setSpotlight({
          date: payload.date,
          channel: payload.channel,
          payload: {
            rationale: payload.rationale,
            evidenceChips: payload.evidenceChips,
          },
        });
        await ctx.do.emitSse({
          type: "calendar_done",
          spotlightRef: { date: payload.date, channel: payload.channel },
          ts: Date.now(),
        });
        await ctx.do.setStatus("done");
        return { ok: true };
      },
    }),
  };
}
