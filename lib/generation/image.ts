import { generateText } from "ai";
import { getGoogle, MODEL_IDS } from "../llm/google";

type Env = { GOOGLE_GENERATIVE_AI_API_KEY?: string };

export type GeneratedImage = {
  uint8Array: Uint8Array;
  mediaType: string;
};

export async function generateImage(
  env: Env,
  prompt: string,
): Promise<GeneratedImage | null> {
  try {
    const google = getGoogle(env);
    const result = await generateText({
      model: google(MODEL_IDS.IMAGE),
      prompt,
    });
    const file = result.files?.find((f) =>
      (f.mediaType ?? "").startsWith("image/"),
    );
    if (!file) return null;
    const bytes =
      "uint8Array" in file && file.uint8Array
        ? (file.uint8Array as Uint8Array)
        : null;
    if (!bytes) return null;
    return { uint8Array: bytes, mediaType: file.mediaType ?? "image/png" };
  } catch (err) {
    console.error("[nano-banana]", err);
    return null;
  }
}
