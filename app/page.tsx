"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Favicon } from "@/components/ui/Favicon";
import { SocialInputList } from "@/components/ui/SocialInputList";
import type { Social } from "@/lib/types";

function parseWebsite(raw: string): { url: string; domain: string } | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    if (!u.hostname.includes(".")) return null;
    return { url: u.toString(), domain: u.hostname.replace(/^www\./, "") };
  } catch {
    return null;
  }
}

export default function Home() {
  const router = useRouter();
  const [website, setWebsite] = React.useState("");
  const [socials, setSocials] = React.useState<Social[]>([]);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const parsed = React.useMemo(() => parseWebsite(website), [website]);
  const websiteValid = parsed !== null;
  const domain = parsed?.domain ?? "";

  const handleStart = async () => {
    if (!parsed || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ websiteUrl: parsed.url, socials }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => "");
        throw new Error(msg || `Request failed (${res.status})`);
      }
      const data = (await res.json()) as { sid?: string };
      if (!data.sid) throw new Error("Missing session id in response");
      router.push(`/research/${data.sid}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  };

  return (
    <main className="mx-auto max-w-2xl p-8 flex flex-col gap-6 w-full">
      <header className="flex flex-col gap-2 mt-8">
        <h1 className="font-serif text-3xl">Tell us about your brand.</h1>
        <p className="text-muted-foreground">
          Paste your site. Add any socials we should look at.
        </p>
      </header>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium" htmlFor="website">
          Website
        </label>
        <div className="flex items-center gap-2">
          <Favicon domain={domain} size={24} />
          <Input
            id="website"
            inputMode="url"
            autoComplete="url"
            placeholder="yourbrand.com"
            value={website}
            onChange={(e) => {
              setWebsite(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && websiteValid && !submitting) {
                e.preventDefault();
                handleStart();
              }
            }}
            aria-invalid={website.length > 0 && !websiteValid ? true : undefined}
          />
        </div>
        {website.length > 0 && !websiteValid && (
          <p className="text-xs text-accent-inflight">
            That doesn&apos;t look like a valid URL.
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Socials (optional)</label>
        <SocialInputList onChange={setSocials} />
      </div>

      <Button
        size="lg"
        disabled={!websiteValid || submitting}
        onClick={handleStart}
      >
        {submitting ? "Starting research…" : "Research this brand →"}
      </Button>

      {error && <p className="text-sm text-accent-inflight">{error}</p>}
    </main>
  );
}
