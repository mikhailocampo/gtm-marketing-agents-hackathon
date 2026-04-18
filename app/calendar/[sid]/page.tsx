"use client";

import * as React from "react";
import { use } from "react";
import { useSearchParams } from "next/navigation";
import type { CalendarEvent } from "@/lib/events";
import type { ChannelId, PostVariant, SpotlightPayload } from "@/lib/types";
import { useSessionStore, type SpotlightRefClient } from "@/lib/stores/session";
import { DEFAULT_CHANNELS } from "@/lib/utils";
import {
  FIXTURE_SPOTLIGHT_DATE,
  fixturePosts,
  fixtureSpotlightPayload,
  fixtureResearch,
} from "@/lib/fixtures/balanceyourbp";
import { MonthGrid } from "@/components/calendar/MonthGrid";
import { DayModal } from "@/components/calendar/DayModal";
import { SpotlightPill } from "@/components/calendar/SpotlightPill";
import { SpotlightToast } from "@/components/calendar/SpotlightToast";
import { Favicon } from "@/components/ui/Favicon";

export default function CalendarPage({
  params,
}: {
  params: Promise<{ sid: string }>;
}) {
  const { sid } = use(params);
  const search = useSearchParams();
  const demo = search.get("demo") === "1" || sid === "demo";
  const noAutoOpen = search.get("noautoopen") === "1";

  const {
    viewingMonth,
    postsMap,
    shimmerSlots,
    spotlightRef,
    spotlightToastOpen,
    selectedDay,
    addShimmer,
    addPost,
    setSpotlight,
    setToastOpen,
    openDay,
    nextMonth,
    prevMonth,
    reset,
  } = useSessionStore();

  React.useEffect(() => {
    reset();
  }, [sid, reset]);

  React.useEffect(() => {
    if (!demo) return;
    const posts = fixturePosts(
      viewingMonth.year,
      viewingMonth.month,
      DEFAULT_CHANNELS,
    );
    const timers: ReturnType<typeof setTimeout>[] = [];
    posts.forEach((p, i) => {
      timers.push(setTimeout(() => addShimmer(p.date, p.channel), 100 + i * 40));
      timers.push(setTimeout(() => addPost(p), 900 + i * 80));
    });
    timers.push(
      setTimeout(
        () =>
          setSpotlight({
            date: FIXTURE_SPOTLIGHT_DATE(viewingMonth.year, viewingMonth.month),
            channel: "linkedin",
            payload: fixtureSpotlightPayload,
          }),
        900 + posts.length * 80 + 400,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [demo, viewingMonth.year, viewingMonth.month, addShimmer, addPost, setSpotlight]);

  React.useEffect(() => {
    if (demo) return;
    const es = new EventSource(`/api/calendar/${encodeURIComponent(sid)}/stream`);
    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as CalendarEvent;
        if (event.type === "shimmer") addShimmer(event.date, event.channel);
        else if (event.type === "post") addPost(event.post);
        else if (event.type === "calendar_done") {
          void hydrateSpotlight(sid, event.spotlightRef, setSpotlight);
        }
      } catch (err) {
        console.warn(`[calendar:${sid.slice(0, 6)}] malformed SSE payload`, err);
      }
    };
    es.addEventListener("message", handler);
    return () => {
      es.removeEventListener("message", handler);
      es.close();
    };
  }, [demo, sid, addShimmer, addPost, setSpotlight]);

  const autoOpened = React.useRef(false);
  React.useEffect(() => {
    if (!spotlightRef || noAutoOpen || autoOpened.current) return;
    if (selectedDay) return;
    const t = setTimeout(() => {
      openDay(spotlightRef.date);
      autoOpened.current = true;
    }, 600);
    return () => clearTimeout(t);
  }, [spotlightRef, selectedDay, noAutoOpen, openDay]);

  const postsByDate = React.useMemo(() => {
    const map = new Map<string, PostVariant[]>();
    for (const p of postsMap.values()) {
      const arr = map.get(p.date) ?? [];
      arr.push(p);
      map.set(p.date, arr);
    }
    return map;
  }, [postsMap]);

  const selectedDayPosts = selectedDay ? postsByDate.get(selectedDay) ?? [] : [];

  const initialChannel: ChannelId | undefined =
    selectedDay && spotlightRef && selectedDay === spotlightRef.date
      ? spotlightRef.channel
      : undefined;

  const onMonthChange = (delta: -1 | 1) => {
    if (delta < 0) prevMonth();
    else nextMonth();
  };

  return (
    <main className="mx-auto max-w-5xl w-full p-8 flex flex-col gap-6">
      <header className="flex items-center gap-3">
        <Favicon
          domain={new URL(fixtureResearch.brand.url).hostname}
          size={20}
        />
        <div className="flex flex-col">
          <span className="text-sm font-medium">
            {fixtureResearch.brand.name}
          </span>
          <span className="text-xs text-muted-foreground">
            30-day content calendar
          </span>
        </div>
        {spotlightRef && (
          <SpotlightPill
            spotlight={spotlightRef}
            onClick={() => openDay(spotlightRef.date)}
          />
        )}
      </header>

      <MonthGrid
        ym={viewingMonth}
        postsByDate={postsByDate}
        shimmerSlots={shimmerSlots}
        spotlight={spotlightRef}
        onMonthChange={onMonthChange}
        onDayClick={(date) => {
          if ((postsByDate.get(date)?.length ?? 0) > 0) openDay(date);
        }}
      />

      <DayModal
        open={!!selectedDay}
        date={selectedDay}
        posts={selectedDayPosts}
        spotlight={spotlightRef}
        initialChannel={initialChannel}
        onClose={() => openDay(undefined)}
      />

      <SpotlightToast
        open={spotlightToastOpen}
        spotlight={spotlightRef}
        onClick={() => {
          if (spotlightRef) openDay(spotlightRef.date);
          setToastOpen(false);
        }}
        onClose={() => setToastOpen(false)}
      />
    </main>
  );
}

async function hydrateSpotlight(
  sid: string,
  ref: { date: string; channel: ChannelId },
  setSpotlight: (r: SpotlightRefClient) => void,
) {
  try {
    const res = await fetch(`/api/session/${encodeURIComponent(sid)}`, {
      cache: "no-store",
    });
    if (res.ok) {
      const data = (await res.json()) as {
        plan?: { spotlightRef?: { payload?: SpotlightPayload } };
      };
      const payload = data.plan?.spotlightRef?.payload;
      if (payload) {
        setSpotlight({ ...ref, payload });
        return;
      }
    }
  } catch (err) {
    console.warn(`[calendar:${sid.slice(0, 6)}] hydrate failed`, err);
  }
  setSpotlight({ ...ref, payload: fixtureSpotlightPayload });
}
