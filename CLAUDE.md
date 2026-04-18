# CLAUDE.md

Guidance for Claude Code agents working in this repo.

## Context

Hackathon MVP. **3-hour budget.** Marketing agent: URL in → research + diagnosis → 30-day multi-channel content calendar. Demo brand: `balanceyourbp.com` (Unicity distributor, TikTok `@balanceyourbp_`, Instagram `@greg_hoyd`).

**Read `PLAN.md` before writing any code.** It is the authoritative architecture + contract document. If your work conflicts with PLAN.md, stop and flag — do not silently diverge.

**Read `NOTES.md`** for product decisions and fixture rationale.

## Parallel lane discipline

Multiple agents work on this repo simultaneously. The rules that make that safe:

1. **§2.1 shared contracts land first, in one solo commit.** No lane starts until `lib/types.ts`, `lib/events.ts`, `lib/session-store.ts`, `lib/sse.ts`, `lib/apify.ts`, `lib/llm.ts`, `lib/fixtures/balanceyourbp.ts`, and the shell (`app/layout.tsx`, shadcn primitives) are in.

2. **Each lane owns a non-overlapping directory tree.** See PLAN.md §2.2.
   - Lane A: `app/api/research/**`, `lib/research/**`
   - Lane B: `app/api/plan/**`, `app/api/calendar/**`, `lib/plan/**`, `lib/calendar/**`
   - Lane C: `app/page.tsx`, `app/research/**`, `components/research/**`
   - Lane D: `app/confirm/**`, `app/calendar/**`, `components/confirm/**`, `components/calendar/**`

3. **If your lane must edit a file outside its tree, STOP and flag.** That's a coordination event, not a unilateral edit. Shared files in §2.1 are frozen during parallel work — only additive changes to type unions are allowed.

4. **Import types from `lib/types.ts` and `lib/events.ts` only.** Do not duplicate domain types in lane-local files. If you need a new shape, propose adding it to shared types — don't invent a parallel type.

5. **SSE event union is the coupling surface.** Backend lanes (A, B) emit events; frontend lanes (C, D) consume them. Both sides import the same `AgentEvent` union. Additive-only during parallel work.

## Stack

- Next.js 15 App Router, TypeScript strict, `runtime: 'nodejs'` (NOT edge — apify-client needs Node)
- Vercel AI SDK (`ai`) + `@ai-sdk/anthropic`, model `claude-sonnet-4-6`
- `apify-client` (REST wrapper, not MCP inside the app)
- Tailwind v4 + shadcn/ui
- Zustand for client state
- Native SSE via `Response` + `ReadableStream`
- In-memory `Map<sid, SessionState>` — no DB, no queue, no auth

## Commands

```bash
bun install                  # or pnpm i
bun dev                      # Next.js dev server on :3000
bun run build                # production build (must pass before ship)
bun x tsc --noEmit           # type check, should be clean
```

No test suite yet. Manual curl-test against fixture before live Apify.

## Environment

`.env.local` required:
```
ANTHROPIC_API_KEY=sk-ant-...
APIFY_TOKEN=apify_api_...
DEMO_FALLBACK=1
```

If `APIFY_TOKEN` is missing, the app falls back to `lib/fixtures/balanceyourbp.ts` automatically — see PLAN.md §11. This is intentional, not a bug.

## Engineering rules (hackathon-weighted)

- **Completeness over shortcuts** when the delta is minutes. AI-assisted coding makes boilerplate near-free. Write the handler that handles the error.
- **No catch-all error handling.** Named error classes only (`ApifyTimeoutError`, `LLMParseError`, `SessionNotFoundError`, etc). See PLAN.md §7.
- **Every SSE event type is in `lib/events.ts`.** No ad-hoc event shapes.
- **Anti-slop rule in LLM prompts.** Ban "engage your audience", "build community", "authentic storytelling", "delve", "crucial", "robust". Require citations of specific scraped content in every `ResearchFact`.
- **One spotlight post per run**, chosen by a dedicated LLM call after all post variants are generated.
- **Log with session prefix:** `console.log(\`[research:\${sid.slice(0,6)}] ...\`)` at every tool boundary.

## Scope cuts (do NOT implement)

See PLAN.md §15 for the full list. The short version:
- No real social posting — all channel POST UI is mocked
- No auth, no persistence across server restart
- No mobile polish — desktop demo only
- No unit tests for UI components
- No image/video generation, no A/B variants, no predicted engagement scores

If you feel tempted to add one of these, re-read PLAN.md §15 and step away.

## Apify actors (confirmed, see PLAN.md §8)

- `apify/website-content-crawler` — free, markdown output
- `clockworks/tiktok-scraper` — profile mode for `@balanceyourbp_`
- `apify/instagram-profile-scraper` — official, profile + recent posts for `@greg_hoyd`
- `clockworks/tiktok-hashtag-scraper` — competitor discovery via `#unicity`, `#balanceyourbp`

Each actor has a thin typed wrapper in `lib/apify.ts`. Do not call Apify raw from route handlers.

## The demo

See PLAN.md §17. The climax is ONE spotlight post that visibly reuses a research finding (e.g., "your top TikTok hook was 'your doctor has 7 minutes' — this post reuses it"). The 30-day calendar is scaffolding; the spotlight is the proof.

## When stuck

1. Re-read PLAN.md for the section covering your area.
2. If PLAN.md is ambiguous, flag in chat — do not guess.
3. If a shared contract needs to change, stop and coordinate. Never silently edit `lib/types.ts` or `lib/events.ts` to unbreak your lane.

## Skill routing

- Bugs, errors, "why is this broken" → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- Code review before landing → invoke review
- Visual audit, design polish → invoke design-review
- Architecture questions → re-read PLAN.md first, then invoke plan-eng-review if gap
