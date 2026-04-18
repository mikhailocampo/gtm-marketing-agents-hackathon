import type { UIMessage } from "ai";
import { formatToolLabel } from "@/components/stream/tool-labels";
import {
  isToolPart,
  normalizeToolPart,
  type ToolPart,
} from "@/components/stream/ToolCallLine";
import type { Social } from "@/lib/types";

function isInflight(tool: ToolPart): boolean {
  if (tool.output != null) return false;
  return (
    tool.state === "input-available" ||
    tool.state === "input-streaming" ||
    tool.state === "call"
  );
}

export type StreamSummary = {
  inflightLabel: string | null;
  anyInflight: boolean;
  hasReasoning: boolean;
  hasFinalize: boolean;
};

export function summarizeStream(messages: UIMessage[]): StreamSummary {
  let inflightLabel: string | null = null;
  let anyInflight = false;
  let hasReasoning = false;
  let hasFinalize = false;

  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant") continue;
    for (let j = m.parts.length - 1; j >= 0; j--) {
      const p = m.parts[j];
      if ((p as { type?: string }).type === "reasoning") {
        hasReasoning = true;
        continue;
      }
      if (!isToolPart(p)) continue;
      const tool = normalizeToolPart(p as unknown as Record<string, unknown>);
      if (tool.toolName === "finalize_research" && tool.output != null) {
        hasFinalize = true;
      }
      if (isInflight(tool)) {
        anyInflight = true;
        if (!inflightLabel) {
          inflightLabel = formatToolLabel(tool.toolName, tool.input);
        }
      }
    }
  }
  return { inflightLabel, anyInflight, hasReasoning, hasFinalize };
}

export function buildSeedUserMessage({
  websiteUrl,
  socials,
}: {
  websiteUrl: string;
  socials: Social[];
}): string {
  const socialsStr = socials.length
    ? socials.map((s) => `${s.platform} @${s.handle} (${s.url})`).join(", ")
    : "none provided";
  return `Research the brand at ${websiteUrl}. Here are their social accounts: ${socialsStr}. Produce a thorough ResearchOutput.`;
}
