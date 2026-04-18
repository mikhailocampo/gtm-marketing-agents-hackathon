"use client";
import type { Competitor } from "@/lib/types";
import { Favicon } from "@/components/ui/Favicon";
import { channelDomain } from "@/lib/utils";
import { formatCount } from "./derive";

export function NicheSignal({ competitors }: { competitors: Competitor[] }) {
  const rows = competitors.slice(0, 5);
  if (rows.length === 0) return null;
  return (
    <section aria-labelledby="niche-heading" className="flex flex-col gap-2">
      <h3
        id="niche-heading"
        className="text-xl font-semibold text-foreground"
      >
        Who you’re up against
      </h3>
      <ul className="flex flex-col divide-y divide-border/40 glass-subtle rounded-card">
        {rows.map((c, i) => (
          <li
            key={`${c.platform}-${c.handle}-${i}`}
            className="flex items-center gap-3 px-3 py-2 text-sm"
          >
            <Favicon domain={channelDomain(c.platform)} size={16} />
            <span className="font-medium text-foreground">{c.handle}</span>
            {c.followers != null && (
              <span className="text-xs text-muted-foreground tabular-nums">
                {formatCount(c.followers)}
              </span>
            )}
            {c.topHook && (
              <span className="text-muted-foreground truncate">
                · {c.topHook}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
