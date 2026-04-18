"use client";
import type { ChannelId, PostVariant, SpotlightRef } from "@/lib/types";
import { Favicon } from "@/components/ui/Favicon";
import { channelDomain } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { slotKey } from "@/lib/stores/session";
import { isToday, parseIso } from "./date-utils";

type Props = {
  date: string;
  inMonth: boolean;
  posts: PostVariant[];
  shimmerChannels: ChannelId[];
  spotlight?: Pick<SpotlightRef, "date" | "channel">;
  onClick: () => void;
};

export function DayCell({
  date,
  inMonth,
  posts,
  shimmerChannels,
  spotlight,
  onClick,
}: Props) {
  const dayNum = parseIso(date).d;
  const hasAny = posts.length > 0 || shimmerChannels.length > 0;
  const interactive = hasAny;
  const isSpotlightDay =
    spotlight && spotlight.date === date && posts.some((p) => p.channel === spotlight.channel);
  const today = isToday(date);

  const shimmersNotPosted = shimmerChannels.filter(
    (c) => !posts.some((p) => p.channel === c),
  );

  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={interactive ? onClick : undefined}
      className={[
        "relative aspect-square flex flex-col items-start gap-1 rounded-card p-2 text-left transition",
        inMonth ? "opacity-100" : "opacity-40",
        interactive ? "glass-subtle hover:shadow-[var(--shadow-sm)]" : "bg-transparent",
        isSpotlightDay
          ? "ring-4 ring-[hsl(var(--accent-spotlight))]"
          : "",
        !interactive ? "cursor-default" : "cursor-pointer",
      ].join(" ")}
      aria-label={`${date}${posts.length ? ` – ${posts.length} posts` : ""}`}
    >
      <span
        className={[
          "text-xs tabular-nums",
          today ? "ring-1 ring-foreground rounded-full px-1.5" : "",
          inMonth ? "text-foreground" : "text-muted-foreground",
        ].join(" ")}
      >
        {dayNum}
      </span>
      <div className="flex flex-wrap gap-1 items-center">
        {posts.map((p) => {
          const isSpot =
            spotlight?.date === date && spotlight?.channel === p.channel;
          return (
            <Favicon
              key={slotKey(p.date, p.channel)}
              domain={channelDomain(p.channel)}
              size={16}
              className={isSpot ? "ring-2 ring-[hsl(var(--accent-spotlight))] rounded-[3px]" : ""}
            />
          );
        })}
        {shimmersNotPosted.map((c) => (
          <Skeleton
            key={`shim-${c}`}
            className="glass-subtle h-4 w-4 rounded-[3px] animate-pulse"
          />
        ))}
      </div>
    </button>
  );
}
