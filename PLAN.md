# Engineering Plan: GTM Marketing Agent MVP

**Demo brand:** balanceyourbp.com (Unicity distributor, `@balanceyourbp_` on TikTok, `@greg_hoyd` on IG).

**North star:** judges see research that reveals *specific, non-obvious* insights about the brand, the agent asks a sharp clarifying question, then a monthly calendar populates week-by-week with one spotlight post that visibly reuses a research finding (hook + image).

**Companion docs:**
- `DESIGN.md` — typography, color, spacing, motion, glass material, anti-slop rules, a11y. Source of truth for everything visual.
- `NOTES.md` — product decisions and fixture rationale.

This plan has been through a full adversarial engineering review. Locked architectural decisions are noted inline with `[locked]`.

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CLOUDFLARE WORKER (single deployment)                       │
│                                                                             │
│  Next.js 15 App Router via @opennextjs/cloudflare                           │
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌───────────────────────┐     │
│  │ Screen 1 │──▶│ Screen 2 │──▶│ Screen 3 │──▶│ Screen 4              │     │
│  │ URL + IG │   │ Research │   │ Confirm  │   │ Monthly calendar      │     │
│  │ socials  │   │ stream   │   │ + Wedge  │   │ + DayModal/Spotlight  │     │
│  └──────────┘   └────▲─────┘   └──────────┘   └───────▲───────────────┘     │
│        │             │                │                │                    │
│        ▼             │  useChat SSE   ▼                │  custom SSE        │
│  ┌────────────────────────┐    ┌──────────────┐ ┌──────────────────────┐    │
│  │ POST /api/chat         │    │ POST /api/   │ │ POST /api/calendar    │   │
│  │ GET  /api/chat/        │    │   calendar   │ │ GET  /api/calendar/   │   │
│  │   conversations/:sid   │    │   (kickoff)  │ │   :sid/stream         │   │
│  └──────────┬─────────────┘    └──────┬───────┘ └──────────┬────────────┘   │
│             │                         │                    │                │
│             └─────────────────────────┼────────────────────┘                │
│                                       ▼                                     │
│     ┌──────────────────────────────────────────────────────────────┐        │
│     │                  SessionDO  (Durable Object)                 │        │
│     │    • idFromName(sid) — one instance per session              │        │
│     │    • SQLite-backed journal of SerializedPart[] (research)    │        │
│     │    • SQLite-backed journal of CalendarEvent[] (generation)   │        │
│     │    • SSE subscriber fanout for calendar stream               │        │
│     │    • runs long-lived work via ctx.waitUntil()                │        │
│     └──────────────────┬────────────────────────────┬──────────────┘        │
│                        │                            │                       │
│         research phase ▼                  calendar phase ▼                  │
│     ┌─────────────────────────┐   ┌────────────────────────────────────┐    │
│     │  Research streamText    │   │  Orchestrator streamText           │    │
│     │  Gemini 3 Flash         │   │  Gemini 3 Pro (or Flash thinking   │    │
│     │    thinkingLevel:'low'  │   │    :high)                          │    │
│     │    includeThoughts:true │   │                                    │    │
│     │  Tools:                 │   │  Tools:                            │    │
│     │   scrapeWebsite         │   │   plan_week    → shimmer SSE       │    │
│     │   scrapeTikTokProfile   │   │   generate_post→ sub-pipeline      │    │
│     │   scrapeInstagramProfile│   │   pick_spotlight → calendar_done   │    │
│     │   scrapeTikTokHashtag   │   │                                    │    │
│     │   askUser (NO execute — │   │  generate_post sub-pipeline:       │    │
│     │     native HIL via AI   │   │    1. generateObject (copy)        │    │
│     │     SDK addToolOutput)  │   │    2. generateText (image: Nano    │    │
│     │                         │   │       Banana 2)                    │    │
│     │                         │   │    3. R2.put → public URL          │    │
│     └────────────┬────────────┘   └──────────────┬─────────────────────┘    │
│                  │                               │                          │
│                  ▼                               ▼                          │
│     ┌──────────────────────────┐   ┌────────────────────────────────────┐   │
│     │ apify-client/browser     │   │ R2 public bucket (pub-xxx.r2.dev)  │   │
│     │  website-content-crawler │   │  generated images served directly  │   │
│     │  clockworks/tiktok       │   │  to <img> via CDN                  │   │
│     │  apify/instagram-profile │   └────────────────────────────────────┘   │
│     │  clockworks/tiktok-hash  │                                            │
│     └──────────────────────────┘                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Stack `[locked]`**

| Layer | Choice |
|---|---|
| Runtime | Cloudflare Workers via `@opennextjs/cloudflare` v1.11+ |
| Framework | Next.js 15 App Router (Node runtime via OpenNext adapter) |
| Language | TypeScript strict |
| LLM SDK | Vercel AI SDK v6 (`ai`) + `@ai-sdk/google` (DIRECT, no AI Gateway) |
| Text model | `gemini-3-flash-preview` (research, per-post copy); `gemini-3-pro-preview` or `gemini-3-flash-preview thinking:high` (orchestrator) |
| Image model | `google/gemini-3.1-flash-image-preview` (Nano Banana 2) via `generateText` |
| Video model | `google/veo-3.1-generate-001` via `experimental_generateVideo` — SPOTLIGHT ONLY, stretch |
| Client SDK | `@ai-sdk/react` v3 `useChat` + `DefaultChatTransport` |
| Session state | Durable Object (`SessionDO`), one per sid, SQLite-backed journal |
| Session transport | Native SSE via AI SDK `toUIMessageStreamResponse()` (research) + custom SSE (calendar) |
| Image storage | Cloudflare R2 public bucket (`pub-xxxxx.r2.dev`) |
| Scraping | `apify-client/browser` (Workers-safe bundle) |
| UI | shadcn/ui + Tailwind v4, restyled to Apple Liquid Glass per DESIGN.md §3.5 |
| Fonts | Inter (body) + Instrument Serif (editorial) via `next/font` |
| Client state | Zustand for local UI state; agent state lives in the DO |

**Wrangler config `[locked]`**

```jsonc
// wrangler.jsonc
{
  "name": "gtm-agent",
  "main": ".open-next/worker.js",
  "compatibility_date": "2025-03-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" },
  "durable_objects": {
    "bindings": [{ "name": "SESSION_DO", "class_name": "SessionDO" }]
  },
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["SessionDO"] }
  ],
  "r2_buckets": [
    { "binding": "IMAGES", "bucket_name": "gtm-agent-images" }
  ],
  "vars": { "DEMO_FALLBACK": "1" }
  // secrets (wrangler secret put): GOOGLE_GENERATIVE_AI_API_KEY, APIFY_TOKEN
}
```

```ts
// next.config.ts
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
};

initOpenNextCloudflareForDev();

export default nextConfig;
```

**No relational DB. No queue. No auth.** Demo-only scope.

---

## 2. Parallelization Strategy

To run parallel agents on one workdir without collisions, we lock these upfront.

### 2.1 Shared contracts (solo pass, ~25 minutes)

These files must exist before anything parallelizes:

