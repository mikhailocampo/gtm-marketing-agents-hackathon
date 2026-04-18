"use client";
import { Sparkles } from "lucide-react";
import { Favicon } from "@/components/ui/Favicon";
import { channelDomain } from "@/lib/utils";
import type { SpotlightRef } from "@/lib/types";

type Props = {
  spotlight: Pick<SpotlightRef, "date" | "channel">;
  onClick: () => void;
};

export function SpotlightPill({ spotlight, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="glass-subtle rounded-chip px-3 py-1.5 flex items-center gap-2 text-xs ring-2 ring-[hsl(var(--accent-spotlight))]/60 hover:ring-[hsl(var(--accent-spotlight))] transition"
    >
      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
      <span className="font-medium">Spotlight</span>
      <Favicon domain={channelDomain(spotlight.channel)} size={14} />
      <span className="text-muted-foreground tabular-nums">{spotlight.date}</span>
    </button>
  );
}
