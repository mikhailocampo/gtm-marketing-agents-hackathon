"use client";
import * as React from "react";
import type { SpotlightPayload } from "@/lib/types";
import { EvidenceChip } from "./EvidenceChip";

type Props = {
  payload: SpotlightPayload;
  containerRef: React.RefObject<HTMLDivElement | null>;
};

type Anchor = { x: number; y: number };

export function SpotlightPanel({ payload, containerRef }: Props) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const phraseRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const chipRefs = React.useRef<Map<string, HTMLElement>>(new Map());
  const [lines, setLines] = React.useState<
    { from: Anchor; to: Anchor; chipId: string }[]
  >([]);
  const [hoverChipId, setHoverChipId] = React.useState<string | undefined>();

  const registerPhrase = React.useCallback(
    (chipId: string, el: HTMLElement | null) => {
      if (!el) phraseRefs.current.delete(chipId);
      else phraseRefs.current.set(chipId, el);
    },
    [],
  );
  const registerChip = React.useCallback((id: string, el: HTMLElement | null) => {
    if (!el) chipRefs.current.delete(id);
    else chipRefs.current.set(id, el);
  }, []);

  const recompute = React.useCallback(() => {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return;
    const cRect = container.getBoundingClientRect();
    const next: { from: Anchor; to: Anchor; chipId: string }[] = [];
    for (const h of payload.rationale.highlights) {
      const phrase = phraseRefs.current.get(h.chipId);
      const chip = chipRefs.current.get(h.chipId);
      if (!phrase || !chip) continue;
      const pr = phrase.getBoundingClientRect();
      const cr = chip.getBoundingClientRect();
      next.push({
        from: {
          x: pr.right - cRect.left,
          y: pr.top + pr.height / 2 - cRect.top,
        },
        to: { x: cr.left - cRect.left, y: cr.top + cr.height / 2 - cRect.top },
        chipId: h.chipId,
      });
    }
    setLines(next);
  }, [containerRef, payload.rationale.highlights]);

  React.useLayoutEffect(() => {
    const container = containerRef.current;
    recompute();
    const ro = new ResizeObserver(recompute);
    if (container) ro.observe(container);
    if (panelRef.current) ro.observe(panelRef.current);
    window.addEventListener("resize", recompute);
    container?.addEventListener("scroll", recompute);
    const t = setTimeout(recompute, 320);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recompute);
      container?.removeEventListener("scroll", recompute);
      clearTimeout(t);
    };
  }, [recompute, containerRef]);

  const renderSentence = () => {
    const { sentence, highlights } = payload.rationale;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    const sorted = [...highlights]
      .map((h) => ({ h, idx: sentence.indexOf(h.phrase) }))
      .filter((x) => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx);
    for (const { h, idx } of sorted) {
      if (idx > cursor) parts.push(sentence.slice(cursor, idx));
      parts.push(
        <span
          key={`${h.chipId}-${idx}`}
          ref={(el) => registerPhrase(h.chipId, el)}
          onMouseEnter={() => setHoverChipId(h.chipId)}
          onMouseLeave={() => setHoverChipId(undefined)}
          className="underline decoration-2 underline-offset-4 cursor-default"
          style={{ color: "hsl(var(--accent-spotlight))" }}
        >
          {h.phrase}
        </span>,
      );
      cursor = idx + h.phrase.length;
    }
    if (cursor < sentence.length) parts.push(sentence.slice(cursor));
    return parts;
  };

  return (
    <aside
      ref={panelRef}
      className="relative flex flex-col gap-4 border-l border-border/40 pl-6 min-w-[280px] animate-[slidein_250ms_ease-out]"
    >
      <style jsx>{`
        @keyframes slidein {
          from {
            opacity: 0;
            transform: translateX(16px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>

      <h3 className="font-serif text-xl">Why this post</h3>
      <p className="text-sm leading-relaxed text-foreground">
        {renderSentence()}
      </p>

      <div className="flex flex-col gap-2">
        {payload.evidenceChips.map((chip) => (
          <EvidenceChip
            key={chip.id}
            chip={chip}
            registerRef={registerChip}
            active={hoverChipId === chip.id}
          />
        ))}
      </div>

      <svg
        ref={svgRef}
        className="pointer-events-none absolute inset-0"
        width="100%"
        height="100%"
        aria-hidden
      >
        {lines.map((l, i) => {
          const midX = (l.from.x + l.to.x) / 2;
          const d = `M ${l.from.x},${l.from.y} C ${midX},${l.from.y} ${midX},${l.to.y} ${l.to.x},${l.to.y}`;
          const bold = hoverChipId === l.chipId;
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={
                bold
                  ? "hsl(var(--accent-spotlight))"
                  : "hsl(var(--muted-foreground))"
              }
              strokeWidth={bold ? 1.5 : 1}
              strokeDasharray="200"
              strokeDashoffset="200"
              style={{
                animation: "draw 300ms ease-out forwards",
                animationDelay: `${i * 100}ms`,
              }}
            />
          );
        })}
      </svg>
      <style jsx>{`
        @keyframes draw {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </aside>
  );
}
