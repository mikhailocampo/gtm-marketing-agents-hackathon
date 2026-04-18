/**
 * Human-readable labels for agent tool calls.
 * Some labels are templates that accept {placeholders}; the caller fills them in
 * from the tool's `input` before display.
 */

export const TOOL_LABELS: Record<string, string> = {
  scrapeWebsite: "Reading website",
  scrapeTikTokProfile: "Reading @{handle} on TikTok",
  scrapeInstagramProfile: "Reading @{handle} on Instagram",
  scrapeTikTokHashtag: "Searching #{tag} on TikTok",
  askUser: "Asking you",
  finalize_research: "Synthesizing",
  plan_week: "Planning week {weekNumber}",
  generate_post: "Writing {channel} post for {date}",
  pick_spotlight: "Picking spotlight",
};

export function formatToolLabel(toolName: string, input: unknown): string {
  const template = TOOL_LABELS[toolName] ?? toolName;
  if (!input || typeof input !== "object") return template;
  const values = input as Record<string, unknown>;
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    const v = values[key];
    return v == null ? `{${key}}` : String(v);
  });
}

/** Per-tool one-liner summary of a completed tool result. */
export function getThoughtSignature(
  toolName: string,
  input: unknown,
  result: unknown,
): string {
  if (isToolFailureValue(result)) {
    const msg =
      result && typeof result === "object" && "message" in result
        ? String((result as { message: unknown }).message)
        : "Failed";
    return msg;
  }

  switch (toolName) {
    case "scrapeWebsite": {
      const r = result as { title?: string } | undefined;
      return r?.title ? `Read "${r.title}"` : "Read website";
    }
    case "scrapeTikTokProfile": {
      const arr = Array.isArray(result) ? (result as Array<{ views?: number }>) : [];
      const topViews = arr.reduce((m, p) => Math.max(m, p.views ?? 0), 0);
      return `Found ${arr.length} posts${topViews ? `, top at ${topViews.toLocaleString()} views` : ""}`;
    }
    case "scrapeInstagramProfile": {
      const arr = Array.isArray(result) ? (result as Array<{ likes?: number }>) : [];
      const topLikes = arr.reduce((m, p) => Math.max(m, p.likes ?? 0), 0);
      return `Found ${arr.length} posts${topLikes ? `, top at ${topLikes.toLocaleString()} likes` : ""}`;
    }
    case "scrapeTikTokHashtag": {
      const arr = Array.isArray(result) ? (result as unknown[]) : [];
      return `Found ${arr.length} recent posts`;
    }
    case "finalize_research":
      return "Synthesized research";
    case "plan_week": {
      const r = result as { slots?: unknown[] } | undefined;
      const weekNumber =
        input && typeof input === "object" && "weekNumber" in input
          ? (input as { weekNumber: unknown }).weekNumber
          : "?";
      return `Planned ${r?.slots?.length ?? 0} slots for week ${String(weekNumber)}`;
    }
    case "generate_post": {
      const i = (input ?? {}) as { channel?: string; date?: string };
      return `Wrote ${i.channel ?? "post"} post for ${i.date ?? "day"}`;
    }
    case "pick_spotlight": {
      const r = result as { date?: string; channel?: string } | undefined;
      return r?.date ? `Spotlight: ${r.channel} on ${r.date}` : "Picked spotlight";
    }
    default:
      return TOOL_LABELS[toolName] ?? toolName;
  }
}

export function isToolFailureValue(output: unknown): boolean {
  if (typeof output === "string") {
    return output.startsWith("Failed") || output.startsWith("Error");
  }
  if (
    output &&
    typeof output === "object" &&
    (output as Record<string, unknown>).error === true
  ) {
    return true;
  }
  return false;
}
