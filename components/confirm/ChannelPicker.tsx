"use client";
import * as React from "react";
import type { ChannelId } from "@/lib/types";
import { Checkbox } from "@/components/ui/checkbox";
import { Favicon } from "@/components/ui/Favicon";
import { CHANNEL_LABELS, channelDomain } from "@/lib/utils";

const ROWS: { id: ChannelId; cadence: string }[] = [
  { id: "tiktok", cadence: "3 / wk" },
  { id: "instagram", cadence: "2 / wk" },
  { id: "linkedin", cadence: "1 / wk" },
  { id: "facebook", cadence: "1 / wk" },
  { id: "x", cadence: "1 / wk" },
  { id: "youtube", cadence: "1 / wk" },
  { id: "threads", cadence: "1 / wk" },
];

type Props = {
  selected: ChannelId[];
  onChange: (ids: ChannelId[]) => void;
};

export function ChannelPicker({ selected, onChange }: Props) {
  const set = React.useMemo(() => new Set(selected), [selected]);
  const toggle = (id: ChannelId) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  return (
    <section aria-labelledby="channels-heading" className="flex flex-col gap-2">
      <h3 id="channels-heading" className="text-xl font-semibold text-foreground">
        Channels I’ll plan for
      </h3>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {ROWS.map((row) => {
          const checked = set.has(row.id);
          return (
            <li key={row.id}>
              <label
                className="glass-subtle rounded-input p-3 flex items-center gap-3 cursor-pointer hover:bg-foreground/[0.02]"
              >
                <Checkbox
                  checked={checked}
                  onChange={() => toggle(row.id)}
                  aria-label={CHANNEL_LABELS[row.id]}
                />
                <Favicon domain={channelDomain(row.id)} size={16} />
                <span className="text-sm font-medium text-foreground">
                  {CHANNEL_LABELS[row.id]}
                </span>
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                  {row.cadence}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
