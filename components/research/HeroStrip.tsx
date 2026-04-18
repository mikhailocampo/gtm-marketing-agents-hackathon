"use client";

import { Favicon } from "@/components/ui/Favicon";
import { ThinkingDot } from "./ThinkingDot";
import { cn } from "@/lib/utils";

export function HeroStrip({
  brand,
  currentAction,
  thinking,
  reconnecting,
  className,
}: {
  brand: { name: string; domain: string };
  currentAction: string;
  thinking: boolean;
  reconnecting?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "glass-regular rounded-card flex items-center justify-between gap-4 px-5 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Favicon domain={brand.domain} size={24} />
        <span className="font-semibold text-base truncate">{brand.name}</span>
      </div>
      <div className="flex flex-col items-end gap-0.5 min-w-0">
        <div className="flex items-center gap-2 text-sm text-foreground/80">
          <span className="truncate">{currentAction}</span>
          {thinking && <ThinkingDot />}
        </div>
        {reconnecting && (
          <span className="text-xs text-muted-foreground">Reconnecting…</span>
        )}
      </div>
    </div>
  );
}
