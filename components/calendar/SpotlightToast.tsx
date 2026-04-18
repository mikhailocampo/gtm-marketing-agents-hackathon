"use client";
import { Sparkles } from "lucide-react";
import type { SpotlightRef } from "@/lib/types";

type Props = {
  open: boolean;
  spotlight?: Pick<SpotlightRef, "date" | "channel">;
  onClick: () => void;
  onClose: () => void;
};

export function SpotlightToast({ open, spotlight, onClick, onClose }: Props) {
  if (!open || !spotlight) return null;
  return (
    <div className="fixed bottom-6 right-6 z-40 glass-heavy rounded-modal p-4 flex items-center gap-3 shadow-[var(--shadow-md)] animate-[slideup_300ms_ease-out]">
      <style jsx>{`
        @keyframes slideup {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
      <Sparkles className="h-4 w-4 text-amber-500" />
      <button
        type="button"
        onClick={onClick}
        className="text-sm font-medium text-foreground hover:underline"
      >
        Spotlight: {spotlight.date} · {spotlight.channel}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
