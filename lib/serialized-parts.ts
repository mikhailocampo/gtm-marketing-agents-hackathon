/**
 * Serialization/deserialization for AI SDK v6 message parts.
 * Cloned from dpc apps/web/src/lib/chi-message-parts.ts.
 */

import type { ModelMessage, UIMessage } from "ai";

export type SerializedPart =
  | { type: "text"; text: string; thoughtSignature?: string }
  | { type: "reasoning"; text: string; thoughtSignature?: string }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      input: unknown;
      thoughtSignature?: string;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      output: unknown;
    };

export interface ChiMessageLike {
  id: string;
  role: string;
  content: string;
  metadata?: Record<string, unknown> | null;
}

export function serializeStepContent(
  steps:
    | Array<{
        content: Array<{
          type: string;
          text?: string;
          toolCallId?: string;
          toolName?: string;
          input?: unknown;
          output?: unknown;
          providerMetadata?: Record<string, Record<string, unknown>>;
        }>;
      }>
    | undefined,
): SerializedPart[] {
  if (!steps?.length) return [];
  const parts: SerializedPart[] = [];

  for (const step of steps) {
    for (const part of step.content) {
      const sig = part.providerMetadata?.google?.thoughtSignature as
        | string
        | undefined;

      switch (part.type) {
        case "text":
          if (part.text) {
            parts.push({
              type: "text",
              text: part.text,
              ...(sig ? { thoughtSignature: sig } : {}),
            });
          }
          break;
        case "reasoning":
          if (part.text) {
            parts.push({
              type: "reasoning",
              text: part.text,
              ...(sig ? { thoughtSignature: sig } : {}),
            });
          }
          break;
        case "tool-call":
          if (!part.toolCallId || !part.toolName) break;
          parts.push({
            type: "tool-call",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            input: part.input,
            ...(sig ? { thoughtSignature: sig } : {}),
          });
          break;
        case "tool-result":
          if (!part.toolCallId || !part.toolName) break;
          parts.push({
            type: "tool-result",
            toolCallId: part.toolCallId,
            toolName: part.toolName,
            output: part.output,
          });
          break;
      }
    }
  }

  return parts;
}

export function buildLlmMessages(
  historyMessages: ChiMessageLike[],
): ModelMessage[] {
  const messages: ModelMessage[] = [];

  for (const m of historyMessages) {
    const structuredParts = m.metadata?.structured_parts as
      | SerializedPart[]
      | undefined;

    if (m.role === "tool_result") continue;

    if (m.role === "assistant") {
      if (structuredParts?.length) {
        const assistantContent: Array<Record<string, unknown>> = [];
        const toolResults: Array<Record<string, unknown>> = [];

        for (const p of structuredParts) {
          const providerOptions =
            p.type !== "tool-result" &&
            "thoughtSignature" in p &&
            p.thoughtSignature
              ? { google: { thoughtSignature: p.thoughtSignature } }
              : undefined;

          switch (p.type) {
            case "text":
              assistantContent.push({
                type: "text",
                text: p.text,
                providerOptions,
              });
              break;
            case "reasoning":
              assistantContent.push({
                type: "reasoning",
                text: p.text,
                providerOptions,
              });
              break;
            case "tool-call":
              assistantContent.push({
                type: "tool-call",
                toolCallId: p.toolCallId,
                toolName: p.toolName,
                input: p.input,
                providerOptions,
              });
              break;
            case "tool-result":
              toolResults.push({
                type: "tool-result",
                toolCallId: p.toolCallId,
                toolName: p.toolName,
                output: { type: "json", value: p.output },
              });
              break;
          }
        }

        if (assistantContent.length > 0) {
          messages.push({
            role: "assistant",
            content: assistantContent,
          } as ModelMessage);
        }
        if (
          toolResults.length > 0 &&
          assistantContent.some((c) => c.type === "tool-call")
        ) {
          messages.push({ role: "tool", content: toolResults } as ModelMessage);
        }
      } else {
        messages.push({ role: "assistant", content: m.content });
      }
      continue;
    }

    messages.push({ role: m.role as "user" | "system", content: m.content });
  }

  return messages;
}

export function buildUIMessages(
  rawMessages: Array<{
    id: string;
    role: string;
    content: string;
    metadata?: Record<string, unknown> | null;
  }>,
): UIMessage[] {
  const result: UIMessage[] = [];

  for (const m of rawMessages) {
    if (m.role === "tool_result") continue;

    if (m.role === "assistant") {
      const structuredParts = m.metadata?.structured_parts as
        | SerializedPart[]
        | undefined;

      if (structuredParts?.length) {
        const uiParts: UIMessage["parts"] = [];

        for (const p of structuredParts) {
          switch (p.type) {
            case "reasoning":
              uiParts.push({ type: "reasoning" as const, text: p.text });
              break;
            case "tool-call":
              uiParts.push({
                type: "dynamic-tool" as const,
                toolName: p.toolName,
                toolCallId: p.toolCallId,
                state: "input-available" as const,
                input: p.input,
              });
              break;
            case "tool-result": {
              const callPart = uiParts.find(
                (
                  up,
                ): up is Extract<
                  UIMessage["parts"][number],
                  { type: "dynamic-tool" }
                > =>
                  up.type === "dynamic-tool" &&
                  "toolCallId" in up &&
                  up.toolCallId === p.toolCallId,
              );
              if (callPart) {
                const idx = uiParts.indexOf(callPart);
                uiParts[idx] = {
                  type: "dynamic-tool" as const,
                  toolName: callPart.toolName,
                  toolCallId: callPart.toolCallId,
                  state: "output-available" as const,
                  input: callPart.input,
                  output: p.output,
                };
              }
              break;
            }
            case "text":
              if (p.text) {
                uiParts.push({ type: "text" as const, text: p.text });
              }
              break;
          }
        }

        result.push({
          id: m.id,
          role: "assistant",
          parts:
            uiParts.length > 0
              ? uiParts
              : [{ type: "text" as const, text: m.content }],
        });
      } else {
        result.push({
          id: m.id,
          role: "assistant",
          parts: [{ type: "text" as const, text: m.content }],
        });
      }
      continue;
    }

    result.push({
      id: m.id,
      role: m.role as "user" | "system",
      parts: [{ type: "text" as const, text: m.content }],
    });
  }

  return result;
}

export function hasToolOutputWithKey(
  messages: ChiMessageLike[],
  key: string,
): boolean {
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    const structuredParts = m.metadata?.structured_parts as
      | SerializedPart[]
      | undefined;
    if (!structuredParts) continue;

    for (const p of structuredParts) {
      if (p.type !== "tool-result") continue;
      const output = p.output;
      if (output && typeof output === "object" && key in output) {
        return true;
      }
    }
  }
  return false;
}
