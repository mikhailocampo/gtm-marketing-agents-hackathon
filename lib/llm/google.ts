import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getGoogle(env: {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  GEMINI_API_KEY?: string;
}) {
  const apiKey = env.GOOGLE_GENERATIVE_AI_API_KEY ?? env.GEMINI_API_KEY;
  return createGoogleGenerativeAI({ apiKey });
}

export const MODEL_IDS = {
  RESEARCH: "gemini-2.5-flash",
  ORCHESTRATOR: "gemini-2.5-flash", // thinkingLevel:'high'; swap to pro post-benchmark
  COPY: "gemini-2.5-flash",
  IMAGE: "google/gemini-3.1-flash-image-preview", // Nano Banana 2
  VIDEO: "google/veo-3.1-generate-001",
  UTIL: "gemini-2.5-flash-lite",
  MEDIA_ANALYZER: "gemini-2.5-flash",
} as const;

export const RESEARCH_PROVIDER_OPTIONS = {
  google: {
    thinkingConfig: { thinkingLevel: "low", includeThoughts: true },
  },
} as const;

export const ORCHESTRATOR_PROVIDER_OPTIONS = {
  google: {
    thinkingConfig: { thinkingLevel: "high", includeThoughts: true },
  },
} as const;
