import { toolError, type ToolError } from "./errors";

type R2Env = { IMAGES: R2Bucket; R2_PUBLIC_URL?: string };

export async function putImage(
  env: R2Env,
  key: string,
  bytes: Uint8Array | ArrayBuffer,
  contentType = "image/png",
): Promise<string | ToolError> {
  if (!env.R2_PUBLIC_URL) {
    return toolError({
      code: "r2_put_failed",
      message:
        "R2_PUBLIC_URL not configured. Set the r2.dev public URL for the gtm-agent-images bucket.",
      recoverable: false,
      retry_safe: false,
    });
  }
  try {
    await env.IMAGES.put(key, bytes, {
      httpMetadata: { contentType },
    });
    const base = env.R2_PUBLIC_URL.replace(/\/$/, "");
    return `${base}/${key}`;
  } catch (err) {
    return toolError({
      code: "r2_put_failed",
      message: err instanceof Error ? err.message : String(err),
      recoverable: true,
      retry_safe: true,
    });
  }
}
