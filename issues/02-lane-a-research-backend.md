# 02 — Lane A: Research backend

> **Do not run this until ticket 01 (scaffold) is merged.** This ticket extends `SessionDO` and wires the research-phase agent. It imports types and stream primitives established in 01.

**Depends on:** 01.
**Parallel with:** 03, 04, 05.
**Lane tree:** `lib/research/**`, `app/api/research/**`, `app/api/chat/**`.
**Files outside this tree are READ-ONLY.** If you need to change a shared file, STOP and flag.
**Estimated effort:** CC ~40 min.

## Why

Powers Screens 1 → 2. A chat-style research agent that scrapes website + socials + hashtags, asks a sharp clarifying question mid-stream via native AI SDK human-in-the-loop, and finalizes a `ResearchOutput` that Screen 3 renders.

## Scope

### `lib/research/prompts.ts`

Full research system prompt per [PLAN.md §9.1](../PLAN.md):

- Role: senior marketing strategist.
- Tool loop: scrape + synthesize + `finalize_research` as final tool.
- askUser soft-require: "You MUST call `askUser` exactly once, ideally about a real contradiction. If none exists, ask about a strategic preference. Never ask about missing handles."
- Anti-slop: full ban list from DESIGN.md §7.5; every `ResearchFact` must have non-empty `evidence`; every fact needs ≥1 concrete number or named entity.
- Voice: first-person singular, never "we".

Export `RESEARCH_SYSTEM_PROMPT` (string) and `buildSeedUserMessage({ websiteUrl, socials }): string` for the initial auto-submitted user message.

### `lib/research/anti-slop.ts`

Regex validators matching DESIGN.md §7.5 ban list. Export:

- `containsBannedPhrase(text: string): string | null` — returns the matched phrase or null
- `hasConcreteNumber(text: string): boolean` — regex `\d+(K|k|%|\.)?`
- `hasNamedEntity(text: string, brandContext: string[]): boolean` — checks for real handles, hashtags, or brand words
- `validateResearchFact(fact: ResearchFact, brandContext: string[]): { ok: true } | { ok: false; reason: string }`

Used in `finalize_research` tool's zod `.refine()` and also standalone for post-validation.

### `lib/research/tools.ts`

Five tools, exported as a `createResearchTools(env, ctx)` factory:

```ts
export function createResearchTools(env: Env, ctx: { sid: string; do: DurableObjectStub<SessionDO> }) {
  return {
    scrapeWebsite: tool({
      description: "Fetch the brand's website and return markdown content plus the page title.",
      inputSchema: z.object({ url: z.string().url() }),
      execute: async ({ url }) => { /* wraps lib/apify.ts */ },
    }),

    scrapeTikTokProfile: tool({
      description: "Fetch the most recent posts from a TikTok profile for content + engagement analysis.",
      inputSchema: z.object({ username: z.string() }),
      execute: async ({ username }) => { /* wraps apify */ },
    }),

    scrapeInstagramProfile: tool({ /* same shape */ }),

    scrapeTikTokHashtag: tool({
      description: "Search a TikTok hashtag for competitor content in the niche. Use for discovering other players.",
      inputSchema: z.object({ hashtag: z.string() }),
      execute: async ({ hashtag }) => { /* wraps apify */ },
    }),

    finalize_research: tool({
      description: "Produce the final ResearchOutput. Call this exactly once, after you have gathered enough evidence. All ResearchFacts must have non-empty evidence.",
      inputSchema: ResearchOutputSchema, // zod schema from lib/types.ts, with .refine() calls
      execute: async (output) => {
        // 1. anti-slop validation on every fact (drop facts with empty evidence)
        // 2. persist to DO SQLite
        // 3. set status 'ready_to_confirm'
        return { ok: true, factsAccepted: output.diagnosis.length + output.trends.length };
      },
    }),

    // askUser — NO execute. Native HIL via AI SDK v6.
    askUser: tool({
      description: "Ask the user exactly ONE clarifying question about a contradiction or strategic preference you noticed.",
      inputSchema: z.object({
        question: z.string(),
        mode: z.enum(['single', 'multi']),
        options: z.array(z.string()).min(2).max(4),
        // Note: the client appends "Other" automatically
      }),
      // no execute — paused until addToolOutput on client
    }),
  };
}
```

Each scrape tool: 30s timeout; on error returns `toolError({code, message, recoverable, retry_safe})` instead of throwing. Map apify actor failures to the codes in [PLAN.md §7](../PLAN.md).

### Extend `SessionDO`

Fill in the stubs from ticket 01:

