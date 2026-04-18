# 06 — Integration + polish (post-merge)

> **Do not run this until tickets 01–05 are all merged.** This is the end-to-end wire-up with live Apify + live Gemini + live Nano Banana 2, plus deploy to workers.dev and demo rehearsal.

**Depends on:** 01, 02, 03, 04, 05 (all must be merged).
**Estimated effort:** CC ~45 min (not counting retries on live APIs).

## Why

Individual lanes merge green. This ticket proves end-to-end works with real external services, fixes the contract drift that only surfaces under live load, and ships a deployable Worker + rehearses the demo.

## Scope

### Live integration sweep

- [ ] Apify integration: run `scrapeWebsite` → `scrapeTikTokProfile('balanceyourbp_')` → `scrapeInstagramProfile('greg_hoyd')` → `scrapeTikTokHashtag('unicity')` in sequence. Verify typed DTOs, no thrown errors, no missing fields.
- [ ] Research end-to-end: with real `APIFY_TOKEN` + `GOOGLE_GENERATIVE_AI_API_KEY`, fire a full research cycle for balanceyourbp. Assert ResearchOutput passes zod + anti-slop validation. Assert askUser fires exactly once on a real contradiction (not a fallback preference question).
- [ ] Calendar end-to-end: approve with tiktok+instagram+linkedin → assert orchestrator generates ≥10 posts across 4 weeks → assert each has `mediaUrl` pointing at a valid R2 public URL → load the URL in the browser, confirm image displays → assert exactly one post has `spotlightRef` set with SpotlightPayload.
- [ ] Page refresh recovery: during research stream, refresh the page → replay rehydrates correctly. During calendar stream, refresh the page → SSE replays all prior events before streaming live.

### Contract drift fixes

Lanes may have drifted on shared types. Do a sweep:

- [ ] Search `lib/types.ts` imports across all lanes. Confirm no lane has duplicated a type locally.
- [ ] Search for local `type X =` in lane files — flag anything that duplicates a shared type.
- [ ] Run `bun x tsc --noEmit` and fix any cross-lane type mismatches.

### Anti-slop eval hook

- [ ] Create `lib/research/eval.ts`: regex-based validator that returns `{ valid: boolean; hits: string[] }` for a given text. Covers DESIGN.md §7.5 ban list.
- [ ] Wire into `finalize_research` tool: after zod parse, run validator on every `ResearchFact.text` + `evidence` + `suggestedThemes`. Drop offending facts, log the drop.
- [ ] Wire into `generate_post` sub-pipeline: after `generateObject`, validate `hook` + `body` + `rationale`. If hit: retry once with corrective prompt append. If still hit: emit PostVariant with `error.code='slop'`.
- [ ] Test fixture: hand-craft 2 deliberately-sloppy test strings and assert validator catches them.

### R2 public URL discovery

- [ ] Confirm R2 bucket exists: `wrangler r2 bucket list | grep gtm-agent-images`.
- [ ] Enable public access (once): `wrangler r2 bucket dev-url enable gtm-agent-images` (or via dashboard).
- [ ] Capture the resulting `pub-xxxxx.r2.dev` URL. Paste into `.dev.vars` as `R2_PUBLIC_URL=https://pub-xxxxx.r2.dev`.
- [ ] Also set via `wrangler secret put R2_PUBLIC_URL` for production.

### Observability polish

- [ ] Confirm `wrangler tail` shows `[research:{sid6}] ...` and `[calendar:{sid6}] ...` logs during a live run.
- [ ] `/api/debug/:sid` endpoint: gated by `env.DEMO_FALLBACK === '1'`. Returns full SessionState + research journal + calendar journal as JSON. 404 otherwise.

### Deploy

- [ ] `bun run build` clean.
- [ ] `bun run deploy` → deploys to `gtm-agent.<account>.workers.dev`.
- [ ] Production smoke test: hit the deployed URL with balanceyourbp.com, click through to calendar, confirm spotlight fires.
- [ ] Pre-warm: 30 seconds before demo, hit `/` from the demo laptop to wake the Worker from cold start.

### Demo rehearsal

Run the full demo script from [PLAN.md §17](../PLAN.md) end-to-end at least 3 times:

- [ ] Rehearsal 1: with `DEMO_FALLBACK=1` and no tokens — fixture flow. Assert the demo still works if APIs are down at showtime.
- [ ] Rehearsal 2: live with tokens, against balanceyourbp.com. Time each phase against the 3-minute budget.
- [ ] Rehearsal 3: live + exhibit the failure fallback (unset APIFY_TOKEN mid-run → confirm banner shows + demo continues).

Capture:
- A demo video (screen recording) as backup.
- Timestamp of each emotional peak. If Peak 3 (spotlight) lands past 2:45, tune orchestrator concurrency or post count.

### Stretch goals (optional, time-permitting)

- [ ] Veo on spotlight: extend `generate_post` to accept `modality: 'video'` for the spotlight slot. Generate 8s 1080p Veo clip ($3.20). Show in DayModal instead of image.
- [ ] Past-posts-in-past-cells: flip `ENABLE_PAST_POSTS=true` (Lane D stretch) and verify past months render scraped own-posts on their real dates.
- [ ] `pick_spotlight` fallback: if orchestrator's spotlight rationale fails anti-slop validation twice, fall back to the fixture's pre-baked SpotlightPayload so the modal still lands richly.
- [ ] `wrangler.jsonc` observability: enable `logs` binding + set up a logs persister.

## Acceptance

- Live balanceyourbp demo runs end-to-end in under 3:30 on the deployed Worker.
- Fixture fallback demo runs end-to-end when tokens are unset.
- R2 URLs load in under 500ms on a consumer connection.
- No uncaught exceptions across a full demo cycle (check `wrangler tail`).
- Commit: `"integration: live wire-up, anti-slop eval, deploy, rehearsal"`.

## Watch-outs

- **Nano Banana 2 preview tier quota** — if 429s become frequent, downgrade to stable `gemini-2.5-flash-image` (looser limits, no 4K). Worth it for demo reliability.
- **Apify cost** — a full demo cycle is ~$0.20 Apify. Running rehearsal 3× = $0.60. Fine.
- **R2 public URL exposure** — `pub-xxxxx.r2.dev` leaks the bucket ID. Not a secret, but not ideal. Acceptable for hackathon.
- **Cold start on Worker** — Pre-warm with a real request, not just a ping; SSR requires the Next runtime.
- **Timezone drift** — Stage-A + Screen 4 calendar use real ISO dates. Set server TZ explicitly (UTC). Don't trust client locale for date math.

## Do NOT

- Ship without a full rehearsal that reaches the spotlight reveal.
- Commit any secrets to git (check `.gitignore` includes `.dev.vars` and `.wrangler`).
- Deploy if `bun x tsc --noEmit` has errors.
