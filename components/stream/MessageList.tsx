"use client";

import * as React from "react";
import type { UIMessage } from "ai";
import { ArrowDown } from "lucide-react";
import { MessageBubble } from "./MessageBubble";
import { Button } from "@/components/ui/button";

export function MessageList({
  messages,
  isStreaming,
}: {
  messages: UIMessage[];
  isStreaming: boolean;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const sentinelRef = React.useRef<HTMLDivElement>(null);
  const [atBottom, setAtBottom] = React.useState(true);

  React.useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setAtBottom(entry.isIntersecting),
      { root: containerRef.current, threshold: 0.1 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (atBottom) {
      sentinelRef.current?.scrollIntoView({ behavior: "instant" });
    }
  }, [messages, atBottom]);

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto"
      role="log"
      aria-live="polite"
    >
      <div className="flex flex-col gap-4 p-4 max-w-3xl mx-auto w-full">
        {messages.map((message, i) => (
          <MessageBubble
            key={message.id}
            message={message}
            isStreaming={isStreaming && i === messages.length - 1}
          />
        ))}
        <div ref={sentinelRef} className="h-px" />
      </div>
      {!atBottom && (
        <div className="sticky bottom-4 flex justify-center">
          <Button
            size="icon"
            variant="secondary"
            className="rounded-chip shadow-md"
            onClick={() =>
              sentinelRef.current?.scrollIntoView({ behavior: "smooth" })
            }
            aria-label="Scroll to latest"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
