# 03 — Lane B: Orchestrator + calendar generation

> **Do not run this until ticket 01 (scaffold) is merged.** This ticket extends `SessionDO` and wires the calendar-phase orchestrator. It imports types, fixture, and R2 helpers from 01.

**Depends on:** 01.
**Parallel with:** 02, 04, 05.
**Lane tree:** `lib/orchestrator/**`, `lib/generation/**`, `lib/rate-limit.ts`, `app/api/calendar/**`.
**Files outside this tree are READ-ONLY.** If you need to change a shared file, STOP and flag.
**Estimated effort:** CC ~45 min.

## Why

Powers Screen 4. A two-tier agent: a higher-reasoning Orchestrator plans one week of posts at a time and fans out to a `generate_post` sub-pipeline that writes copy + generates a Nano Banana 2 image per post. Results stream to the client via custom SSE.

## Scope

### `lib/orchestrator/prompts.ts`

Full orchestrator system prompt per [PLAN.md §9.2](../PLAN.md):

- Role: content strategist turning research into a concrete month of posts.
- Input context: `{research}`, `{selectedChannels}`, `{dateWindow: [today+1, today+30]}`.
- Cadence hint: TikTok 3/wk, Instagram 2/wk, LinkedIn 1/wk default; deviation allowed with justification.
- Rhythm: `plan_week` first for each of 4 weeks, then `generate_post` for each slot, then `pick_spotlight` exactly once at the very end.
- Timing intuition: justify timing with research signals ("Tuesday 6pm because 3/7 distributors post then with 2.3× engagement").
- Spotlight criteria: pick a post that (a) reuses a specific own-top-performer hook, (b) supports an evidence-rich 2–3 sentence rationale with ≥1 quoted phrase and ≥1 concrete number.

Export `ORCHESTRATOR_SYSTEM_PROMPT` and `buildOrchestratorUserMessage({research, selectedChannels, dateWindow}): string`.

### `lib/orchestrator/tools.ts`

Three tools, factoried as `createOrchestratorTools(env, ctx)`:

```ts
export function createOrchestratorTools(env: Env, ctx: { sid: string; do: SessionDO }) {
  return {
    plan_week: tool({
      description: "Announce the posts you intend to generate for one week. This triggers shimmer placeholders in the UI.",
      inputSchema: z.object({
        weekNumber: z.number().int().min(1).max(4),
        slots: z.array(z.object({
          date: z.string(),                // ISO; must be in [today+1, today+30]
          channel: ChannelId,
          themeHint: z.string(),
        })).min(1).max(12),
      }),
      execute: async ({ weekNumber, slots }) => {
        // 1. Validate each date is in range
        // 2. ctx.do.journalCalendarEvent({ type:'week_planned', weekNumber, slots })
        // 3. for each slot: ctx.do.emitSse({ type:'shimmer', date:slot.date, channel:slot.channel })
        return { ok: true, plannedSlots: slots.length };
      },
    }),

    generate_post: tool({
      description: "Generate one post (copy + image) for a planned slot. Call this for every slot after plan_week.",
      inputSchema: z.object({
        date: z.string(),
        channel: ChannelId,
        prompt: z.string(),                // beat-level instructions — cite research + reuseOf if any
        reuseOf: z.object({ hookText: z.string(), postUrl: z.string() }).optional(),
        trendSignal: z.string().optional(),
        modality: z.enum(['image','video','text']).default('image'),
      }),
      execute: async (input) => {
        const post = await generatePost(env, input, ctx);  // lib/generation/post.ts
        await ctx.do.journalCalendarEvent({ type:'post', post });
        await ctx.do.emitSse({ type:'post', post });
        return post;  // orchestrator has this for its continuing reasoning
      },
    }),

    pick_spotlight: tool({
      description: "After generating all 4 weeks, pick the single most demo-worthy post and explain why.",
      inputSchema: z.object({
        date: z.string(),
        channel: ChannelId,
        rationale: z.object({
          sentence: z.string(),
          highlights: z.array(z.object({ phrase: z.string(), chipId: z.string() })),
        }),
        evidenceChips: z.array(z.object({
          id: z.string(),
          kind: z.enum(['own-post','competitor','trend']),
          label: z.string(),
          url: z.string().optional(),
          thumbnail: z.string().optional(),
        })).min(2).max(3),
      }),
      execute: async (payload) => {
        await ctx.do.setSpotlight(payload);
        await ctx.do.emitSse({ type:'calendar_done', spotlightRef: { date: payload.date, channel: payload.channel } });
        await ctx.do.setStatus('done');
        return { ok: true };
      },
    }),
  };
}
```