- `lib/types.ts` — all domain types (§3)
- `lib/events.ts` — `CalendarEvent` union for custom SSE (§4)
- `lib/serialized-parts.ts` — AI SDK v6 journal types + `serializeStepContent` + `buildLlmMessages` + `buildUIMessages` (cloned from dpc `chi-message-parts.ts`)
- `lib/session-do.ts` — `SessionDO` class skeleton with SQLite schema, RPC stubs
- `lib/llm/google.ts` — `@ai-sdk/google` client factory, model-ID constants, providerOptions defaults
- `lib/apify.ts` — thin typed wrappers around 4 actors (browser bundle)
- `lib/r2.ts` — `putImage(env, key, bytes) → url` helper
- `lib/fixtures/balanceyourbp.ts` — pre-baked `ResearchOutput` + `PostVariant[]` + `spotlightRef` for fallback + dev
- `app/layout.tsx`, `app/globals.css` — shell with glass tokens per DESIGN.md §3.5
- `tailwind.config.ts` — font families, radius tokens, accent colors per DESIGN.md §2–4
- `components/ui/*` — shadcn primitives (button, input, label, card, badge, separator, dialog, radio-group, checkbox, skeleton, tooltip, tabs)
- `components/stream/*` — chi-cloned primitives (`ThoughtBlock`, `ToolCallLine`, `MessageBubble`, `MessageList`, part grouping, scroll sentinel)
- `lib/stores/session.ts` — Zustand store (UI state only; truth lives in DO)

### 2.2 Parallel lanes (after 2.1 merges)

```
LANE A: Research backend                LANE B: Orchestrator + calendar
  lib/research/prompts.ts                lib/orchestrator/prompts.ts
  lib/research/tools.ts                  lib/orchestrator/tools.ts
  lib/research/anti-slop.ts              lib/generation/post.ts
  (extends SessionDO.startResearch)      lib/generation/image.ts
  app/api/chat/route.ts                  lib/generation/spotlight.ts
  app/api/chat/conversations/[sid]/      lib/rate-limit.ts
    route.ts                             (extends SessionDO.startCalendar + SSE)
                                         app/api/calendar/route.ts
                                         app/api/calendar/[sid]/stream/route.ts

LANE C: Screens 1 + 2                   LANE D: Screens 3 + 4
  app/page.tsx                           app/confirm/[sid]/page.tsx
  app/research/[sid]/page.tsx            app/calendar/[sid]/page.tsx
  components/research/HeroStrip.tsx      components/confirm/WedgeCard.tsx
  components/research/LiveLog.tsx        components/confirm/FactsStrip.tsx
  components/research/AskInline.tsx      components/confirm/Diagnosis.tsx
  components/research/ThinkingDot.tsx    components/confirm/NicheSignal.tsx
  components/ui/Favicon.tsx              components/confirm/ThemeList.tsx
  components/ui/SocialInputList.tsx      components/confirm/ChannelPicker.tsx
                                         components/calendar/MonthGrid.tsx
                                         components/calendar/DayCell.tsx
                                         components/calendar/DayModal.tsx
                                         components/calendar/SpotlightPill.tsx
                                         components/calendar/SpotlightToast.tsx
```

**Non-overlap rules:**
- Lane A only touches `app/api/chat/**`, `lib/research/**`.
- Lane B only touches `app/api/calendar/**`, `lib/orchestrator/**`, `lib/generation/**`, `lib/rate-limit.ts`.
- Lane C only touches `app/page.tsx`, `app/research/**`, `components/research/**`, `components/ui/Favicon.tsx`, `components/ui/SocialInputList.tsx`.
- Lane D only touches `app/confirm/**`, `app/calendar/**`, `components/confirm/**`, `components/calendar/**`.
- **Lanes A and B both extend SessionDO methods.** These are additive only — new methods, no rewrites. The class skeleton in §2.1 declares stubs so both can land without touching each other's method bodies.

**Shared-file rule:** any edit to a §2.1 file STOPS the lane and flags for coordination. Additive-only type extensions are fine; renames/removals require sync.

### 2.3 Merge order after parallel work

1. Lane A + B merge first. Curl-test both flows against fixture.
2. Lane C merges. Full flow Screen 1 → 2 with real research (or fixture).
3. Lane D merges. End-to-end with fixture, then live.
4. Live Apify + Nano Banana run for balanceyourbp.com. Debug, iterate.
5. Spotlight polish + demo rehearsal.

---

## 3. Domain Types (`lib/types.ts`) `[locked]`

```ts
export type SessionId = string;  // nanoid(12)

export type ChannelId =
  | 'tiktok' | 'instagram' | 'linkedin' | 'facebook'
  | 'x' | 'youtube' | 'threads' | 'pinterest' | 'gbp';

export type Social = {
  platform: ChannelId;
  handle: string;
  url: string;
};

// ──────────────────── Research phase ────────────────────

export type ResearchFact = {
  kind: 'icp' | 'offer' | 'voice' | 'channel' | 'competitor' | 'diagnosis' | 'trend' | 'insight';
  text: string;
  evidence: string;              // REQUIRED — empty evidence → fact is dropped (DESIGN.md §7.5)
  confidence: number;            // 0..1
};

export type ExistingPost = {
  platform: ChannelId;
  url: string;
  caption: string;
  likes?: number;
  comments?: number;
  views?: number;
  postedAt?: string;             // ISO date; used to render past posts on real calendar days
  isTopPerformer?: boolean;
};

export type Competitor = {
  handle: string;
  platform: ChannelId;
  topHook?: string;
  topPostUrl?: string;
  followers?: number;
};

export type ResearchOutput = {
  brand: { name: string; url: string; favicon: string };
  icp: ResearchFact;
  offer: ResearchFact;
  voice: ResearchFact;
  ownPosts: ExistingPost[];        // top 5–10, sorted by engagement
  competitors: Competitor[];       // 3–5
  diagnosis: ResearchFact[];       // 3–5 verdicts about THIS brand
  trends: ResearchFact[];          // niche-wide signals (Unicity space)
  suggestedThemes: string[];       // 3–5 channel-agnostic themes — feeds Screen 3 ThemeList
};

// ──────────────────── Calendar phase ────────────────────

export type PostVariant = {
  date: string;                    // ISO (real date in [today+1, today+30])
  channel: ChannelId;
  hook: string;                    // first line / attention grab
  body: string;                    // caption / script
  cta?: string;
  rationale: string;               // 1–2 sentences
  mediaUrl?: string;               // R2 public URL; undefined => placeholder color block
  mediaKind?: 'image' | 'video';
  reuseOf?: { kind: 'own' | 'competitor'; postUrl: string; hookText: string };
  trendSignal?: string;
  error?: { code: string; message: string };   // if generation failed but we kept the slot
};

export type CampaignPlan = {
  selectedChannels: ChannelId[];
  spotlightRef?: { date: string; channel: ChannelId };
  // no cadence, no themes — those are orchestrator-internal, not persisted UI state
};

// ──────────────────── Session (DO-resident) ────────────────────

export type SessionStatus =
  | 'researching'
  | 'ready_to_confirm'
  | 'generating'
  | 'done'
  | 'error';

export type SessionState = {
  sid: SessionId;
  websiteUrl: string;
  socials: Social[];
  status: SessionStatus;
  research?: ResearchOutput;
  plan?: CampaignPlan;
  posts: PostVariant[];            // append as generate_post resolves
  error?: string;
  startedAt: number;
};
```

The research-phase journal uses `SerializedPart[]` (text, reasoning, tool-call, tool-result) per `lib/serialized-parts.ts`, cloned from dpc `chi-message-parts.ts`. That journal is what the SSE replay reconstructs on page refresh via `buildUIMessages()`.

---

## 4. Streaming contracts (`lib/events.ts` + AI SDK v6)

Research phase uses the AI SDK's native UI-message stream — nothing custom. The client's `useChat` hook consumes it transparently; on reload, `GET /api/chat/conversations/:sid` returns the persisted `SerializedPart[]` and `buildUIMessages()` rehydrates the stream visually.

