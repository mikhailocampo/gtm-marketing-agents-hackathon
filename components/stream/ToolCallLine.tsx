"use client";

import * as React from "react";
import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatToolLabel,
  getThoughtSignature,
  isToolFailureValue,
} from "./tool-labels";

export interface ToolPart {
  toolName: string;
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
}

export function isToolPart(p: unknown): boolean {
  const type = (p as Record<string, unknown>)?.type;
  return (
    typeof type === "string" &&
    (type === "dynamic-tool" || type.startsWith("tool-"))
  );
}

export function isToolFailure(output: unknown): boolean {
  return isToolFailureValue(output);
}

export function normalizeToolPart(p: Record<string, unknown>): ToolPart {
  const type = p.type as string;
  const toolName =
    type === "dynamic-tool"
      ? (p.toolName as string)
      : type.slice("tool-".length);
  return {
    toolName,
    toolCallId: (p.toolCallId as string) ?? "",
    state: (p.state as string) ?? "call",
    input: p.input,
    output: p.output,
  };
}

export function ToolCallLine({ tool }: { tool: ToolPart }) {
  const [expanded, setExpanded] = React.useState(false);
  const label = formatToolLabel(tool.toolName, tool.input);
  const isComplete = tool.output !== undefined && tool.output !== null;
  const isError = isComplete && isToolFailure(tool.output);
  const signature =
    isComplete && !isError
      ? getThoughtSignature(tool.toolName, tool.input, tool.output)
      : null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        disabled={!isComplete}
        className={cn(
          "flex items-center gap-1.5 text-sm",
          isComplete ? "cursor-pointer hover:text-foreground" : "cursor-default",
          isError ? "text-accent-inflight" : "text-muted-foreground",
        )}
      >
        {isComplete && !isError && (
          <Check className="h-3.5 w-3.5 text-accent-done flex-shrink-0" />
        )}
        {isComplete && isError && (
          <AlertCircle className="h-3.5 w-3.5 text-accent-inflight flex-shrink-0" />
        )}
        {!isComplete && (
          <span className="text-muted-foreground/60">▸</span>
        )}
        <span className={cn(!isComplete && "animate-pulse")}>{label}</span>
        {signature && (
          <span className="ml-1 text-xs text-muted-foreground/80">
            · {signature}
          </span>
        )}
      </button>
      {expanded && isComplete && tool.output != null && (
        <pre className="mt-1 ml-4 text-xs text-muted-foreground whitespace-pre-wrap break-words">
          {typeof tool.output === "string"
            ? tool.output
            : JSON.stringify(tool.output, null, 2)}
        </pre>
      )}
    </div>
  );
}
