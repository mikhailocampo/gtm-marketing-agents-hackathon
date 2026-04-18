"use client";

import * as React from "react";
import { use as usePromise } from "react";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
  type UIMessage,
} from "ai";

import { HeroStrip } from "@/components/research/HeroStrip";
import { LiveLog } from "@/components/research/LiveLog";
import { Button } from "@/components/ui/button";
import { buildUIMessages } from "@/lib/serialized-parts";
import type { Social } from "@/lib/types";
import { buildSeedUserMessage, summarizeStream } from "./helpers";

type SessionMeta = {
  websiteUrl: string;
  socials: Social[];
  brand?: { name: string; domain: string };
};

type ConversationsResponse = {
  data?: {
    journal?: Array<{
      id: string;
      role: string;
      content: string;
      metadata?: Record<string, unknown> | null;
    }>;
    session?: Partial<SessionMeta>;
  };
};

function deriveBrandFromUrl(url: string): { name: string; domain: string } {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const name = host.split(".")[0] ?? host;
    return { name: name.charAt(0).toUpperCase() + name.slice(1), domain: host };
  } catch {
    return { name: url, domain: url };
  }
}

export default function ResearchPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = usePromise(params);
  const router = useRouter();

  const customFetch: typeof fetch = React.useCallback(
    async (input, init) => {
      if (init?.body && typeof init.body === "string") {
        try {
          const body = JSON.parse(init.body);
          body.sid = sid;
          init = { ...init, body: JSON.stringify(body) };
        } catch {
          // leave as-is
        }
      }
      return fetch(input as RequestInfo, init);
    },
    [sid],
  );

  const transportRef = React.useRef(
    new DefaultChatTransport({ api: "/api/chat", fetch: customFetch }),
  );

  const {
    messages,
    sendMessage,
    status,
    addToolOutput,
    setMessages,
  } = useChat({
    transport: transportRef.current,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  const isStreaming = status === "streaming" || status === "submitted";

  const [sessionMeta, setSessionMeta] = React.useState<SessionMeta | null>(null);
  const [confirmReady, setConfirmReady] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/chat/conversations/${sid}`);
        if (!res.ok) return;
        const parsed = (await res.json()) as ConversationsResponse;
        if (cancelled) return;

        const sess = parsed.data?.session;
        const meta: SessionMeta | null =
          sess && typeof sess.websiteUrl === "string"
            ? {
                websiteUrl: sess.websiteUrl,
                socials: Array.isArray(sess.socials) ? sess.socials : [],
                brand: sess.brand,
              }
            : null;
        setSessionMeta(meta);

        const journal = parsed.data?.journal;
        if (journal?.length) {
          setMessages(buildUIMessages(journal) as UIMessage[]);
        } else if (meta) {
          sendMessage({ text: buildSeedUserMessage(meta) });
        }
      } catch {
        // swallow — user sees empty stream and can retry via Screen 1
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  const summary = React.useMemo(() => summarizeStream(messages), [messages]);

  React.useEffect(() => {
    if (!summary.hasFinalize) {
      setConfirmReady(false);
      return;
    }
    const t = window.setTimeout(() => setConfirmReady(true), 500);
    return () => window.clearTimeout(t);
  }, [summary.hasFinalize]);

  const onAskAnswer = React.useCallback(
    (toolCallId: string, reply: string | string[]) => {
      addToolOutput({
        tool: "askUser",
        toolCallId,
        output: { reply },
      });
    },
    [addToolOutput],
  );

  const brand = React.useMemo(() => {
    if (sessionMeta?.brand) return sessionMeta.brand;
    if (sessionMeta?.websiteUrl) return deriveBrandFromUrl(sessionMeta.websiteUrl);
    return { name: "Brand", domain: "" };
  }, [sessionMeta]);

  const currentAction = summary.inflightLabel
    ? summary.inflightLabel
    : isStreaming
      ? summary.hasReasoning
        ? "Thinking…"
        : "Synthesizing…"
      : "Starting…";

  return (
    <main className="flex-1 flex flex-col min-h-0 w-full max-w-3xl mx-auto p-4 gap-4">
      <HeroStrip
        brand={brand}
        currentAction={currentAction}
        thinking={summary.anyInflight || isStreaming}
      />

      <div className="flex-1 min-h-0 flex flex-col">
        <LiveLog
          messages={messages}
          isStreaming={isStreaming}
          onAskAnswer={onAskAnswer}
        />
      </div>

      {confirmReady && (
        <div className="animate-in fade-in duration-300 flex justify-center">
          <Button
            size="lg"
            onClick={() => router.push(`/confirm/${sid}`)}
          >
            Review the plan →
          </Button>
        </div>
      )}
    </main>
  );
}
