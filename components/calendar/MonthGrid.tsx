"use client";
import * as React from "react";
import type { ChannelId, PostVariant, SpotlightRef } from "@/lib/types";
import { DayCell } from "./DayCell";
import { monthGridDates, monthLabel, type YM } from "./date-utils";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Props = {
  ym: YM;
  postsByDate: Map<string, PostVariant[]>;
  shimmerSlots: Set<string>;
  spotlight?: Pick<SpotlightRef, "date" | "channel">;
  onMonthChange: (delta: -1 | 1) => void;
  onDayClick: (date: string) => void;
};

export function MonthGrid({
  ym,
  postsByDate,
  shimmerSlots,
  spotlight,
  onMonthChange,
  onDayClick,
}: Props) {
  const dates = React.useMemo(() => monthGridDates(ym), [ym]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      onMonthChange(-1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      onMonthChange(1);
    }
  };

  const shimmerByDate = React.useMemo(() => {
    const map = new Map<string, ChannelId[]>();
    for (const key of shimmerSlots) {
      const [date, ch] = key.split(":") as [string, ChannelId];
      const arr = map.get(date) ?? [];
      arr.push(ch);
      map.set(date, arr);
    }
    return map;
  }, [shimmerSlots]);

  return (
    <section className="flex flex-col gap-3" aria-label="Monthly content calendar">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold">{monthLabel(ym)}</h2>
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div
        onKeyDown={onKey}
        tabIndex={0}
        role="grid"
        className="focus-visible:outline-none grid grid-cols-7 gap-2"
      >
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="text-[11px] uppercase tracking-wide text-muted-foreground text-center py-1"
          >
            {w}
          </div>
        ))}
        {dates.map(({ date, inMonth }) => (
          <DayCell
            key={date}
            date={date}
            inMonth={inMonth}
            posts={postsByDate.get(date) ?? []}
            shimmerChannels={shimmerByDate.get(date) ?? []}
            spotlight={spotlight}
            onClick={() => onDayClick(date)}
          />
        ))}
      </div>
    </section>
  );
}
