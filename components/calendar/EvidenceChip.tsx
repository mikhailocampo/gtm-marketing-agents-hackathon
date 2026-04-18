"use client";
import * as React from "react";
import type { SpotlightPayload } from "@/lib/types";

type Chip = SpotlightPayload["evidenceChips"][number];

type Props = {
  chip: Chip;
  registerRef: (id: string, el: HTMLElement | null) => void;
  active?: boolean;
};

export const EvidenceChip = React.memo(function EvidenceChip({
  chip,
  registerRef,
  active,
}: Props) {
  const ref = React.useCallback(
    (el: HTMLElement | null) => registerRef(chip.id, el),
    [chip.id, registerRef],
  );

  const body = (
    <div
      ref={ref as React.Ref<HTMLDivElement>}
      className={[
        "glass-subtle rounded-input p-3 flex gap-3 items-center text-xs transition-shadow",
        active ? "shadow-[var(--shadow-sm)] ring-1 ring-[hsl(var(--accent-spotlight))]" : "",
      ].join(" ")}
    >
      {chip.thumbnail && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={chip.thumbnail}
          alt=""
          className="h-10 w-10 rounded-[6px] object-cover"
        />
      )}
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
          {chip.kind === "own-post"
            ? "Your post"
            : chip.kind === "competitor"
              ? "Competitor"
              : "Trend"}
        </span>
        <span className="text-sm text-foreground truncate">{chip.label}</span>
      </div>
    </div>
  );

  if (chip.url) {
    return (
      <a
        href={chip.url}
        target="_blank"
        rel="noreferrer"
        className="block hover:no-underline"
      >
        {body}
      </a>
    );
  }
  return body;
});
