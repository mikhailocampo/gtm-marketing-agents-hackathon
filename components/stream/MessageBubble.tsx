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
          case "tool":
            return <ToolCallLine key={`tl-${i}`} tool={seg.tool} />;
          default:
            return null;
        }
      })}
    </div>
  );
}
