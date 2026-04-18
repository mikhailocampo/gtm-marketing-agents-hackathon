"use client";
import * as React from "react";
import { cn } from "@/lib/utils";

export function Tooltip({
  content,
  children,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={cn(
            "glass-heavy pointer-events-none absolute z-50 whitespace-nowrap rounded-input px-2 py-1 text-xs",
            side === "top" && "bottom-full left-1/2 mb-1 -translate-x-1/2",
            side === "bottom" && "top-full left-1/2 mt-1 -translate-x-1/2",
            side === "left" && "right-full top-1/2 mr-1 -translate-y-1/2",
            side === "right" && "left-full top-1/2 ml-1 -translate-y-1/2",
          )}
        >
          {content}
        </span>
      )}
    </span>
  );
}
