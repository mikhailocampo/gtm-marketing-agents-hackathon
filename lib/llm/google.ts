import { createGoogleGenerativeAI } from "@ai-sdk/google";

export function getGoogle(env: { GOOGLE_GENERATIVE_AI_API_KEY?: string }) {
  return createGoogleGenerativeAI({
    apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY,
  });
}

export const MODEL_IDS = {
  RESEARCH: "gemini-3-flash-preview",
  ORCHESTRATOR: "gemini-3-flash-preview", // thinkingLevel:'high'; swap to pro post-benchmark
  COPY: "gemini-3-flash-preview",
  IMAGE: "google/gemini-3.1-flash-image-preview", // Nano Banana 2
  VIDEO: "google/veo-3.1-generate-001",
  UTIL: "gemini-3.1-flash-lite-preview",
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
