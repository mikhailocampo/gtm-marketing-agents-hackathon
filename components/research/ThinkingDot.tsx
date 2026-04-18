import { cn } from "@/lib/utils";

export function ThinkingDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block h-1.5 w-1.5 rounded-full bg-accent-inflight align-baseline animate-pulse",
        className,
      )}
      style={{ animationDuration: "1500ms" }}
    />
  );
}