Calendar phase uses a small custom SSE union for the orchestrator's out-of-band events (shimmer allocation, per-post delivery, final spotlight). These are NOT AI-SDK tool parts because we want them decoupled from the orchestrator's chat transport.

```ts
// lib/events.ts
export type CalendarEvent =
  | { type: 'shimmer';       date: string; channel: ChannelId; ts: number }
  | { type: 'post';          post: PostVariant; ts: number }
  | { type: 'calendar_done'; spotlightRef: { date: string; channel: ChannelId }; ts: number }
  | { type: 'error';         message: string; ts: number };
```

**Wire format:** standard SSE. Each event = `data: <json>\n\n`. Heartbeat `:\n\n` every 15s.

**Replay:** `GET /api/calendar/:sid/stream` replays journaled events from DO storage, then streams live. Required for page refresh during generation.

---

## 5. API route contracts `[locked]`

### POST `/api/research`
Creates a session, returns its sid. Kicks off nothing yet — research starts when the client connects via `/api/chat`.

Req: `{ websiteUrl: string; socials: Social[] }`
Res: `{ sid: string }` (201)

### POST `/api/chat`
AI-SDK-driven streaming chat endpoint. First call on this sid seeds the research; subsequent calls carry `askUser` tool results back.

Req body: `{ messages: UIMessage[]; sid: string }` (sid injected by client's customFetch transport).
Res: `result.toUIMessageStreamResponse({ headers })` — native SSE.

### GET `/api/chat/conversations/:sid`
Replay endpoint. Returns persisted `SerializedPart[]` from the DO's research journal so the client can rehydrate via `buildUIMessages()` on page refresh.

### POST `/api/calendar`
Called on Screen 3 Approve. Starts the orchestrator inside the DO. Returns immediately; progress streams via SSE.

Req: `{ sid: string; selectedChannels: ChannelId[] }`
Res: `{ ok: true }`

### GET `/api/calendar/:sid/stream`
SSE subscription: replays journaled `CalendarEvent[]` then streams live. Ends with `calendar_done` or `error`.

**Deleted vs prior plan:** `POST /api/plan` (orchestrator handles cadence + themes), `POST /api/research/:sid/answer` (native HIL via `addToolOutput` replaces it), `GET /api/research/:sid/stream` (folded into `/api/chat`).

---

## 6. Data flow

### 6.1 Research (chat-style with native HIL)

```
[Screen 1] User enters websiteUrl + socials → POST /api/research
  → DO.createSession(sid, input) persists { websiteUrl, socials, status:'researching' }
  → client navigates to /research/[sid]
  → useChat mounts, sends initial user message auto-constructed from websiteUrl+socials
  → POST /api/chat routed to SessionDO.fetch()

[SessionDO.handleChat]
  → loads SerializedPart[] journal from SQLite
  → streamText({
      model: google('gemini-3-flash-preview'),
      system: RESEARCH_SYSTEM_PROMPT,   // §9.1 — includes askUser soft-require
      messages: buildLlmMessages(journal).concat(incomingUserMessage),
      tools: {
        scrapeWebsite,
        scrapeTikTokProfile,
        scrapeInstagramProfile,
        scrapeTikTokHashtag,
        askUser,                         // NO execute — native HIL
      },
      stopWhen: stepCountIs(20),
      providerOptions: { google: { thinkingConfig: { thinkingLevel: 'low', includeThoughts: true } } },
      onFinish: async ({ steps }) => {
        const parts = serializeStepContent(steps);
        await journal.append(parts);
        if (finalResearchOutput) {
          await sqlite.upsertResearch(finalResearchOutput);
          await sqlite.setStatus('ready_to_confirm');
        }
      },
    })
  → result.toUIMessageStreamResponse()

Client stream:
  - reasoning parts → ThoughtBlock ("Thinking..." / "Thought briefly")
  - scrape tool parts → ToolCallLine with ▸ spinner → ✓ check + thought signature ("Found 14 posts...")
  - askUser tool part (no execute) → AskInline form renders; user picks → addToolOutput({ tool:'askUser', toolCallId, output: { reply } })
  - AskInline collapses to "You: {reply}" line
  - Stream resumes (new /api/chat request with tool-result attached by useChat)
  - Final assistant text part → ResearchOutput delivered as JSON in a structured tool-result called `finalize_research`
  - Status flips to 'ready_to_confirm' → Screen 2 shows ConfirmCta
```

**ResearchOutput delivery:** rather than asking Gemini to end with a big JSON blob, we give the agent a `finalize_research` tool whose `execute` validates a zod schema matching `ResearchOutput` and persists to the DO. This is more reliable than text-mode JSON parsing and integrates with the journal pattern.

### 6.2 Nil / empty / error shadow paths

| Path | Behavior |
|---|---|
| Malformed URL on Screen 1 | 400 before session create. Client validates with URL constructor. |
| No socials provided | Research agent still runs; LLM may extract handles from site markdown. If none found, diagnosis centers on site content only. |
| Apify actor empty result (private socials) | Tool returns `{ ok:true, items:[] }`; LLM notes absence in synthesis ("No public TikTok activity found"). Never silent. |
| Apify timeout (>30s) | Tool returns `chiToolError({ code:'apify_timeout', ... })`; agent continues. ToolCallLine shows AlertCircle + "TikTok scrape timed out — proceeding without". |
| Missing APIFY_TOKEN | All apify tools short-circuit to `chiToolError({ code:'apify_not_configured' })`. If `DEMO_FALLBACK=1`, Research DO falls back to the fixture (per §11). |
| LLM tool-output fails zod validation | Structured error returned; agent retries 1× via natural reasoning; if still invalid, final `error` state. |
| Client disconnects SSE | AI SDK transport handles cleanup. DO continues persisting journal. Page refresh replays via `buildUIMessages()`. |
| askUser answered after DO hibernation | In-memory state is rebuilt from journal on rehydrate. The pending tool-call part stays in the journal; client resubmits the answer via normal useChat flow. |

### 6.3 Confirm (Screen 3)

No server work. Screen 3 is a read of `SessionState.research` from the DO via `GET /api/chat/conversations/:sid` (we extend this endpoint to optionally return the parsed ResearchOutput alongside the journal). User selects channels → Approve → POST /api/calendar.

### 6.4 Calendar generation (orchestrator + sub-agent)

```
Confirm approved → POST /api/calendar { sid, selectedChannels }
  → SessionDO.startCalendar(selectedChannels) via ctx.waitUntil()
  → DO sets status 'generating', journals selectedChannels

Inside the DO, run one streamText with the orchestrator:
  model: gemini-3-pro-preview  (or gemini-3-flash-preview with thinkingLevel:'high')
  system: ORCHESTRATOR_SYSTEM_PROMPT  (§9.2)
  messages: [{
    role: 'user',
    content: `Here is the confirmed research for ${brand}. Selected channels: ${selectedChannels}.
              Plan the next 4 weeks of content, one week at a time. For each week, call plan_week
              first, then generate_post for each slot in parallel (max 3 at a time). After all 4 weeks
              are generated, call pick_spotlight with the single most demo-worthy post.`
  }]
  tools: { plan_week, generate_post, pick_spotlight }
  stopWhen: stepCountIs(30)
  providerOptions.google.thinkingConfig: { thinkingLevel: 'high', includeThoughts: true }

Execution timeline:
  Week 1:
    → orchestrator thinks (thoughtSignature persisted)
    → plan_week({ weekNumber:1, slots:[...] })  — DO emits 'shimmer' SSE per slot
    → generate_post × N in parallel (capped by p-limit(3) inside tool execute)
       each: zod-validated args → generateObject(copy) → generateText(Nano Banana image)
             → R2.put → PostVariant → journal.appendPost → sseEmit({type:'post', post})
    → all week-1 tool results return to orchestrator's context
  Week 2–4: same pattern
  Finally:
    → pick_spotlight({ date, channel, rationale:{sentence,highlights}, evidenceChips:[...] })
    → DO persists spotlightRef, emits 'calendar_done'
```

**Rate-limit handling (generate_post):**
- Per-sid p-limit(3) semaphore wraps the Nano Banana 2 call (10 RPM preview tier).
- On 429: retry once with 2s backoff.
- On still-failing: emit PostVariant with `mediaUrl: null` + a deterministic placeholder color derived from the brand palette. Caption still generates. Fail-soft per DESIGN.md anti-slop — missing image is better than missing post.

**Parallelism knob:** p-limit is inside the tool, so the orchestrator can issue all 6 calls at once and the tool serializes them. This is simpler than asking the LLM to sequence them.

---

## 7. Error & rescue map

No thrown errors. All failures are structured values per dpc's convention:

```ts
// lib/errors.ts
export type ToolError = {
  error: true;
  error_code: string;
  message: string;
  recoverable: boolean;
  retry_safe: boolean;
  context?: Record<string, unknown>;
};

export function toolError(params: Omit<ToolError, 'error'>): ToolError {
  return { error: true, ...params };
}
```

Codes in use:
- `apify_not_configured`, `apify_timeout`, `apify_empty_result`
- `apify_rate_limited`
- `llm_parse_failed`, `llm_rate_limited`, `llm_content_blocked`
- `nano_banana_rate_limited`, `nano_banana_failed`
- `r2_put_failed`
- `session_not_found`, `session_expired`
- `invalid_input`

Rescue surface per codepath:

| Codepath | Failure | Rescue | User sees |
|---|---|---|---|
| `scrapeWebsite` | Actor timeout | 30s timeout; `toolError('apify_timeout')` | ToolCallLine AlertCircle + "Website fetch timed out" |
| `scrapeTikTokProfile` | User private / not found | `apify_empty_result` with items=[] | "No public TikTok activity found" fact in LLM synthesis |
| `scrapeInstagramProfile` | Same | Same | "No public IG activity found" |
| any apify | Missing token | `apify_not_configured` | Banner: "Apify not configured, using fixture" + demo proceeds via §11 |
| orchestrator tool | zod-invalid args | Return `invalid_input` to agent; LLM retries with corrected args | ToolCallLine shows warn, next attempt succeeds |
| `generate_post` Nano Banana | 429 | p-limit(3) + 1 retry + 2s backoff | Transparent to user |
| `generate_post` Nano Banana | Still failing | PostVariant with `mediaUrl:null`, caption intact | PostCard renders placeholder color block + caption |
| `generate_post` R2 PUT | Write failed | `r2_put_failed`; orchestrator may retry once | Same fallback as above |
| LLM research synthesis | Malformed finalize_research args | zod parse error fed back into stream; 1 retry | If persistent, `error` status + fixture fallback option |
| SSE client disconnect | Generator cleanup in `finally` | DO work continues | Reconnect replays journal |
| DO hibernation mid-turn | State rebuilds from SQLite journal on next request | Normal flow resumes | Transparent |

---

## 8. Apify wiring (`lib/apify.ts`)

```ts
import { ApifyClient } from 'apify-client/browser';
// browser bundle — no node streams/proxies; Workers-safe with nodejs_compat.

export async function scrapeWebsite(token: string, url: string):
  Promise<{ markdown: string; title: string } | ToolError>;
// Actor: apify/website-content-crawler   Input: { startUrls:[{url}], maxCrawlPages:3 }   ~free

export async function scrapeTikTokProfile(token: string, username: string):
  Promise<TikTokPost[] | ToolError>;
// Actor: clockworks/tiktok-scraper   Input: { profiles:[username], resultsPerPage:15 }   ~$0.05

export async function scrapeInstagramProfile(token: string, username: string):
  Promise<IGPost[] | ToolError>;
// Actor: apify/instagram-profile-scraper   Input: { usernames:[username], resultsLimit:12 }   ~$0.03

export async function scrapeTikTokHashtag(token: string, hashtag: string):
  Promise<TikTokPost[] | ToolError>;
// Actor: clockworks/tiktok-hashtag-scraper   Input: { hashtags:[hashtag], resultsPerPage:20 }   ~$0.10
```

All functions: 30s timeout, typed DTOs (not raw Apify JSON), structured errors. **Total per demo run: ~$0.20 Apify + ~$1.30 Nano Banana at 1K = ~$1.50.**

---

## 9. LLM prompt architecture

### 9.1 Research system prompt
Key requirements (full text in `lib/research/prompts.ts`):

- Role: "You are a senior marketing strategist researching a brand. You have tools. Use them deliberately. Surface non-obvious insights, not platitudes."
- Tool loop — use scrape tools as needed; call `finalize_research` with a zod-typed ResearchOutput as the last step.
- **askUser soft-require** `[locked]`: "You MUST call `askUser` exactly once during research, ideally about a real contradiction between the site's positioning and the brand's actual social content. If no contradiction exists, ask about a strategic preference (which audience to lean into, which tone to amplify, which channel to prioritize). Never ask about missing handles or data we can look up ourselves."
- Anti-slop ban list (DESIGN.md §7.5) — explicit prohibited phrases + required specificity:
  - Every ResearchFact must have non-empty `evidence` (URL or direct quote).
  - Every fact must contain at least one concrete number or named entity.
  - Banned phrases: "delve", "crucial", "robust", "comprehensive", "engage your audience", "authentic storytelling", "build community", "unlock the power of", filler adjectives, marketing-copywriter second person.
- Voice calibration: first-person singular ("I noticed…"), never "we" or third person.

### 9.2 Orchestrator system prompt (Calendar)

Key requirements (full text in `lib/orchestrator/prompts.ts`):

- Role: "You are a content strategist turning research into a month of concrete posts. Your research input is {research}. Selected channels: {selectedChannels}."
- Cadence hint: "Default target cadence TikTok 3/wk, Instagram 2/wk, LinkedIn 1/wk. Deviate if research suggests a different balance, but justify."
- Work rhythm: "Plan one week at a time. Call `plan_week` first to lock the slots. Then call `generate_post` for each slot. After all 4 weeks are complete, call `pick_spotlight` exactly once."
- Prompt shape for each generate_post: include the research theme being served, any `reuseOf` reference (with the exact hook text), any competitor/trend signal driving timing. The sub-agent uses this verbatim as its input context.
- Timing intuition: "When timing justifies itself by research (e.g., 3/7 distributors post Tuesday 6pm with 2.3× engagement), put the best post in that slot."
- Spotlight criteria: "pick the single post that (a) reuses a specific own-top-performer hook, and (b) has evidence-rich rationale you can write 2–3 sentences about with at least one quoted phrase and one concrete number."

### 9.3 Per-post copy generator (inside `generate_post.execute`)

`generateObject({ model: google('gemini-3-flash-preview'), schema: PostCopySchema, prompt })` where `PostCopySchema` = `{ hook, body, cta?, rationale, mediaPrompt }`.

- `mediaPrompt` is the prompt that will be handed to Nano Banana 2 for image generation — LLM decides the visual concept.
- Anti-slop validator runs as a regex check on `hook` + `body`. If ban list hits, retry once with `"Your previous draft used banned phrase X. Rewrite."` appended. Second fail → emit with `error.code='slop'` flag.

### 9.4 Spotlight picker

Called via `pick_spotlight` tool at the end of orchestrator flow. LLM returns `{ date, channel, rationale:{sentence,highlights}, evidenceChips[2..3] }`. DayModal consumes this shape directly (§10.4).

---

## 10. UI component tree (per-lane)

### Lane C — Screen 1 (`app/page.tsx`)

Big marketing header + URL input + repeating social inputs. Each social input detects platform on paste via hostname match against a registry (tiktok.com, instagram.com, x.com, facebook.com, linkedin.com, youtube.com, threads.net, pinterest.com). Matched platform shows Google s2 favicon inline. Extracted handle + platform go in payload.

```tsx
<main>
  <h1 className="font-serif text-3xl">Tell us about your brand.</h1>
  <p className="text-muted-foreground">Paste your site. Add any socials we should look at.</p>
  <UrlInput name="website" placeholder="yourbrand.com" required />
  <SocialInputList>
    <SocialInput />                       // empty; new row appears when filled
    …
  </SocialInputList>
  <ContinueCta disabled={!websiteValid} onClick={handleSubmit} />
</main>
```

Validation: URL must parse; normalize to https. At least one social is recommended but not required. Submit → `POST /api/research` → navigate to `/research/[sid]`.

### Lane C — Screen 2 (`app/research/[sid]/page.tsx`)

Chat-style stream using `useChat` with customFetch that injects `sid` into every request body (pattern cloned from dpc `chi-page-client.tsx`). On mount, auto-sends the seed user message built from the session's websiteUrl + socials.

**Hierarchy (top to bottom, weight-ordered):**
1. **Hero strip** (glass-regular, full-width): favicon + brand name + derived current-action headline from latest incomplete tool-call label (e.g., "Reading @balanceyourbp_ on TikTok"). ThinkingDot inline when ≥1 tool in-flight.
2. **MessageList** (the AI SDK UI-message stream): reasoning blocks, tool-call lines, fact-bearing text segments, all rendered via the chi-cloned `MessageBubble`.
3. **AskInline** detection: when the current assistant message contains a tool-call part with `toolName === 'askUser'` and `state === 'input-available'`, render an inline form (RadioGroup or Checkbox group + optional "Other" input per askUser schema). On submit: `addToolOutput({ tool:'askUser', toolCallId, output:{ reply } })` → useChat auto-resubmits and collapses the form to "You answered: {reply}".
4. **ConfirmCta** appears 500ms after `finalize_research` tool result arrives (equivalent to "research done"). Text: "See what I found →".

```tsx
<main>
  <HeroStrip brand={…} currentAction={latestUnmatchedToolLabel} thinking={anyInflight} />
  <MessageList messages={useChatMessages} />
  <ConfirmCta show={researchDone} delay={500} onClick={() => router.push(`/confirm/${sid}`)} />
</main>
```

LiveLog visual rendering per DESIGN.md §3 color semantics:
- `do_start` (tool-call pending) → amber left-accent bar + spinner
- `do_end` (tool-result success) → emerald left-accent bar + check + thought signature
- `do_end` (tool-result error) → amber bar + AlertCircle + "proceeded without X"
- `fact` text segments → blue left-accent bar + specific claim
- `askUser` tool-call → violet left-accent bar + inline form

Minimum 400ms between appearing fact lines (client-side throttle on render) so judges can read.

### Lane D — Screen 3 (`app/confirm/[sid]/page.tsx`)

Two-zone layout per DESIGN.md. Reads ResearchOutput from DO; no LLM call on mount.

**Zone 1 — WedgeCard (primary, above fold):** single large glass-regular card with editorial-serif headline from strongest `diagnosis` fact (confidence-sorted), italic pullquote of the fact's `evidence`, inline top-performer thumbnail with platform favicon + engagement counts. First-person voice.

**Zone 2 — FactsStrip:** three compressed glass-subtle chips. First-person headers.
- "I think you're selling to…" → ICP
- "Your offer is…" → Offer
- "You sound like…" → Voice

**Zone 3 — Diagnosis cards:** 2–3 mini-cards with [thumbnail | platform icon | engagement count] + one-line LLM diagnosis, tagged WORKING (emerald) or UNDERPERFORMING (amber). Max 3.

**Zone 4 — NicheSignal:** competitor list with favicon + handle + one distilled hook per competitor. Max 5.

**Zone 5 — ThemeList:** each theme chip from `research.suggestedThemes` shows its evidence source inline. "Medical dismissal · sourced from your April TikTok (40K views)".

**Zone 6 — ChannelPicker + ApproveButton:** shadcn Checkbox group with channel favicon + label + static cadence suggestion subtext ("TikTok 3/wk" — not LLM-generated). Default selected: tiktok, instagram, linkedin. Must have ≥1 selected. Approve → POST /api/calendar → navigate to /calendar/[sid].

```tsx
<main>
  <h1 className="sr-only">Did I get this right?</h1>
  <WedgeCard fact={strongestDiagnosis} evidence={…} post={referencedPost} />
  <FactsStrip icp={research.icp} offer={research.offer} voice={research.voice} />
  <Diagnosis extraFacts={diagnosis.slice(1)} posts={research.ownPosts} />
  <NicheSignal competitors={research.competitors} />
  <ThemeList themes={research.suggestedThemes} evidence={…} />
  <ChannelPicker onSelect={setSelectedChannels} default={['tiktok','instagram','linkedin']} />
  <ApproveButton disabled={selectedChannels.length === 0} onClick={approve} />
</main>
```

### Lane D — Screen 4 (`app/calendar/[sid]/page.tsx`)

**Single unified monthly calendar.** No channel tabs. No channel rows.

```tsx
<main>
  <Header brand={…} />
  <SpotlightPill show={!!spotlightRef} onClick={openSpotlight} />
  <MonthGrid
    month={viewingMonth}                     // default: current month
    onPrev={() => setViewingMonth(prev)}
    onNext={() => setViewingMonth(next)}
    today={Date.now()}
    posts={allPosts}                         // scraped past + generated future
    shimmerSlots={shimmerFromSse}            // (date, channel) pairs
    spotlightRef={spotlightRef}
    onDayClick={setSelectedDay}
  />
  {selectedDay && <DayModal day={selectedDay} posts={postsForDay} spotlightRef={spotlightRef} onClose={…} />}
  <SpotlightToast show={showToast} date={spotlightRef?.date} channel={spotlightRef?.channel} onOpen={openSpotlight} />
</main>
```

**MonthGrid shape:** standard 7-col × 5–6 row calendar. Header: `← {Month Year} →`. Arrows nav ±1 month. Today cell has a subtle ring around the day number. Days outside the viewing month render dim (context only).

**DayCell contents:**
- Day number, top-left
- Stack of channel favicons for that day's posts (both past scraped + future generated + shimmer-only)
- Spotlight day gets a gold ring + bright badge on the spotlight favicon
- Shimmer-only (no post yet) → pulsing favicon placeholder

**Click any DayCell** → opens DayModal. §10.4 specs the modal.

### Client state management (Screen 4)

Calendar screen opens SSE subscription to `/api/calendar/:sid/stream`. Events:
- `shimmer` → add `(date, channel)` to shimmer set → DayCell renders pulsing favicon
- `post` → replace shimmer with real PostVariant in `allPosts` map keyed by `(date, channel)` → DayCell renders the channel's favicon. If `mediaUrl` is present, DayModal will show the image.
- `calendar_done` → set `spotlightRef` + show `SpotlightToast` (if DayModal already open, don't yank focus; show toast with "Open" link). If DayModal closed, optional gentle auto-open after 1s — user-configurable.

On page refresh mid-generation: SSE replays all journaled events (shimmer, post, calendar_done) before going live. Grid rebuilds to current state.

---

## 10.4 DayModal / Spotlight spec (demo climax) `[locked]`

One `<DayModal>` component. Mode-switches based on whether active post matches `spotlightRef`.

**Base layout (every day click):**

```
┌────────────────────────────────────────────────────────────┐
│ [✕]                                      Apr 22, 2026     │
│ [🎵 active] [📷] [💼]                                      │  ← favicon tabs
├────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────┐                         │
│  │   [mediaUrl or placeholder]   │                         │
│  │                               │                         │
│  └───────────────────────────────┘                         │
│                                                            │
│  Hook:    "your doctor has 7 minutes"                      │
│                                                            │
│  Caption: (body…)                                          │
│                                                            │
│  CTA:     (optional)                                       │
│                                                            │
│                           [ Publish on TikTok (mocked) ]   │
└────────────────────────────────────────────────────────────┘
```

Favicon tabs across top: one per channel with a post on this day. Click tab → switches to that channel's PostVariant. Active tab highlighted.

**Spotlight-upgrade layout (when active post == spotlightRef):**

Right-side evidence panel slides in (250ms ease-out):

```
┌──────────────────────────────────┬─────────────────────────┐
│  [base layout above]             │ Why this post           │
│                                  │                         │
│                                  │ This reuses your top-   │
│                                  │ performing hook — "your │
│                                  │ doctor has 7 minutes" ──│┐
│                                  │ adapted for TikTok.     ││
│                                  │ Timed Tuesday 6pm       ││
│                                  │ because 3 of 7 Unicity ─││┐
│                                  │ distributors post then  │││
│                                  │ with 2.3× engagement.   │││
│                                  │                         │││
│                                  │ ┌─ Evidence ────────┐   │││
│                                  │ │ ● Top post 40K   ◀┘   │││
│                                  │ │   April 2026      │   │││
│                                  │ │                   │   │││
│                                  │ │ ● #unicity 3/7    ◀───┘│
│                                  │ │   Tue 6pm 2.3×    │    │
│                                  │ └───────────────────┘    │
└──────────────────────────────────┴──────────────────────────┘
```

- Rationale: 2–3 sentences. Phrases cited (`highlights[]`) are underlined + accent-color + linked to evidence chips via thin SVG connectors (animated draw on entrance).
- Evidence chips: 2–3 cards with thumbnail + label + URL. Each chip has an id matched by `highlights[].chipId`.
- The rich panel only renders when `activePost.date === spotlightRef.date && activePost.channel === spotlightRef.channel`.

**Entrance choreography:**
1. Orchestrator fires `calendar_done` → `spotlightRef` set → gold ring lands on the day cell (spring 400ms).
2. SpotlightToast appears ("Spotlight ready — Apr 22 TikTok") OR, if user's modal is already open elsewhere, toast only.
3. If user clicks the spotlight day: base modal mounts (300ms fade) → rich panel slides in (250ms) → rationale text line-by-line fade-in (150ms/line) → evidence connectors draw (300ms stroke-dashoffset).
4. Dismiss is reverse. Gold ring + SpotlightPill persist.

**Props shape for DayModal:**

```ts
<DayModal
  day={{ date: '2026-04-22' }}
  posts={Array<PostVariant>}                  // posts on this day (1..N channels)
  initialChannel={ChannelId}                  // which tab to open
  spotlightRef={{ date, channel } | undefined}
  onClose={() => void}
/>

// Spotlight rationale comes from pick_spotlight tool result, persisted on CampaignPlan:
type SpotlightPayload = {
  rationale: { sentence: string; highlights: Array<{ phrase: string; chipId: string }> };
  evidenceChips: Array<{ id: string; kind: 'own-post'|'competitor'|'trend'; label: string; url?: string; thumbnail?: string }>;
};
```

We extend `CampaignPlan.spotlightRef` to `spotlightRef?: { date; channel; payload: SpotlightPayload }` so the modal has everything it needs without extra fetches.

---

## 10.5 Visual state matrix

Each screen declares visual states for loading / empty / error / partial. Backend behavior in §7 — this table is pixel behavior.

| Surface | Loading | Empty | Error | Partial | Success |
|---|---|---|---|---|---|
| Screen 1 URL input | Button inline spinner + "Starting…"; field disabled | n/a | Red helper text below field (`Invalid URL`); field re-enabled | n/a | Brief check, route transitions |
| Screen 2 Hero strip | Skeleton favicon + "Starting…" until first tool call | n/a | Red headline "Apify not configured — using fixture" + info icon to §11 | Hero shows latest unmatched tool label; ThinkingDot pulses | Becomes "Research complete" on finalize_research tool result |
| Screen 2 Stream | "…" placeholder until first part | If 0 facts after 15s: inline "No public activity found — continuing with site + competitor signals" | Red tool-result line "X timed out". Terminal error: red banner + Retry button that re-POSTs /api/research | Mixed success/error tool parts coexist | Final assistant + finalize_research tool call completes |
| Screen 2 AskInline | n/a | n/a | If `addToolOutput` fails: red "This question expired" | Form visible, submit disabled until option chosen | On submit: collapses to "You answered: {reply}" line |
| Screen 3 Wedge | Skeleton card while Screen 2 → 3 transition | If `diagnosis[]` empty: fallback headline "Here's what I found" + no pullquote | If research incomplete: red banner "Research is still running — wait for it to finish" | n/a | Fully populated |
| Screen 3 ChannelPicker | n/a | All deselected: Approve disabled + helper "Select at least one channel" | n/a | ≥1 selected: chip border highlights | Approve enabled |
| Screen 4 Grid | On mount: empty month. As `shimmer` events arrive, cells pulse. As `post` events arrive, favicons land. | If no shimmer after 3s: "Orchestrator is planning…" ghost label in header | Per-post `error` PostVariant renders grayed + "Couldn't generate" mini-button. Terminal `error` event: red banner + Retry | Most common state — some cells populated, some shimmering, some empty (future) | `calendar_done` → gold ring + SpotlightToast |
| Screen 4 DayModal | n/a | n/a | If active PostVariant has `error`: modal shows "Couldn't generate — retry" + mini-button | Rich panel hidden until spotlight active | Full spotlight layout |

**Principle:** empty states are features. Error states show the specific code-mapped message, not "Something went wrong." Loading states use skeletons calibrated to the expected shape.

---

## 10.45 Resolved ambiguities

- **Log auto-scroll:** MessageList pins to latest by default (sentinel-based, IntersectionObserver per dpc `message-list.tsx:23–48`). If the user scrolls up, pinning breaks; "Jump to latest" floating button appears.
- **SSE reconnect (research):** handled by AI SDK transport; the stream just resumes. Visual: Hero sub-label shows "Reconnecting…" briefly.
- **SSE reconnect (calendar):** GET /api/calendar/:sid/stream replays the journaled events, then goes live.
- **Favicon component:** Google s2 URL (`https://www.google.com/s2/favicons?sz=64&domain=<host>`). Fallback on 404: colored square tile with first letter (brand color background, foreground letter). Never show a broken image.
- **ConfirmCta timing:** 500ms delay after `finalize_research` so the last fact registers.
- **Month nav:** ← and → advance by calendar month. Keyboard: arrow keys when grid is focused.
- **DayCell click target:** whole cell, not just the favicons. Empty future day cells (no post scheduled) are non-interactive.
- **SpotlightToast vs auto-open:** default is toast-only ("Open"). If DayModal is NOT already open AND user-configurable "auto-open spotlight" setting is on (defaulted on for demo), the modal auto-opens on calendar_done after a 600ms breathe delay.

---

## 10.55 Emotional arc

Three emotional peaks. Each has a designed visual moment that must land.

| Peak | Time | What user feels | Visual moment |
|---|---|---|---|
| Agent is thinking | 0:05–0:45 | "This isn't a prompt wrapper" | Hero headline updates per tool. ThinkingDot pulses. Tool-call lines stream. Thought blocks expand mid-flight, collapse to "Thought briefly" when done. Minimum 400ms between facts. Specific counts everywhere. |
| Agent is talking to me | ~0:35 | "It noticed a contradiction about MY brand" | AskInline fades in (200ms) with violet left-accent bar. First-person headline. Concrete options, not open-ended prompts. |
| Agent understood me | 2:15–2:45 | "It tied this back to my actual top post" | Gold ring lands on the spotlight day cell (spring 400ms). Grid dims to 40% around it. 600ms breathe. DayModal opens with base layout. Rich "Why this post" panel slides in. Rationale line-by-line. Connectors draw. |

The intermediate climax (0:45–1:00) on Screen 3 is the WedgeCard reveal. Transition into /confirm uses crossfade (300ms), not slide.

---

## 10.6–10.8 Design language (deferred to DESIGN.md)

See `DESIGN.md`:
- §2 Typography — Inter + Instrument Serif
- §3 Color + state tokens
- §3.5 Apple Liquid Glass material (four tiers) and surface-to-tier mapping
- §4 Spacing, radius, elevation scale
- §5 Motion
- §6 Component vocabulary (shadcn primitives + custom)
- §7 Anti-slop hard rules (chrome)
- §7.5 Anti-slop rules for LLM-generated content (critical for LLM prompts)
- §7.6 shadcn default overrides to wire Liquid Glass
- §8 A11y baseline

PLAN.md does NOT redefine any of the above. Engineering references DESIGN.md as source of truth.

---

## 11. Mock fixtures strategy

`lib/fixtures/balanceyourbp.ts` exports a full `ResearchOutput` + `PostVariant[]` + `spotlightRef` with SpotlightPayload for the demo brand. Used when:

- `APIFY_TOKEN` missing (any apify call returns `apify_not_configured`)
- `?fixture=1` query param on Screen 1
- `DEMO_FALLBACK=1` env set AND any apify call fails mid-research

When fixture mode engages mid-research, the DO replaces its ResearchOutput with the fixture's and emits a synthetic completion. Calendar still runs live against Nano Banana 2 — fixture provides structure, orchestrator fills in fresh copy + images.

Hand-crafted balanceyourbp fixture is authoritative demo backup. ~30 minutes of careful writing.

---

## 12. Test scope (hackathon)

What we test:

- **`lib/apify.ts` — one integration test** against website-content-crawler on balanceyourbp.com. Run once, verify token + network. Not in CI.
- **`lib/types.ts` — zod schemas** for every domain type. Parse the fixture against each schema. If it passes, the contract is real.
- **`lib/fixtures/balanceyourbp.ts` — schema test** — fixture parses against ResearchOutput + PostVariant schemas.
- **`lib/research/anti-slop.ts` — regex tests** on ban-list matching (DESIGN.md §7.5). Positive + negative cases.
- **Prompt snapshot tests** — inline expected-shape assertion on one research synthesis + one orchestrator week-plan, run manually once against live API.

What we skip: E2E Playwright, UI component unit tests, full coverage reports.

**Regression rule ignored** — no prior tests exist.

---

## 13. Observability

- **Journal is telemetry.** Every SerializedPart (research) and CalendarEvent (calendar) is persisted in the DO's SQLite. Post-demo debugging walks the journal.
- `console.log('[research:{sid6}] ...')` and `console.log('[calendar:{sid6}] ...')` at every tool boundary. Cloudflare's `wrangler tail` streams them live during demo rehearsal.
- One dev-only `GET /api/debug/:sid` endpoint dumps the DO's full state + journals as JSON. Guarded by `env.DEMO_FALLBACK === '1' || env.DEV === '1'`; 404 otherwise.

No Sentry, no analytics. Hackathon.

---

## 14. Deployment

**Target: Cloudflare Workers** via `@opennextjs/cloudflare`.

- One Worker, one DO class (`SessionDO`), one R2 bucket (`gtm-agent-images`).
- `compatibility_date: "2025-03-01"`, `compatibility_flags: ["nodejs_compat", "global_fetch_strictly_public"]`.
- Secrets: `GOOGLE_GENERATIVE_AI_API_KEY`, `APIFY_TOKEN`. Set via `wrangler secret put <name>`.

**Build + deploy:**

```bash
bun run build           # next build → .open-next
bun run deploy          # @opennextjs/cloudflare deploy (wraps wrangler deploy)
```

**Local dev (two modes):**

```bash
# Mode 1: Next dev — fast UI iteration, stubbed DO (in-memory singleton)
bun dev
# uses initOpenNextCloudflareForDev() so env bindings work; SessionDO is imported as a plain class

# Mode 2: Full worker dev — wrangler dev with DO-backed SessionDO
bun dev:worker          # wraps `opennextjs-cloudflare build && wrangler dev --persist-to .wrangler/state`
# Persist-to is important so DO SQLite + R2 survive restart during iteration.
```

Mode 1 for most UI work. Mode 2 for integration + SSE behavior. Both accept the same `.dev.vars` file with secrets.

`.dev.vars` (gitignored):
```
GOOGLE_GENERATIVE_AI_API_KEY=...
APIFY_TOKEN=apify_api_...
DEMO_FALLBACK=1
```

No migrations. No cron. No secrets manager. One R2 bucket, created once via `wrangler r2 bucket create gtm-agent-images && wrangler r2 bucket enable-public-access gtm-agent-images` (or via dashboard).

---

## 15. What's NOT in scope

- Real social posting (FB/IG/X APIs). All posting UI is mocked.
- Auth, multi-tenant, login.
- Persistence across DO eviction beyond SQLite journal (sessions survive hibernation; not 30+ day retention).
- Mobile responsive polish. Desktop demo only, min 1280×800.
- Dark mode.
- Video generation on every post — Veo reserved for Spotlight only, optional stretch.
- Custom R2 domain (`pub-xxxxx.r2.dev` is fine for demo).
- Cloudflare Images product (R2 public bucket is sufficient).
- Full WCAG AA audit.
- i18n, print styles, RTL.
- Ambient motion, parallax, cursors.
- A/B variants of anything.
- Predicted engagement scores on generated posts (slop-y).
- Post scheduling backend, cron, email alerts.
- Mobile/iOS/Android apps.
- Analytics, Sentry.
- Brands other than balanceyourbp — generic URL input works but is not guaranteed for every brand shape.

---

## 16. What already exists

Nothing. Greenfield cwd. Repo initialized during §2.1.

**References copied/adapted from dpc (`~/Documents/github.com/deepcontext/dpc`):**
- `chi-message-parts.ts` → our `lib/serialized-parts.ts` (verbatim structure, minor renames)
- `chi-thought-process.tsx` → our `components/stream/ThoughtBlock.tsx` + `ToolCallLine.tsx`
- `message-bubble.tsx` grouping logic → our `components/stream/MessageBubble.tsx`
- `message-list.tsx` sentinel scroll → our `components/stream/MessageList.tsx`
- `chi-page-client.tsx` customFetch + reload pattern → our `app/research/[sid]/page.tsx`
- `wrangler.jsonc`, `open-next.config.ts`, `next.config.ts` → our root configs
- `chi-tools.ts` tool factory + structured error shape → our `lib/research/tools.ts` + `lib/orchestrator/tools.ts`

---

## 17. Demo script (3 minutes)

1. **(0:00)** "You give this a website…" — paste `balanceyourbp.com` + optionally TikTok/IG URLs → Go.
2. **(0:05–0:40)** Research stream. Tool-call lines appear one by one: scrape site → found Unicity distributor → scrape TikTok (14 posts, top one 40K views) → scrape IG → search #unicity (7 other distributors). Thought blocks expand briefly between calls ("Thinking about audience contradictions…").
3. **(0:40–0:50)** AskInline fires: *"Your website emphasizes blood pressure management for 50+, but your TikTok top hits are from a wellness-millennial angle. Which audience do we lean into?"* User picks one option inline. Form collapses to "You answered: 50+ primary, millennial secondary."
4. **(0:50–1:05)** Stream wraps with finalize_research. ConfirmCta appears.
5. **(1:05–1:30)** Click Confirm. WedgeCard lands: *"Your unique wedge: medical dismissal is the tension your top posts exploit and your competitors avoid."* Pullquote: *"your doctor has 7 minutes — 40K views"*. Judges read. User picks channels, clicks Approve.
6. **(1:30–2:30)** Navigate to Calendar. Month grid renders empty. Shimmer appears on Week 1 slots (orchestrator `plan_week` fires). Generate_post tool calls complete every 5–10s — favicons land in cells. Week 2, Week 3, Week 4 follow. Thought blocks in a side strip show orchestrator reasoning: *"Reusing the medical dismissal hook on Tuesday 6pm because…"*.
7. **(2:30–2:50)** `calendar_done` fires. Gold ring lands on the spotlight day. SpotlightToast appears. User clicks → DayModal opens with base layout, rich "Why this post" panel slides in. Rationale animates line-by-line. Connectors draw to evidence chips. Judges see: *"This reuses your top-performing hook — 'your doctor has 7 minutes' — adapted for TikTok. Timed Tuesday 6pm because 3 of 7 Unicity distributors post then with 2.3× engagement."*
8. **(2:50–3:00)** Close modal. Scroll calendar. "This took 90 seconds — a human marketer would take two weeks." Done.

Timing note: calendar fully populating in ~60s is achievable because we have ~15 posts (not 90) and Nano Banana 2 at p-limit(3) yields ~5 posts/minute. Acceptable but tight — rehearse with fresh Apify data at least twice before demo.

---

## 18. Parallel execution launch order

```
T=0:00   Solo: init repo + §2.1 shared contracts + fixture                  (30 min)
          └─ commit "scaffold + contracts"
T=0:30   Launch 4 parallel agents on same workdir, each lane                (120 min)
          ├─ Lane A: research backend
          ├─ Lane B: orchestrator + calendar
          ├─ Lane C: screens 1–2
          └─ Lane D: screens 3–4
T=2:30   Merge A + B. Curl-test against fixture. Fix contract drift.        (20 min)
T=2:50   Merge C. Full flow 1→2→3 with fixture.                              (15 min)
T=3:05   Merge D. End-to-end with fixture. Wire live Apify.                 (20 min)
T=3:25   Live run for balanceyourbp.com. Image gen. Debug.                  (25 min)
T=3:50   Spotlight polish + demo rehearsal.                                 (20 min)
T=4:10   Demo.
```

Total budget widened from 3h to 4h10m reflecting review scope. If time pressure forces cuts: drop Veo (already stretch), drop eval hook for anti-slop (fall back to prompt-only), drop past-posts-in-past-cells rendering.

**Contract drift mitigation:** every lane imports types from `lib/types.ts`, `lib/events.ts`, `lib/serialized-parts.ts` only. Additive-only changes. Breaking edits require coordination.

---

## 19. Open decisions (confirm before §2.1 starts)

1. **Orchestrator model:** `gemini-3-pro-preview` (stronger timing intuition, 2× cost) vs `gemini-3-flash-preview` with `thinkingLevel:'high'` (cheaper, fast enough for demo). **Default: Flash-high; benchmark Pro post-scaffold.**
2. **Spotlight Veo video:** in or out? **Default: out; implement if time remains at T=3:50.**
3. **Fixture investment:** 30 minutes hand-crafting balanceyourbp fixture for excellent fallback demo? **Recommended: yes.**
4. **Auto-open spotlight modal:** yes/no by default on `calendar_done`? **Default: yes for demo; toggle in URL (`?noautoopen=1`).**

---

## 19.5 Design: what exists, what's out of scope

**What already exists (reuse, don't reinvent):**

- `DESIGN.md` — full design system. Source of truth.
- shadcn/ui primitives (install during §2.1).
- Apple Liquid Glass tokens in `globals.css` per DESIGN.md §3.5.
- `next/font` Google font loaders for Instrument Serif + Inter.
- Google s2 favicon lookup.
- dpc chi primitives cloned as §2.1 components.

**Design deferred (NOT in scope):**

- Mobile responsive layouts.
- Dark mode.
- Custom illustration / iconography (Lucide via shadcn covers it).
- Full WCAG AA audit.
- Print styles, i18n, RTL.
- Ambient motion.
- Multi-brand theming.

---

## 20. Failure modes that would kill the demo

| Mode | Probability | Mitigation |
|---|---|---|
| Apify actor blocked mid-demo | Med | Fixture fallback auto-engages via `DEMO_FALLBACK=1` |
| Gemini rate limit hit (research) | Low | Tier 1 Flash = thousands/min; pre-warm 1 run before demo |
| Nano Banana 2 rate limit (429 storm) | Med | p-limit(3) + retry + placeholder color block fallback |
| Nano Banana 2 generates blocked content | Low | Retry 1× with refined prompt; fallback to no-image PostVariant |
| R2 PUT transient failure | Low | Retry 1×; fallback to inline data URL for that one image |
| balanceyourbp socials go private | Low | Fixture authored as authoritative backup |
| LLM generates slop | Med | DESIGN.md §7.5 ban list + post-gen regex + retry (§9.3); fact-level `evidence` required |
| Cloudflare Worker cold start | Low | Keep a tab open; hit `/` 30s before demo |
| DO hibernation mid-demo | Low | Journal rehydrates on next request — transparent |
| SSE breaks behind venue WiFi | Low | Demo from tethered 5G; fallback polling is NOT built (skip) |
| OpenNext build surprise | Low | Lock OpenNext + wrangler versions in package.json; verify `bun run deploy` at T=2:30 merge point |

---

Plan is complete. Ready for parallel execution.

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR (PLAN) | 12 architectural issues resolved; 3 stale sections rewritten; stack migrated Vercel→Cloudflare+DO; calendar simplified to orchestrator+week-by-week; full PLAN.md consolidation pass applied |
| Design Review | `/plan-design-review` | UI/UX gaps | 1 | CLEAR (FULL) | score 6/10 → 10/10, 18 decisions, 0 unresolved (Apple Liquid Glass material system) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0

**VERDICT:** DESIGN + ENG CLEARED — ready for parallel implementation. Recommend running `/codex review` once on this rewritten plan before kickoff as outside-voice sanity check.
