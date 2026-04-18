# 05 — Lane D: Screens 3 + 4

> **Do not run this until ticket 01 (scaffold) is merged.** Can run in parallel with Lanes A and B, but full end-to-end testing requires Lane A (Screen 3 reads ResearchOutput) and Lane B (Screen 4 consumes calendar SSE). During parallel work, use the fixture from ticket 01 as the data source.

**Depends on:** 01.
**Parallel with:** 02, 03, 04.
**Lane tree:** `app/confirm/[sid]/**`, `app/calendar/[sid]/**`, `components/confirm/**`, `components/calendar/**`.
**Files outside this tree are READ-ONLY.** If you need to change a shared file, STOP and flag.
**Estimated effort:** CC ~50 min.

## Why

Screen 3 is the narrative fulcrum: WedgeCard + FactsStrip + Diagnosis + Themes + ChannelPicker. This is where the judges see a specific, non-generic brand insight. Screen 4 is the demo climax: monthly calendar with favicons-per-day, DayModal with favicon tabs, and the gold-ringed Spotlight with connector lines back to evidence.

## Scope

### Screen 3 — `app/confirm/[sid]/page.tsx`

Fetches research on mount (or uses cached from Zustand). No LLM call.

```tsx
export default async function ConfirmPage({ params }) {
  const { researchOutput } = await fetchResearchReplay(params.sid);
  if (!researchOutput) return <LoadingOrError />;
  return (
    <main className="mx-auto max-w-4xl p-8 flex flex-col gap-8">
      <h1 className="sr-only">Did I get this right?</h1>
      <WedgeCard fact={strongestDiagnosis(researchOutput)} evidence={...} post={referencedPost(researchOutput)} />
      <FactsStrip icp={researchOutput.icp} offer={researchOutput.offer} voice={researchOutput.voice} />
      <Diagnosis extraFacts={researchOutput.diagnosis.slice(1)} posts={researchOutput.ownPosts} />
      <NicheSignal competitors={researchOutput.competitors} />
      <ThemeList themes={researchOutput.suggestedThemes} posts={researchOutput.ownPosts} />
      <ChannelPicker defaultSelected={['tiktok','instagram','linkedin']} onChange={setSelectedChannels} />
      <ApproveButton disabled={selectedChannels.length === 0} onClick={approve} />
    </main>
  );
}
```

### `components/confirm/WedgeCard.tsx`

Single glass-regular card, above fold.

- Editorial-serif headline (`text-3xl font-serif`): strongest `diagnosis` fact (highest confidence; tie-break by order).
- Italic pullquote (`text-lg font-serif italic`): the fact's `evidence` string.
- Inline thumbnail: referenced top-performer `ExistingPost` with platform `<Favicon>` + engagement counts.
- Optional second-strongest diagnosis as one-line footnote.

First-person agent voice is required per DESIGN.md §10.

### `components/confirm/FactsStrip.tsx`

Three glass-subtle chips in a horizontal row. Compact density (`p-2`, `gap-1`).

- "I think you're selling to…" → one-line ICP
- "Your offer is…" → one-line offer
- "You sound like…" → one-line voice

No prose. First-person agent headers.

### `components/confirm/Diagnosis.tsx`

2–3 mini diagnosis cards. Each card: `[thumbnail | platform favicon | engagement count] + one-line LLM diagnosis + color-coded tag WORKING (emerald) or UNDERPERFORMING (amber)`.

Tag derivation: heuristic on `post.isTopPerformer` flag + `diagnosis.kind`. Max 3 cards.

### `components/confirm/NicheSignal.tsx`

Competitor list: one row per competitor, favicon + handle + one distilled hook. Max 5.

### `components/confirm/ThemeList.tsx`

3–5 theme chips from `researchOutput.suggestedThemes`. Each chip shows its evidence source inline.

Example chip: `Medical dismissal · sourced from your April TikTok (40K views)`.

Evidence derivation: match theme keywords against `diagnosis[].evidence` + `ownPosts[].caption`. If no match found, show theme label alone (fallback).

### `components/confirm/ChannelPicker.tsx`

shadcn Checkbox list. Each row:

