# 01 — Scaffold + shared contracts

> **Do not run tickets 02–05 until this is merged.** Everything imports from the contracts this ticket establishes. Run this solo, commit, then launch the four lanes in parallel.

**Depends on:** none.
**Blocks:** 02, 03, 04, 05, 06.
**Estimated effort:** CC ~30 min. Longer because the fixture takes care.

## Why

Establishes the shared types, Durable Object skeleton, wrangler config, design tokens, shadcn primitives, chi-cloned stream components, and hand-crafted fallback fixture. No lane can start without this.

## Scope (files to create)

### Repo init

- `bun create next-app` (TypeScript strict, Tailwind v4, App Router)
- `bun add ai @ai-sdk/google @ai-sdk/react apify-client zustand zod nanoid`
- `bun add -d @opennextjs/cloudflare wrangler @cloudflare/workers-types`

### Cloudflare + Next config

- `wrangler.jsonc` — per [PLAN.md §1](../PLAN.md). Bindings: `SESSION_DO` Durable Object, `IMAGES` R2 bucket, `ASSETS`. Compat flags: `nodejs_compat`, `global_fetch_strictly_public`. Compat date: `2025-03-01`.
- `open-next.config.ts` — minimal `defineCloudflareConfig({})`.
- `next.config.ts` — `images.unoptimized: true`, `initOpenNextCloudflareForDev()`.
- `package.json` scripts: `dev`, `dev:worker`, `build`, `deploy`, `cf-typegen`.
- `.dev.vars.example` with `GOOGLE_GENERATIVE_AI_API_KEY`, `APIFY_TOKEN`, `DEMO_FALLBACK=1`.
- `.gitignore` must include `.dev.vars`, `.wrangler`, `.open-next`.

### Shell

- `app/layout.tsx` — Inter + Instrument Serif via `next/font/google`, wired as CSS variables `--font-sans` and `--font-serif`.
- `app/globals.css` — DESIGN.md §3 color tokens + §3.5 glass-tier CSS variables + `@layer components` glass utility classes (`.glass-subtle`, `.glass-regular`, `.glass-heavy`, `.glass-ultra`) + `prefers-reduced-transparency` opaque fallback + body gradient mesh backdrop.
- `tailwind.config.ts` — extend theme with `fontFamily` (sans=var(--font-sans), serif=var(--font-serif)), `borderRadius` tokens (`chip`, `input`, `card`, `modal`, `hero`), color aliases from CSS vars.

### shadcn primitives (`components/ui/*`)

Install with `bunx shadcn@latest add <name>`:

- `button input textarea label card badge separator dialog radio-group checkbox skeleton tooltip tabs`

After install, apply DESIGN.md §7.6 overrides:

- Button: `bg-foreground text-background rounded-input`, secondary variant `.glass-subtle`.
- Input: `.glass-subtle rounded-input` + focus ring via `--ring-focus`.
- Card: drop default `shadow-sm`, use `.glass-regular rounded-card`.
- Dialog: overlay `bg-black/40 backdrop-blur-sm`, content `.glass-ultra rounded-modal`, drop `shadow-lg`.

### Stream primitives (`components/stream/*`)

Clone from dpc (`~/Documents/github.com/deepcontext/dpc/apps/web/src/components/chi/`) — ignore `.claude/worktrees/` duplicates:

- `ThoughtBlock.tsx` — from `chi-thought-process.tsx:120–162`.
- `ToolCallLine.tsx` — from `chi-thought-process.tsx:182–243`. Update `TOOL_LABELS` to our tool names: `scrapeWebsite → "Reading website"`, `scrapeTikTokProfile → "Reading @{handle} on TikTok"`, `scrapeInstagramProfile → "Reading @{handle} on Instagram"`, `scrapeTikTokHashtag → "Searching #{tag} on TikTok"`, `askUser → "Asking you"`, `finalize_research → "Synthesizing"`, `plan_week → "Planning week {N}"`, `generate_post → "Writing {channel} post for {date}"`, `pick_spotlight → "Picking spotlight"`.
- `getThoughtSignature(toolName, result)` — per-tool one-liner. Examples: `scrapeTikTokProfile → "Found ${N} posts, top at ${K} views"`, `plan_week → "Planned ${N} slots for week ${W}"`, `generate_post → "Wrote ${channel} post for ${date}"`.
- `MessageBubble.tsx` — from `message-bubble.tsx`, with `groupPartsForRendering`.
- `MessageList.tsx` — from `message-list.tsx` with IntersectionObserver sentinel auto-scroll.
- Helpers: `normalizeToolPart`, `isToolPart`, `isToolFailure` from `chi-thought-process.tsx:80–112, 172–180`.

### Types and contracts

- `lib/types.ts` — every type from [PLAN.md §3](../PLAN.md). Export zod schemas alongside each type (use `z.infer<typeof X>` to derive the TS type, keep the schema as the source of truth).
- `lib/events.ts` — `CalendarEvent` union per [PLAN.md §4](../PLAN.md).
- `lib/serialized-parts.ts` — clone from `apps/web/src/lib/chi-message-parts.ts`. Export: `SerializedPart` union, `serializeStepContent(steps)`, `buildLlmMessages(serializedParts)`, `buildUIMessages(rawMessages)`, `hasToolOutputWithKey`.
- `lib/errors.ts` — `ToolError` type + `toolError({code, message, recoverable, retry_safe, context?})` factory. Error code string union matching [PLAN.md §7](../PLAN.md).

### DO skeleton

