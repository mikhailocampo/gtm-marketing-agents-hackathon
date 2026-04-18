/**
 * Multimodal media analyzer. Pipes a TikTok/IG video, IG audio, or website
 * screenshot through Gemini 2.5 Flash and returns structured marketing facts.
 *
 * Verified working end-to-end via probe on 2026-04-18: an 867KB / 60s IG reel
 * for @greg_hoyd resolved in ~11s with auto-split VIDEO+AUDIO token modalities.
 */

import { generateObject } from "ai";
import { z } from "zod";
import { getGoogle, MODEL_IDS } from "../llm/google";
import { isToolError, toolError, type ToolError } from "../errors";

const MAX_BYTES = 20 * 1024 * 1024; // 20 MB

export const MediaKindSchema = z.enum(["video", "audio", "image"]);
export type MediaKind = z.infer<typeof MediaKindSchema>;

export const MediaAnalysisSchema = z.object({
  hook: z.string().describe("first attention-grabbing line, verbatim if spoken"),
  themes: z.array(z.string()).max(5),
  productClaims: z.array(z.string()),
  voiceMarkers: z
    .array(z.string())
    .describe("style cues: tone, pacing, register, dialect"),
  visualStyle: z
    .string()
    .describe("for video/image: setting, framing, color, texture"),
  audienceCues: z
    .array(z.string())
    .describe("who this seems to target — demographic or psychographic signals"),
});
export type MediaAnalysis = z.infer<typeof MediaAnalysisSchema>;

const BRAND_SCREENSHOT_SCHEMA = z.object({
  brandColors: z
    .array(z.string())
    .describe("dominant CSS-style hex codes, max 5"),
  typographyVibe: z.string(),
  layoutVibe: z.string(),
  productPhotographyStyle: z.string(),
  hookCopy: z
    .array(z.string())
    .describe("verbatim headlines / hero copy visible in the screenshot"),
});
export type BrandScreenshotAnalysis = z.infer<typeof BRAND_SCREENSHOT_SCHEMA>;

function mediaTypeFor(kind: MediaKind): string {
  switch (kind) {
    case "video":
      return "video/mp4";
    case "audio":
      return "audio/mp4";
    case "image":
      return "image/png";
  }
}

function analysisPrompt(brandContext: string, kind: MediaKind): string {
  const focus =
    kind === "audio"
      ? "Listen carefully. Extract spoken hook verbatim if present."
      : kind === "image"
        ? "Look closely at framing, color, typography, product placement."
        : "Watch and listen. Hook is the first 2-3 seconds — quote spoken hook verbatim.";
  return [
    `You are a marketing strategist analyzing one piece of content for the brand: ${brandContext}.`,
    focus,
    "Be specific. Cite numbers, named entities, exact phrases from the content.",
    "Avoid platitudes like 'engaging', 'authentic', 'community'. Avoid words like 'delve', 'crucial', 'robust'.",
    "If a field doesn't apply (e.g., visualStyle for pure audio), leave it as a single short note.",
  ].join("\n");
}

export type AnalyzeMediaArgs = {
  url: string;
  kind: MediaKind;
  brandContext: string;
};

async function fetchBytes(
  url: string,
): Promise<{ bytes: Uint8Array } | ToolError> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (err) {
    return toolError({
      code: "apify_empty_result",
      message: `media fetch failed: ${(err as Error).message}`,
      recoverable: false,
      retry_safe: false,
      context: { url },
    });
  }
  if (!res.ok) {
    return toolError({
      code: "apify_empty_result",
      message: `media fetch ${res.status} for ${url}`,
      recoverable: false,
      retry_safe: false,
    });
  }
  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    return toolError({
      code: "invalid_input",
      message: `media too large: ${buf.byteLength} bytes (cap ${MAX_BYTES})`,
      recoverable: false,
      retry_safe: false,
    });
  }
  return { bytes: new Uint8Array(buf) };
}

export async function analyzeMedia(
  env: { GOOGLE_GENERATIVE_AI_API_KEY?: string; GEMINI_API_KEY?: string },
  args: AnalyzeMediaArgs,
): Promise<MediaAnalysis | ToolError> {
  const fetched = await fetchBytes(args.url);
  if (isToolError(fetched)) return fetched;

  const google = getGoogle(env);
  try {
    const { object } = await generateObject({
      model: google(MODEL_IDS.MEDIA_ANALYZER),
      schema: MediaAnalysisSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: analysisPrompt(args.brandContext, args.kind) },
            {
              type: "file",
              data: fetched.bytes,
              mediaType: mediaTypeFor(args.kind),
            },
          ],
        },
      ],
    });
    return object;
  } catch (err) {
    return toolError({
      code: "llm_parse_failed",
      message: `gemini media analysis failed: ${(err as Error).message}`,
      recoverable: true,
      retry_safe: true,
      context: { url: args.url, kind: args.kind },
    });
  }
}

export async function analyzeBrandScreenshot(
  env: { GOOGLE_GENERATIVE_AI_API_KEY?: string; GEMINI_API_KEY?: string },
  args: { screenshotUrl: string; brandContext: string },
): Promise<BrandScreenshotAnalysis | ToolError> {
  const fetched = await fetchBytes(args.screenshotUrl);
  if (isToolError(fetched)) return fetched;

  const google = getGoogle(env);
  try {
    const { object } = await generateObject({
      model: google(MODEL_IDS.MEDIA_ANALYZER),
      schema: BRAND_SCREENSHOT_SCHEMA,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                `You are a brand designer reviewing the homepage screenshot for: ${args.brandContext}.`,
                "Extract specific design tokens visible in the image. Cite hex codes that you actually see, not generic palette names.",
                "Quote hero copy verbatim.",
              ].join("\n"),
            },
            {
              type: "file",
              data: fetched.bytes,
              mediaType: "image/png",
            },
          ],
        },
      ],
    });
    return object;
  } catch (err) {
    return toolError({
      code: "llm_parse_failed",
      message: `gemini screenshot analysis failed: ${(err as Error).message}`,
      recoverable: true,
      retry_safe: true,
    });
  }
}
