"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Input } from "./input";
import { Favicon } from "./Favicon";
import { cn } from "@/lib/utils";
import type { ChannelId, Social } from "@/lib/types";

const MAX_ROWS = 6;

const HOST_MAP: Record<string, ChannelId> = {
  "tiktok.com": "tiktok",
  "instagram.com": "instagram",
  "x.com": "x",
  "twitter.com": "x",
  "facebook.com": "facebook",
  "linkedin.com": "linkedin",
  "youtube.com": "youtube",
  "threads.net": "threads",
  "pinterest.com": "pinterest",
};

function normalizeHostname(host: string): string {
  return host.replace(/^www\./, "").toLowerCase();
}

function detectPlatform(hostname: string): ChannelId | null {
  const h = normalizeHostname(hostname);
  return HOST_MAP[h] ?? null;
}

function extractHandle(platform: ChannelId, url: URL): string {
  const segs = url.pathname.split("/").filter(Boolean);
  let raw = segs[0] ?? "";
  if (platform === "linkedin" && segs[0] === "in") raw = segs[1] ?? "";
  if (platform === "linkedin" && segs[0] === "company") raw = segs[1] ?? "";
  if (platform === "youtube" && raw.startsWith("@")) raw = raw.slice(1);
  return raw.replace(/^@/, "");
}

type Row = {
  id: string;
  value: string;
  parsed: Social | null;
  domain: string;
  error: boolean;
};

function parseRow(
  value: string,
): { parsed: Social | null; domain: string; error: boolean } {
  const trimmed = value.trim();
  if (!trimmed) return { parsed: null, domain: "", error: false };
  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return { parsed: null, domain: "", error: true };
  }
  const domain = normalizeHostname(url.hostname);
  const platform = detectPlatform(url.hostname);
  if (!platform) return { parsed: null, domain, error: true };
  const handle = extractHandle(platform, url);
  if (!handle) return { parsed: null, domain, error: true };
  return {
    parsed: { platform, handle, url: url.toString() },
    domain,
    error: false,
  };
}

export function SocialInputList({
  onChange,
  className,
}: {
  onChange: (socials: Social[]) => void;
  className?: string;
}) {
  const idPrefix = React.useId();
  const counterRef = React.useRef(0);
  const makeRow = React.useCallback(
    (value = ""): Row => ({
      id: `${idPrefix}-${++counterRef.current}`,
      value,
      ...parseRow(value),
    }),
    [idPrefix],
  );
  const [rows, setRows] = React.useState<Row[]>(() => [makeRow()]);

  const emit = React.useCallback(
    (next: Row[]) => {
      onChange(
        next.map((r) => r.parsed).filter((s): s is Social => s !== null),
      );
    },
    [onChange],
  );

  const update = (id: string, value: string) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, value, ...parseRow(value) } : r));
      const last = next[next.length - 1];
      if (last && last.value.trim() && next.length < MAX_ROWS) {
        next.push(makeRow());
      }
      emit(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setRows((prev) => {
      let next = prev.filter((r) => r.id !== id);
      if (next.length === 0) next = [makeRow()];
      emit(next);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {rows.map((row) => {
        return (
          <div key={row.id} className="flex items-center gap-2">
            <Favicon domain={row.domain} size={24} />
            <Input
              value={row.value}
              onChange={(e) => update(row.id, e.target.value)}
              placeholder="https://www.tiktok.com/@yourhandle"
              aria-invalid={row.error || undefined}
              className={cn(row.error && "ring-2 ring-accent-inflight")}
            />
            {row.value.trim() && (
              <button
                type="button"
                onClick={() => remove(row.id)}
                className="text-muted-foreground hover:text-foreground p-1"
                aria-label="Remove"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