### `lib/generation/post.ts`

Sub-pipeline for generate_post:

```ts
export async function generatePost(env: Env, input: GeneratePostInput, ctx: {sid:string, do:SessionDO}): Promise<PostVariant> {
  return await rateLimit(ctx.sid, async () => {
    // 1. Copy
    const PostCopySchema = z.object({
      hook: z.string().max(200),
      body: z.string(),
      cta: z.string().optional(),
      rationale: z.string(),
      mediaPrompt: z.string(),   // prompt for Nano Banana
    });
    const { object: copy } = await generateObject({
      model: google(MODEL_IDS.COPY),
      schema: PostCopySchema,
      prompt: buildPostCopyPrompt(input),
    });

    // 2. Anti-slop check — 1 retry with corrective append if matched
    const slop = checkSlop(copy);  // reuse anti-slop from lib/research/anti-slop.ts
    if (slop) { /* retry once; if still fails, attach error flag */ }

    // 3. Image via Nano Banana 2
    let mediaUrl: string | undefined;
    if (input.modality === 'image') {
      const image = await generateImage(env, copy.mediaPrompt);  // lib/generation/image.ts
      if (image) {
        const key = `${ctx.sid}/post-${input.date}-${input.channel}.png`;
        mediaUrl = await putImage(env, key, image.uint8Array);
      }
    }

    return {
      date: input.date,
      channel: input.channel,
      hook: copy.hook,
      body: copy.body,
      cta: copy.cta,
      rationale: copy.rationale,
      mediaUrl,
      mediaKind: input.modality === 'image' ? 'image' : undefined,
      reuseOf: input.reuseOf,
      trendSignal: input.trendSignal,
      error: slop ? { code:'slop', message:'Anti-slop validator rejected twice' } : undefined,
    };
  });
}
```

### `lib/generation/image.ts`

```ts
export async function generateImage(env: Env, prompt: string): Promise<{uint8Array: Uint8Array; mediaType: string} | null> {
  try {
    const result = await generateText({
      model: google(MODEL_IDS.IMAGE),  // 'google/gemini-3.1-flash-image-preview'
      prompt,
    });
    const file = result.files?.find(f => f.mediaType.startsWith('image/'));
    return file ? { uint8Array: file.uint8Array, mediaType: file.mediaType } : null;
  } catch (err) {
    // On 429, retry once with 2s backoff; else return null (caller uses placeholder)
    console.error('[nano-banana]', err);
    return null;
  }
}
```

### `lib/generation/spotlight.ts`

Helpers for assembling `SpotlightPayload` shape from `pick_spotlight` args; validators that chip IDs in `rationale.highlights` match chip IDs in `evidenceChips`.

### `lib/rate-limit.ts`

Per-sid `p-limit(3)` factory + single-retry wrapper with 2s backoff. The p-limit is inside the `generate_post` tool execute so the orchestrator can fan out 6 calls and the semaphore serializes them to ~3 at a time. Budget matches Nano Banana 2 preview tier (~10 RPM).

```ts
const limiters = new Map<string, pLimit.Limit>();
export async function rateLimit<T>(sid: string, fn: () => Promise<T>): Promise<T> {
  const limit = limiters.get(sid) ?? limiters.set(sid, pLimit(3)).get(sid)!;
  return limit(async () => {
    try { return await fn(); }
    catch (err) {
      if (isRateLimitError(err)) {
        await sleep(2000);
        return await fn();
      }
      throw err;
    }
  });
}
```

### Extend `SessionDO`

Fill in stubs from ticket 01:

- `async startCalendar(selectedChannels: ChannelId[])`:
  - Set status to `generating`.
  - Persist selectedChannels + initial `CampaignPlan`.
  - Launch orchestrator via `this.ctx.waitUntil(this.#runOrchestrator(selectedChannels))`.

- `async #runOrchestrator(selectedChannels)` (private):
  - Build dateWindow = `[tomorrow, today+30]`.
  - `streamText({ model: google(MODEL_IDS.ORCHESTRATOR), system, messages, tools, stopWhen: stepCountIs(30), providerOptions: ORCHESTRATOR_PROVIDER_OPTIONS })`.
  - `await result.consumeStream()` — we don't pipe orchestrator output directly; the orchestrator communicates via custom SSE events emitted from within its tools.
  - Optional: also persist orchestrator reasoning blocks for a debug side panel (not required for demo).

- Subscriber fanout:
  - `#subscribers: Set<WritableStreamDefaultWriter>`.
  - `emitSse(event: CalendarEvent)`: journal it, then broadcast to all subscribers. Skip failed writers.

- `async subscribeCalendar(request)`:
  - Create a `TransformStream`; attach writer to `#subscribers`.
  - Replay journal from SQLite: each event piped in order.
  - Set up a heartbeat every 15s: `:\n\n`.
  - On `AbortSignal` from request: remove writer from set.
  - Return `new Response(readable, { headers: { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' } })`.

- `journalCalendarEvent(event)`: `INSERT INTO calendar_journal (event) VALUES (?)`.
- `setSpotlight(payload)`: update session state with `plan.spotlightRef = { date, channel, payload }`.

### Routes

- `app/api/calendar/route.ts` POST `{ sid, selectedChannels }` → get DO stub → `do.startCalendar(selectedChannels)` → return `{ ok: true }` immediately.
- `app/api/calendar/[sid]/stream/route.ts` GET → get DO stub → `return do.fetch(request)` (DO's `subscribeCalendar` responds).

## Acceptance

- With fixture ResearchOutput + `DEMO_FALLBACK=1`, POST `/api/calendar` kicks off the orchestrator; SSE stream emits ~15 `shimmer` events, then ~15 `post` events, then one `calendar_done`.
- With real Gemini + Nano Banana, at least one full run for balanceyourbp completes with ≥10 PostVariants having valid R2 image URLs.
- `generate_post` anti-slop check catches at least one test case (manually constructed ban-list trigger) and retries.
- Rate-limit wrapper serializes correctly: inject a scripted 429 on the 2nd call — see the retry, then success.
- SSE reconnect: close the stream mid-run, reopen → all prior events replay, then live events resume.
- Commit: `"lane-b: orchestrator, generate_post sub-pipeline, R2 images, calendar SSE"`.

## Watch-outs

- **Nano Banana 2 preview rate limit is ~10 RPM.** Per-sid p-limit(3) gives us a safety margin. Do not increase concurrency.
- **`ctx.waitUntil` extends DO lifetime** but Workers still have wall-clock limits. A full 4-week orchestrator run should finish in ≤2 min wall time. If it drifts longer, drop to 3 weeks or shrink posts/week.
- **The orchestrator's tool result for `generate_post` returns the full PostVariant back into its context.** This is intentional — lets the orchestrator reason about its prior posts when planning subsequent weeks. But it grows context fast; budget ~100–150 input tokens per prior post. Fine for 15 posts.
- **Spotlight chipId matching** — validate that every `highlights[].chipId` is present in `evidenceChips[].id`. Reject the tool call via `toolError()` if mismatched so the LLM retries.
- **R2 public URL is configured via env var** (`R2_PUBLIC_URL` = `pub-xxxxx.r2.dev`). Set during ticket 01 deployment prep; Lane B reads it from `env`.
- **Placeholder color block on image failure** — compute a deterministic color from `hash(date+channel)` mapped to a brand palette. Never blank.

## Do NOT

- Touch Screen 4 UI (Lane D renders this backend).
- Touch research code or askUser tool (Lane A).
- Add new SessionDO RPC methods beyond the schema locked in ticket 01. Propose additions via PR comment.
- Deploy Veo — that's the optional stretch in ticket 06.
