"use client";
import type { ResearchOutput } from "@/lib/types";
import { matchThemeEvidence } from "./derive";

export function ThemeList({ research }: { research: ResearchOutput }) {
  const themes = research.suggestedThemes.slice(0, 5);
  if (themes.length === 0) return null;
  return (
    <section aria-labelledby="themes-heading" className="flex flex-col gap-2">
      <h3 id="themes-heading" className="text-xl font-semibold text-foreground">
        Themes I’d build on
      </h3>
      <div className="flex flex-wrap gap-2">
        {themes.map((t) => {
          const evidence = matchThemeEvidence(t, research);
          return (
            <span
              key={t}
              className="glass-subtle rounded-chip px-3 py-1.5 text-xs flex items-center gap-2"
            >
              <span className="font-medium text-foreground">{t}</span>
              {evidence && (
                <span className="text-muted-foreground">· {evidence}</span>
              )}
            </span>
          );
        })}
      </div>
    </section>
  );
}
