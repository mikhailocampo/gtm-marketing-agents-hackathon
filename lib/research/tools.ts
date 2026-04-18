/**
 * Research-phase tool factory. Returns the tool object passed to streamText().
 * Caller (SessionDO.handleChat) wires the env + a callback that persists the
 * final ResearchOutput when finalize_research executes.
 */

import { tool } from "ai";
import { z } from "zod";
import {
  scrapeWebsite,
  screenshotWebsite,
  scrapeTikTokProfile,
  scrapeTikTokHashtag,
  scrapeInstagramProfile,
} from "../apify";
import { analyzeMedia, analyzeBrandScreenshot, MediaKindSchema } from "./media";
import { ResearchOutputSchema, type ResearchOutput } from "../types";
import { validateResearchFact } from "./anti-slop";
import { isToolError } from "../errors";
import type { Env } from "../session-do";

export type ResearchToolsCtx = {
  env: Env;
  sid: string;
  brandContext: string;
  onFinalize: (output: ResearchOutput) => Promise<void>;
};

export function createResearchTools(ctx: ResearchToolsCtx) {
  const { env, sid, brandContext } = ctx;
  const log = (msg: string) =>
    console.log(`[research:${sid.slice(0, 6)}] ${msg}`);

  return {
    scrapeWebsite: tool({
      description:
        "Fetch the brand's website and return markdown content for the first few pages. Always call this first.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        log(`scrapeWebsite ${url}`);
        return await scrapeWebsite(env, url);
      },
    }),

    screenshotWebsite: tool({
      description:
        "Take a desktop-viewport screenshot of the brand homepage. Returns a URL to a PNG. Pair with analyzeBrandScreenshot.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => {
        log(`screenshotWebsite ${url}`);
        return await screenshotWebsite(env, url);
      },
    }),

    analyzeBrandScreenshot: tool({
      description:
        "Run multimodal analysis on the homepage screenshot to extract brand colors, typography, layout, and hero copy.",
      inputSchema: z.object({ screenshotUrl: z.string().url() }),
      execute: async ({ screenshotUrl }) => {
        log(`analyzeBrandScreenshot`);
        return await analyzeBrandScreenshot(env, {
          screenshotUrl,
          brandContext,
        });
      },
    }),

    scrapeTikTokProfile: tool({
      description:
        "Fetch recent TikTok videos for one profile. May return empty for fortified profiles — that's normal, note the absence and proceed.",
      inputSchema: z.object({ username: z.string() }),
      execute: async ({ username }) => {
        log(`scrapeTikTokProfile @${username}`);
        return await scrapeTikTokProfile(env, username);
      },
    }),

    scrapeInstagramProfile: tool({
      description:
        "Fetch recent Instagram posts/reels for one profile. Includes videoUrl and audioUrl per post for downstream analysis.",
      inputSchema: z.object({ username: z.string() }),
      execute: async ({ username }) => {
        log(`scrapeInstagramProfile @${username}`);
        return await scrapeInstagramProfile(env, username);
      },
    }),

    scrapeTikTokHashtag: tool({
      description:
        "Search a TikTok hashtag for competitor content in the niche. Pick a specific niche hashtag, not generic ones like #fyp.",
      inputSchema: z.object({ hashtag: z.string() }),
      execute: async ({ hashtag }) => {
        log(`scrapeTikTokHashtag #${hashtag}`);
        return await scrapeTikTokHashtag(env, hashtag);
      },
    }),

    analyzeMedia: tool({
      description:
        "Run Gemini multimodal on one piece of media (video, audio, or image URL) to extract spoken hook, visual style, and audience cues. Use sparingly — cap ~5 calls per session — on the highest-engagement own and competitor posts.",
      inputSchema: z.object({
        url: z.string().url(),
        kind: MediaKindSchema,
      }),
      execute: async ({ url, kind }) => {
        log(`analyzeMedia ${kind} ${url.slice(0, 60)}…`);
        return await analyzeMedia(env, { url, kind, brandContext });
      },
    }),

    askUser: tool({
      description:
        "Ask the user exactly ONE clarifying question about a real contradiction or strategic preference. Never ask about missing data we can look up.",
      inputSchema: z.object({
        question: z.string(),
        mode: z.enum(["single", "multi"]),
        options: z.array(z.string()).min(2).max(4),
      }),
      // No execute — native HIL via addToolOutput on the client.
    }),

    finalize_research: tool({
      description:
        "Produce the final ResearchOutput. Call this exactly once, as the last step, after you have gathered enough evidence. All ResearchFacts must have non-empty evidence and at least one concrete number or named entity.",
      inputSchema: ResearchOutputSchema,
      execute: async (output) => {
        log(`finalize_research`);
        const ctxWords = [
          output.brand.name,
          ...output.brand.url.replace(/https?:\/\//, "").split(/[./]/),
        ].filter(Boolean);

        const filterFacts = <T extends { evidence?: string }>(
          facts: T[],
          label: string,
        ) => {
          const kept: T[] = [];
          for (const f of facts) {
            const r = validateResearchFact(f as never, ctxWords);
            if (r.ok) kept.push(f);
            else log(`drop ${label}: ${r.reason}`);
          }
          return kept;
        };

        const cleaned: ResearchOutput = {
          ...output,
          diagnosis: filterFacts(output.diagnosis, "diagnosis"),
          trends: filterFacts(output.trends, "trend"),
        };

        await ctx.onFinalize(cleaned);
        return {
          ok: true,
          factsAccepted:
            cleaned.diagnosis.length + cleaned.trends.length,
          factsDropped:
            output.diagnosis.length +
            output.trends.length -
            cleaned.diagnosis.length -
            cleaned.trends.length,
        };
      },
    }),
  };
}

export function isToolErrorResult(v: unknown): boolean {
  return isToolError(v);
}