- `handleChat(request)`:
  1. Parse the incoming `{ messages, sid }` body.
  2. Verify sid matches this DO's `idFromName` binding.
  3. Load `SerializedPart[]` journal from SQLite.
  4. Build messages: `buildLlmMessages(journal)` then append the incoming user/tool-result messages from `messages`.
  5. `streamText({ model: google(MODEL_IDS.RESEARCH), system: RESEARCH_SYSTEM_PROMPT, messages, tools: createResearchTools(env, {sid, do:this}), stopWhen: stepCountIs(20), providerOptions: RESEARCH_PROVIDER_OPTIONS, onFinish: async ({steps}) => { await this.sql.exec('INSERT INTO research_journal ...', serializeStepContent(steps)); } })`.
  6. Return `result.toUIMessageStreamResponse({ headers: { 'X-Session-Id': sid } })`.

- `getResearchReplay()`:
  - Returns `{ researchOutput: session.state.research, journal: await loadAllParts() }`.

- Fixture short-circuit in `createSession`: if `env.APIFY_TOKEN` is missing AND `env.DEMO_FALLBACK === '1'`, synthesize a `finalize_research` tool-call-and-result pair from `lib/fixtures/balanceyourbp.ts` and append to the journal immediately. Set status to `ready_to_confirm`. Also log `[research:{sid6}] fixture-short-circuit`.

### Routes

- `app/api/research/route.ts`:
  - POST with `{ websiteUrl, socials }` → validate via zod → generate sid via nanoid(12) → get DO stub via `env.SESSION_DO.get(env.SESSION_DO.idFromName(sid))` → call `do.createSession(sid, input)` → return `{ sid }`.
  - All routes set `export const runtime = 'nodejs'`.

- `app/api/chat/route.ts`:
  - POST with `{ messages, sid }` → get DO stub → `return do.fetch(request)` (DO `handleChat` takes over).
  - The client's `customFetch` transport injects `sid` into body for every request (pattern from dpc `chi-page-client.tsx:39–92`).

- `app/api/chat/conversations/[sid]/route.ts`:
  - GET → get DO stub → return `await do.getResearchReplay()` as JSON.

## Acceptance

- `curl -X POST /api/research -d '{"websiteUrl":"https://balanceyourbp.com","socials":[{"platform":"tiktok","handle":"balanceyourbp_","url":"https://www.tiktok.com/@balanceyourbp_"}]}'` returns `{sid:"..."}`.
- Opening a POST to `/api/chat` with `{ messages: [seed], sid }` streams tool calls + reasoning + fact text parts end-to-end.
- At least one live run with real `APIFY_TOKEN` produces a ResearchOutput that passes zod + anti-slop validation.
- `askUser` fires on the balanceyourbp live run (audience contradiction).
- Page reload mid-stream: calling `GET /api/chat/conversations/:sid` returns journal; feeding through `buildUIMessages()` reproduces the stream state.
- Fixture short-circuit: with `APIFY_TOKEN` unset and `DEMO_FALLBACK=1`, `POST /api/research` immediately completes research; `GET /api/chat/conversations/:sid` returns the fixture's ResearchOutput.
- Commit: `"lane-a: research backend, tools, chat API, HIL askUser"`.

## Watch-outs

- **Gemini `thoughtSignature` persistence is mandatory.** Copy dpc's `serializeStepContent` path for reasoning parts verbatim — the signature lives in `part.providerMetadata.google.thoughtSignature`. Missing it causes the next turn to error.
- **stopWhen: stepCountIs(20)** — research has 4 scrape tools + 1 askUser + 1 finalize_research = 6 tool calls minimum. 20 is generous; raising it risks runaway. Keep.
- **finalize_research must be called to complete the research phase.** The system prompt explicitly says so. If the agent refuses (unlikely), add a `prepareStep` nudge on step ≥15 that injects a system message forcing it.
- **Zod `.refine()` on ResearchFact evidence** — reject at validation time. Do not silently accept empty evidence.
- **askUser options** — max 4 per shadcn RadioGroup layout. The client always appends "Other" as a 5th, so the tool schema caps at 4.
- **Apify integration test** — run the scrapeWebsite integration test from [PLAN.md §12](../PLAN.md) ONCE against live balanceyourbp.com before declaring done.

## Do NOT

- Touch any UI files (Lane C renders this backend).
- Touch orchestrator code or calendar routes (Lane B).
- Modify `lib/session-do.ts` beyond the method bodies you own. Do not add new RPC methods; the schema is locked.
- Modify `lib/types.ts` — propose additions via PR comment, do not silently edit.
