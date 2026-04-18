import { generateObject } from "ai";
import { z } from "zod";
import { getGoogle, MODEL_IDS } from "../llm/google";
import { putImage } from "../r2";
import { isToolError } from "../errors";
import { rateLimit } from "../rate-limit";
import { checkSlop } from "./anti-slop";
import { generateImage } from "./image";
import type { ChannelId, PostVariant } from "../types";

type Env = {
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  IMAGES: R2Bucket;
  R2_PUBLIC_URL?: string;
};

export type GeneratePostInput = {
  date: string;
  channel: ChannelId;
  prompt: string;
  reuseOf?: { kind: "own" | "competitor"; postUrl: string; hookText: string };
  trendSignal?: string;
  modality?: "image" | "video" | "text";
};

const PostCopySchema = z.object({
  hook: z.string().min(1).max(280),
  body: z.string().min(1),
  cta: z.string().optional(),
  rationale: z.string().min(1),
  mediaPrompt: z.string().min(1),
});

function buildCopyPrompt(input: GeneratePostInput, correction?: string): string {
  const reuse = input.reuseOf
    ? `\nReuse hook anchor (${input.reuseOf.kind}): "${input.reuseOf.hookText}" (source: ${input.reuseOf.postUrl}). Adapt, don't copy verbatim.`
    : "";
  const trend = input.trendSignal
    ? `\nTrend signal: ${input.trendSignal}`
    : "";
  const correctionBlock = correction
    ? `\n\nYour previous draft used the banned phrase "${correction}". Rewrite without it.`
    : "";
  return `Write one ${input.channel} post for ${input.date}.

Brief: ${input.prompt}${reuse}${trend}

Ban these phrases and any similar marketing filler: delve, crucial, robust, comprehensive, engage your audience, authentic storytelling, build community, unlock the power of, leverage, synergy, game-changer, revolutionize, seamless, empower, unleash. No second-person "your brand can...". No hype adjectives.

Return:
- hook: first line / attention grab. Specific. Concrete.
- body: caption or short script. One concrete detail or number.
- cta: optional call to action (omit if it would be filler).
- rationale: 1-2 sentences on why this post, grounded in the brief.
- mediaPrompt: visual prompt for an image generator. Describe the scene, not the mood.${correctionBlock}`;
}

export async function generatePost(
  env: Env,
  input: GeneratePostInput,
  ctx: { sid: string },
): Promise<PostVariant> {
  return rateLimit(ctx.sid, async () => {
    const google = getGoogle(env);
    const modality = input.modality ?? "image";

    let copy;
    let postError: { code: string; message: string } | undefined;
    {
      const first = await generateObject({
        model: google(MODEL_IDS.COPY),
        schema: PostCopySchema,
        prompt: buildCopyPrompt(input),
      });
      copy = first.object;
      const hit = checkSlop(copy);
      if (hit) {
        const retry = await generateObject({
          model: google(MODEL_IDS.COPY),
          schema: PostCopySchema,
          prompt: buildCopyPrompt(input, hit.phrase),
        });
        copy = retry.object;
        const hit2 = checkSlop(copy);
        if (hit2) {
          postError = {
            code: "slop",
            message: `Anti-slop validator rejected twice (${hit2.phrase})`,
          };
        }
      }
    }

    let mediaUrl: string | undefined;

    if (modality === "image") {
      const image = await generateImage(env, copy.mediaPrompt);
      if (!image) {
        postError ??= {
          code: "nano_banana_failed",
          message: "Image generation returned no file",
        };
      } else {
        const ext = image.mediaType.split("/")[1] ?? "png";
        const key = `${ctx.sid}/post-${input.date}-${input.channel}.${ext}`;
        const result = await putImage(env, key, image.uint8Array, image.mediaType);
        if (isToolError(result)) {
          postError ??= { code: result.error_code, message: result.message };
        } else {
          mediaUrl = result;
        }
      }
    }

    return {
      date: input.date,
      channel: input.channel,
      hook: copy.hook,
      body: copy.body,
      cta: copy.cta,
      rationale: copy.rationale,
      mediaUrl,
      mediaKind: mediaUrl ? "image" : undefined,
      reuseOf: input.reuseOf,
      trendSignal: input.trendSignal,
      error: postError,
    };
  });
}
