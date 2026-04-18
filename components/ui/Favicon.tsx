"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function Favicon({
  domain,
  size = 24,
  className,
}: {
  domain: string;
  size?: number;
  className?: string;
}) {
  const [errored, setErrored] = React.useState(false);
  React.useEffect(() => {
    setErrored(false);
  }, [domain]);

  if (!domain || errored) {
    const letter = domain?.[0]?.toUpperCase() ?? "?";
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-input bg-muted text-muted-foreground font-medium",
          className,
        )}
        style={{ width: size, height: size, fontSize: size * 0.5 }}
        aria-hidden
      >
        {letter}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://www.google.com/s2/favicons?sz=${size * 2}&domain=${domain}`}
      width={size}
      height={size}
      alt=""
      onError={() => setErrored(true)}
      className={cn("rounded-input shrink-0", className)}
    />
  );
}
