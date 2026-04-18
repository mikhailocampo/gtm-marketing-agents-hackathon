"use client";
import type { ResearchFact } from "@/lib/types";

type Props = { icp: ResearchFact; offer: ResearchFact; voice: ResearchFact };

const CHIPS: { key: keyof Props; header: string }[] = [
  { key: "icp", header: "I think you’re selling to…" },
  { key: "offer", header: "Your offer is…" },
  { key: "voice", header: "You sound like…" },
];

export function FactsStrip(props: Props) {
  return (
    <section
      aria-label="Brand facts"
      className="grid grid-cols-1 md:grid-cols-3 gap-2"
    >
      {CHIPS.map(({ key, header }) => {
        const fact = props[key];
        return (
          <div
            key={key}
            className="glass-subtle rounded-card p-3 flex flex-col gap-1"
          >
            <span className="text-xs uppercase tracking-wide text-muted-foreground">
              {header}
            </span>
            <span className="text-sm text-foreground leading-snug">
              {fact.text}
            </span>
          </div>
        );
      })}
    </section>
  );
}
