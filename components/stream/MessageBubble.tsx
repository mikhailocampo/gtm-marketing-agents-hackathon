"use client";

import * as React from "react";
import type { UIMessage } from "ai";
import { cn } from "@/lib/utils";
import { ThoughtBlock } from "./ThoughtBlock";
import {
  ToolCallLine,
  isToolPart,
  normalizeToolPart,
  type ToolPart,
} from "./ToolCallLine";
import { AskInline, type AskInput } from "@/components/research/AskInline";
import { useAskAnswer } from "@/components/research/AskAnswerContext";

export type RenderedSegment =
  | { kind: "text"; text: string }
  | { kind: "thought"; texts: string[] }
  | { kind: "tool"; tool: ToolPart };

export function groupPartsForRendering(
  parts: UIMessage["parts"],
): RenderedSegment[] {
  const segments: RenderedSegment[] = [];
  let pendingReasoning: string[] = [];

  for (const part of parts) {
    if (part.type === "reasoning" && (part as { text?: string }).text) {
      pendingReasoning.push((part as { text: string }).text);
      continue;
    }

    if (pendingReasoning.length > 0) {
      segments.push({ kind: "thought", texts: [...pendingReasoning] });
      pendingReasoning = [];
    }

    if (part.type === "text" && (part as { text?: string }).text) {
      segments.push({ kind: "text", text: (part as { text: string }).text });
    } else if (isToolPart(part)) {
      segments.push({
        kind: "tool",
        tool: normalizeToolPart(part as unknown as Record<string, unknown>),
      });
    }
  }

  if (pendingReasoning.length > 0) {
    segments.push({ kind: "thought", texts: pendingReasoning });
  }

  return segments;
}

function getTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

export function MessageBubble({
  message,
  isStreaming = false,
  className,
}: {
  message: UIMessage;
  isStreaming?: boolean;
  className?: string;
}) {
  const isUser = message.role === "user";

  if (isUser) {
    const text = getTextContent(message);
    if (!text) return null;
    return (
      <div className="flex max-w-[85%] ml-auto">
        <div className="glass-subtle rounded-card rounded-br-sm px-4 py-3 text-sm">
          <p className="whitespace-pre-wrap break-words">{text}</p>
        </div>
      </div>
    );
  }

  const segments = groupPartsForRendering(message.parts);
  const askAnswer = useAskAnswer();

  return (
    <div className={cn("flex flex-col gap-2 max-w-[85%] mr-auto", className)}>
      {segments.map((seg, i) => {
        switch (seg.kind) {
          case "text":
            return (
              <p key={`t-${i}`} className="text-sm whitespace-pre-wrap">
                {seg.text}
              </p>
            );
          case "thought":
            return (
              <ThoughtBlock
                key={`th-${i}`}
                texts={seg.texts}
                isStreaming={isStreaming && i === segments.length - 1}
              />
            );
          case "tool": {
            const t = seg.tool;
            if (
              t.toolName === "askUser" &&
              t.state === "input-available" &&
              askAnswer
            ) {
              return (
                <AskInline
                  key={`ask-${t.toolCallId}`}
                  toolCallId={t.toolCallId}
                  input={t.input as AskInput}
                  onSubmit={(reply) => askAnswer(t.toolCallId, reply)}
                />
              );
            }
            if (t.toolName === "askUser" && t.state === "output-available") {
              const reply = (t.output as { reply?: string | string[] } | undefined)?.reply;
              const text = Array.isArray(reply) ? reply.join(", ") : reply ?? "";
              return (
                <p
                  key={`ask-ans-${t.toolCallId}`}
                  className="text-sm text-muted-foreground italic"
                >
                  You answered: {text}
                </p>
              );
            }
            return <ToolCallLine key={`tl-${i}`} tool={t} />;
          }
          default:
            return null;
        }
      })}
    </div>
  );
}
