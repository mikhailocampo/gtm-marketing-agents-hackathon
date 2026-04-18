"use client";

import * as React from "react";
import type { UIMessage } from "ai";
import { MessageList } from "@/components/stream/MessageList";
import {
  AskAnswerProvider,
  type AskAnswer,
} from "./AskAnswerContext";

const MIN_TEXT_INTERVAL_MS = 400;

type PartStats = { nonTextCount: number; textLen: number };

function collectStats(messages: UIMessage[]): PartStats {
  let nonTextCount = 0;
  let textLen = 0;
  for (const m of messages) {
    for (const p of m.parts) {
      if (p.type === "text") {
        textLen += (p as { text?: string }).text?.length ?? 0;
      } else {
        nonTextCount += 1;
      }
    }
  }
  return { nonTextCount, textLen };
}

/**
 * Throttles pure-text updates to ≥400ms and provides an AskAnswer callback
 * via context. Structural changes (new tool/reasoning parts, added messages)
 * bypass the throttle.
 */
export function LiveLog({
  messages,
  isStreaming,
  onAskAnswer,
}: {
  messages: UIMessage[];
  isStreaming: boolean;
  onAskAnswer: AskAnswer;
}) {
  const [display, setDisplay] = React.useState<UIMessage[]>(messages);
  const messagesRef = React.useRef(messages);
  messagesRef.current = messages;

  const lastFlushRef = React.useRef(0);
  const pendingRef = React.useRef<number | null>(null);
  const prevStatsRef = React.useRef(collectStats(messages));
  const prevCountRef = React.useRef(messages.length);

  React.useEffect(() => {
    const stats = collectStats(messages);
    const structural =
      stats.nonTextCount !== prevStatsRef.current.nonTextCount ||
      messages.length !== prevCountRef.current;
    const textChanged = stats.textLen !== prevStatsRef.current.textLen;
    prevStatsRef.current = stats;
    prevCountRef.current = messages.length;

    const flush = () => {
      lastFlushRef.current = Date.now();
      pendingRef.current = null;
      setDisplay((prev) =>
        prev === messagesRef.current ? prev : messagesRef.current,
      );
    };

    if (structural || !textChanged) {
      if (pendingRef.current != null) {
        window.clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      flush();
      return;
    }

    const elapsed = Date.now() - lastFlushRef.current;
    if (elapsed >= MIN_TEXT_INTERVAL_MS) {
      flush();
      return;
    }
    if (pendingRef.current == null) {
      pendingRef.current = window.setTimeout(flush, MIN_TEXT_INTERVAL_MS - elapsed);
    }
  }, [messages]);

  React.useEffect(() => {
    return () => {
      if (pendingRef.current != null) {
        window.clearTimeout(pendingRef.current);
      }
    };
  }, []);

  return (
    <AskAnswerProvider value={onAskAnswer}>
      <div className="flex-1 min-h-0 [&>*>div>div>*:nth-last-child(n+7)]:opacity-60 transition-opacity">
        <MessageList messages={display} isStreaming={isStreaming} />
      </div>
    </AskAnswerProvider>
  );
}