- `<Favicon domain={channelDomain(id)} />`
- Channel label
- Static cadence suggestion subtext ("TikTok 3/wk", "Instagram 2/wk", "LinkedIn 1/wk", others 1/wk).

Default selected: `['tiktok', 'instagram', 'linkedin']`. Must have ≥1 selected (Approve disabled otherwise).

### Approve flow

```tsx
async function approve() {
  await fetch('/api/calendar', { method:'POST', body: JSON.stringify({ sid, selectedChannels }) });
  router.push(`/calendar/${sid}`);
}
```

---

### Screen 4 — `app/calendar/[sid]/page.tsx`

Single unified monthly calendar with month nav.

```tsx
export default function CalendarPage({ params }) {
  const sid = params.sid;
  const { viewingMonth, postsMap, shimmerSlots, spotlightRef, setSpotlight, addPost, addShimmer, navMonth } = useSessionStore();

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/calendar/${sid}/stream`);
    es.addEventListener('message', (e) => {
      const event = JSON.parse(e.data) as CalendarEvent;
      if (event.type === 'shimmer') addShimmer(event.date, event.channel);
      if (event.type === 'post') addPost(event.post);
      if (event.type === 'calendar_done') setSpotlight(event.spotlightRef);
    });
    return () => es.close();
  }, [sid]);

  return (
    <main>
      <Header brand={...} />
      {spotlightRef && <SpotlightPill onClick={openSpotlight} />}
      <MonthGrid
        month={viewingMonth}
        today={new Date()}
        postsMap={postsMap}
        pastPostsByDate={pastPostsByDate}  // from research.ownPosts bucketed
        shimmerSlots={shimmerSlots}
        spotlightRef={spotlightRef}
        onPrev={() => navMonth(-1)}
        onNext={() => navMonth(1)}
        onDayClick={setSelectedDay}
      />
      {selectedDay && <DayModal day={selectedDay} posts={postsForDay(selectedDay)} spotlightRef={spotlightRef} onClose={() => setSelectedDay(undefined)} />}
      <SpotlightToast ... />
    </main>
  );
}
```

### `components/calendar/MonthGrid.tsx`

Standard 7-column × 5–6 row calendar.

- Header: `← {Month Year} →` with Prev/Next buttons. Keyboard: arrow keys when grid is focused.
- First row: Mon–Sun weekday labels.
- Day cells: leading/trailing days from adjacent months render dim (context only).
- Today cell has a subtle ring around the day number.

Cell layout via CSS Grid: `grid-cols-7 auto-rows-fr`.

### `components/calendar/DayCell.tsx`

- Day number top-left.
- Stack of channel favicons for that day's posts (past scraped + generated future + shimmer-only).
- Shimmer-only (no post yet) → pulsing favicon placeholder via shadcn `Skeleton` with a glass-subtle tint.
- Spotlight day gets gold ring (`ring-4 ring-amber-400 shadow-ring`) + bright badge on the spotlight favicon.
- Whole cell is the click target (pointer + hover elevation on interactive glass per DESIGN.md §5).
- Empty future cells (no post scheduled for this day) are non-interactive.

### `components/calendar/DayModal.tsx`

**Base layout (always):**

- shadcn Dialog with glass-ultra content + `rounded-modal` per DESIGN.md §7.6.
- Header: day date (e.g., "Apr 22, 2026") + close button.
- Below header: row of favicon tabs, one per post on this day. Click tab → switches active post. Active tab highlighted.
- Body:
  - Media area: `<img src={activePost.mediaUrl}>` if present, else placeholder color block derived from `hash(date+channel)`.
  - Hook: `activePost.hook`.
  - Caption: `activePost.body` (ReactMarkdown with remark-gfm).
  - Optional: `activePost.cta`.
  - Footer CTA (mocked): `[ Publish on {channel} ]` button — onClick toasts "Mocked: would post to {channel}".

**Spotlight-rich panel (conditional):**

When `activePost.date === spotlightRef.date && activePost.channel === spotlightRef.channel`, slide in a right-side panel:

- Heading: "Why this post" (not "Why I wrote this").
- Rationale paragraph: `spotlightRef.payload.rationale.sentence`. Phrases listed in `highlights[]` are visually highlighted (underline + `--accent-spotlight`). On hover, connector lines draw to the matching evidence chip.
- Evidence chips section: 2–3 `<EvidenceChip>` cards (thumbnail + label + URL link).
- Connector lines: thin SVG paths (muted-foreground, stroke-width 1) from each highlighted phrase to its chip. Entrance animation: 300ms stroke-dashoffset draw.

Panel mount animation: 250ms ease-out slide-in from right.

### `components/calendar/SpotlightPill.tsx`

Header-level pill that appears when `spotlightRef` is set. Click re-opens the spotlight modal.

### `components/calendar/SpotlightToast.tsx`

Appears on `calendar_done` SSE event. Text: "Spotlight: {date} {channel}". Click → opens DayModal at that day with the spotlight channel active.

If DayModal is ALREADY open when `calendar_done` arrives: toast only, no focus-yank.
If DayModal is NOT open: toast appears AND (by default) DayModal auto-opens after 600ms breathe delay. Honor `?noautoopen=1` query param.

### Past-posts-in-past-cells [STRETCH / TODO]

From ticket 08 spec in PLAN.md §17: in days before today, render scraped `ResearchOutput.ownPosts` bucketed by `postedAt` date. Treat them identically to generated posts for rendering — they have caption, url, platform. Clicking opens DayModal in read-only view (no mocked Publish CTA, since they're already posted).

Guard this feature behind a feature flag `ENABLE_PAST_POSTS=true` in `.dev.vars`. Default off for demo. If time remains, flip it on and rehearse.

## Acceptance

- `bun dev` → navigate to `/confirm/{sid}` with fixture sid → WedgeCard renders with specific insight, FactsStrip shows 3 chips with first-person headers, Diagnosis shows 2–3 cards with working/underperforming tags, NicheSignal shows competitors, ThemeList shows 3–5 themes with evidence lines, ChannelPicker defaults to tiktok+instagram+linkedin.
- Approve → navigates to `/calendar/{sid}` → MonthGrid renders current month.
- Against Lane B's orchestrator (or manual SSE test harness): shimmer events populate pulsing favicons in the right cells, then post events replace them with static favicons.
- Click any day → DayModal opens with favicon tabs + media + caption.
- `calendar_done` → SpotlightToast appears. If modal closed, modal auto-opens after 600ms.
- Opening the spotlight day's modal → rich "Why this post" panel slides in, rationale animates line-by-line, connectors draw to evidence chips.
- Month nav: ← / → buttons and keyboard arrow keys move ±1 month. Past months show scraped own-posts (if `ENABLE_PAST_POSTS=true`).
- Commit: `"lane-d: screens 3 + 4, WedgeCard, unified calendar, DayModal with spotlight panel"`.

## Watch-outs

- **Connector SVG math**: anchor points are per-phrase bounding-box midpoints (phrase) → per-chip left-edge midpoints (chip). Use `useLayoutEffect` + `getBoundingClientRect()` on mount and on resize. Recompute on scroll-within-modal.
- **DayModal with no posts for that day**: should not be openable. Check `postsForDay(day).length > 0` before allowing click.
- **Mocked Publish CTA**: toast text = "Mocked: would post to {channel}". Do NOT call any real API. Do NOT add a real integration — this is scope-cut per [PLAN.md §15](../PLAN.md).
- **Media placeholder**: if `mediaUrl` is undefined, render a solid color block via inline style `background: hsl(${hash(key) % 360}, 40%, 80%)`. Match the card's rounded corners. Add the post's hook as overlaid text in high-contrast.
- **Auto-open respects existing modal state**: never yank focus. If user is reading DayModal X when spotlight resolves to day Y, toast only.
- **Date normalization**: keep all dates as ISO strings (YYYY-MM-DD). Convert to Date only for month arithmetic. Keys in `postsMap` are `"${date}:${channel}"`.

## Do NOT

- Touch backend files (Lane A/B).
- Touch Screens 1/2 (Lane C).
- Build real social posting integration — Publish CTA is strictly mocked.
- Implement ChannelTabs on Screen 4 — we killed that component. Calendar is single-unified-view per [PLAN.md §10](../PLAN.md).
