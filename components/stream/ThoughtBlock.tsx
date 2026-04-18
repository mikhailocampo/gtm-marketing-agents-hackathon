"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThoughtBlock({
  texts,
  isStreaming,
}: {
  texts: string[];
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = React.useState(isStreaming);
  React.useEffect(() => {
    if (!isStreaming) setExpanded(false);
  }, [isStreaming]);

  const combined = texts.join("\n\n");
  if (!combined) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-1.5"
      >
        <span
          className={cn(
            "text-sm text-muted-foreground",
            isStreaming && "animate-pulse",
          )}
        >
          {isStreaming ? "Thinking..." : "Thought briefly"}
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>
      {expanded && (
        <div className="pl-4 mt-1 border-l border-border/50">
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {combined}
          </p>
        </div>
      )}
    </div>
  );
}