- `lib/session-do.ts` — class `SessionDO` extending `DurableObject`. SQLite schema:

  ```sql
  CREATE TABLE IF NOT EXISTS session (sid TEXT PRIMARY KEY, state TEXT NOT NULL, updated_at INTEGER);
  CREATE TABLE IF NOT EXISTS research_journal (idx INTEGER PRIMARY KEY AUTOINCREMENT, part TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS calendar_journal (idx INTEGER PRIMARY KEY AUTOINCREMENT, event TEXT NOT NULL);
  ```

  RPC stubs (empty bodies OK for now; Lanes A and B fill them in):

  - `async createSession(sid: string, input: { websiteUrl: string; socials: Social[] }): Promise<void>`
  - `async getSessionState(): Promise<SessionState | null>`
  - `async handleChat(request: Request): Promise<Response>` — Lane A
  - `async getResearchReplay(): Promise<{ researchOutput?: ResearchOutput; journal: SerializedPart[] }>` — Lane A
  - `async startCalendar(selectedChannels: ChannelId[]): Promise<void>` — Lane B
  - `async subscribeCalendar(request: Request): Promise<Response>` — Lane B

  Export `export class SessionDO ... ; export default SessionDO;`.

### LLM + infra helpers

- `lib/llm/google.ts` — `createGoogleGenerativeAI({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY })`. Export `MODEL_IDS`:

  ```ts
  export const MODEL_IDS = {
    RESEARCH: 'gemini-3-flash-preview',
    ORCHESTRATOR: 'gemini-3-flash-preview', // thinkingLevel:'high'; swap to pro post-benchmark
    COPY: 'gemini-3-flash-preview',
    IMAGE: 'google/gemini-3.1-flash-image-preview', // Nano Banana 2
    VIDEO: 'google/veo-3.1-generate-001',
    UTIL: 'gemini-3.1-flash-lite-preview', // cheap one-shots
  } as const;
  ```

  Export `RESEARCH_PROVIDER_OPTIONS` and `ORCHESTRATOR_PROVIDER_OPTIONS` with correct `thinkingConfig`.

- `lib/apify.ts` — export async functions `scrapeWebsite`, `scrapeTikTokProfile`, `scrapeInstagramProfile`, `scrapeTikTokHashtag`. Import `ApifyClient` from `apify-client/browser`. 30s timeouts. Structured errors via `toolError()`. Bodies can be stubs returning fixture data if `DEMO_FALLBACK=1` OR token missing — actual live wiring is Lane A's job.

- `lib/r2.ts` — `export async function putImage(env: Env, key: string, bytes: Uint8Array | ArrayBuffer, contentType = 'image/png'): Promise<string>`. Uses `env.IMAGES.put(...)` and returns `${env.R2_PUBLIC_URL}/${key}` (public URL is configured via env var; instructions in the ticket for setting `r2.dev` subdomain on the bucket).

### Fixture

- `lib/fixtures/balanceyourbp.ts` — FULL fixture:

  - `ResearchOutput` with 3–5 diagnosis facts, 3+ suggestedThemes, 3+ competitors, 5+ ownPosts
  - `PostVariant[]` — ~15 posts across tiktok+instagram+linkedin, real ISO dates in a rolling 30-day window from an anchor date (document the anchor in a comment; update before demo)
  - `spotlightRef` + `SpotlightPayload` with rationale + 2 evidence chips
  - All text written to pass DESIGN.md §7.5 anti-slop — numbers, named entities, direct quotes in evidence, first-person agent voice, no banned phrases

### Client store

- `lib/stores/session.ts` — Zustand store with:

  ```ts
  selectedDay?: string
  viewingMonth: { year: number; month: number }
  shimmerSlots: Set<string>  // "YYYY-MM-DD:channel"
  postsMap: Map<string, PostVariant>  // key "YYYY-MM-DD:channel"
  spotlightRef?: { date: string; channel: ChannelId; payload: SpotlightPayload }
  spotlightToastOpen: boolean
  // actions: addShimmer, addPost, setSpotlight, openDay, nav prev/next month
  ```

## Acceptance

- `bun run build` passes with no type errors.
- `bun x tsc --noEmit` clean.
- `wrangler deploy --dry-run` succeeds (verifies bundle + bindings).
- `bun dev` serves an empty home page. Inspect: Inter loaded, Instrument Serif loaded, `.glass-regular` applies backdrop-filter.
- `bunx vitest run` passes a quick snippet that `ResearchOutput.parse(fixture)` and `PostVariant.parse(fixture.posts[0])` succeed.
- Commit: `"scaffold: shared contracts, design tokens, chi stream primitives, fixture"`.

## Watch-outs

- shadcn CLI may fight Tailwind v4's `@theme` syntax. If it does, initialize shadcn against a temp Tailwind v3 config, then manually port components to v4. Budget 15 min for this gotcha.
- Cloning dpc stream primitives: the `@ai-sdk/react` v3 and `ai` v6 imports must match — check dpc's `package.json` for exact versions before pinning.
- `apify-client/browser` may require the compat date to be ≥ 2024-09-23 — we're at 2025-03-01, fine.
- R2 public bucket: must `wrangler r2 bucket create gtm-agent-images` + `wrangler r2 bucket dev-url enable gtm-agent-images` (or via dashboard) BEFORE deploy. Document the resulting `pub-xxxxx.r2.dev` URL in `.dev.vars.example` as `R2_PUBLIC_URL`.

## Do NOT

- Write any research/orchestrator prompts (that's Lane A/B).
- Build any Screen UI beyond the stream primitives (that's Lanes C/D).
- Start the apify/Gemini wire-up beyond stubs (that's Lanes A/B).
