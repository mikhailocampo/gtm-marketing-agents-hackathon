"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { use } from "react";
import type { ChannelId, ResearchOutput } from "@/lib/types";
import { DEFAULT_CHANNELS } from "@/lib/utils";
import { fixtureResearch } from "@/lib/fixtures/balanceyourbp";
import { WedgeCard } from "@/components/confirm/WedgeCard";
import { FactsStrip } from "@/components/confirm/FactsStrip";
import { Diagnosis } from "@/components/confirm/Diagnosis";
import { NicheSignal } from "@/components/confirm/NicheSignal";
import { ThemeList } from "@/components/confirm/ThemeList";
import { ChannelPicker } from "@/components/confirm/ChannelPicker";
import {
  referencedPost,
  strongestDiagnosis,
} from "@/components/confirm/derive";
import { Button } from "@/components/ui/button";
import { Favicon } from "@/components/ui/Favicon";

async function fetchResearch(sid: string): Promise<ResearchOutput | undefined> {
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(sid)}`, {
      cache: "no-store",
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as { research?: ResearchOutput };
    return data.research;
  } catch {
    return undefined;
  }
}

export default function ConfirmPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = use(params);
  const router = useRouter();
  const search = useSearchParams();
  const demo = search.get("demo") === "1" || sid === "demo";

  const [research, setResearch] = React.useState<ResearchOutput | undefined>(
    demo ? fixtureResearch : undefined,
  );
  const [selected, setSelected] =
    React.useState<ChannelId[]>(DEFAULT_CHANNELS);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (demo) return;
    let cancelled = false;
    (async () => {
      const r = (await fetchResearch(sid)) ?? fixtureResearch;
      if (!cancelled) setResearch(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [sid, demo]);

  const approve = async () => {
    if (selected.length === 0) return;
    setSubmitting(true);
    try {
      if (!demo) {
        await fetch("/api/calendar", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sid, selectedChannels: selected }),
        }).catch((err) => {
          console.warn(`[confirm:${sid.slice(0, 6)}] POST /api/calendar failed`, err);
        });
      }
      router.push(`/calendar/${encodeURIComponent(sid)}${demo ? "?demo=1" : ""}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (!research) {
    return (
      <main className="mx-auto max-w-4xl p-8">
        <p className="text-sm text-muted-foreground">Loading research…</p>
      </main>
    );
  }

  const top = strongestDiagnosis(research.diagnosis);
  const rest = research.diagnosis.filter((d) => d !== top);
  const refPost = referencedPost(research);

  return (
    <main className="mx-auto max-w-4xl w-full p-8 flex flex-col gap-8">
      <h1 className="sr-only">Did I get this right?</h1>

      <header className="flex items-center gap-3">
        <Favicon domain={new URL(research.brand.url).hostname} size={20} />
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">
            {research.brand.name}
          </span>
          <span className="text-xs text-muted-foreground">
            {research.brand.url}
          </span>
        </div>
      </header>

      {top && <WedgeCard fact={top} post={refPost} secondary={rest[0]} />}

      <FactsStrip
        icp={research.icp}
        offer={research.offer}
        voice={research.voice}
      />

      <Diagnosis extraFacts={rest} posts={research.ownPosts} />

      <NicheSignal competitors={research.competitors} />

      <ThemeList research={research} />

      <ChannelPicker selected={selected} onChange={setSelected} />

      <div className="flex items-center justify-between border-t border-border/40 pt-6">
        <span className="text-xs text-muted-foreground">
          {selected.length === 0
            ? "Pick at least one channel."
            : `I’ll generate a 30-day calendar across ${selected.length} channel${selected.length === 1 ? "" : "s"}.`}
        </span>
        <Button
          disabled={selected.length === 0 || submitting}
          onClick={approve}
        >
          {submitting ? "Starting…" : "Approve & generate"}
        </Button>
      </div>
    </main>
  );
}
