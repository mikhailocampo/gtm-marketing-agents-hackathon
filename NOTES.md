# GTM Hackathon — Marketing Agent MVP

**Budget:** 3 hours. **Demo brand:** balanceyourbp.com

## Product thesis (post CEO review)

The 30-day multi-channel calendar is a crowded category. The differentiator is NOT
the calendar — it's what the agent reveals about the brand during research.

**Chosen reframe: "Here's what you post. Here's what you should post. Here's why."**
Fallback: agent-as-strategist-interview if socials aren't publicly scrapable.

The calendar is scaffolding. One ruthlessly-good spotlight post is the proof.

## Screen-by-screen

1. **Input:** URL field, one CTA. Nothing else.
2. **Research live log:**
   - `<DO>` Scrape website (Apify MCP)
   - `<DO>` Scrape their existing socials (IG/FB) — actual posts
   - `<DO>` Scrape 1 Reddit/forum relevant to ICP (for real voice-of-customer)
   - `<ASK>` 1-3 clarifying questions based on contradictions found
   - Streaming "thinking log" visible
3. **Confirm / "Did I get this right?":**
   - ICP (with specific emotional register, not demo demo)
   - Offer
   - Brand voice
   - **Diagnosis of current content** (their last N posts, why underperforming for ICP)
   - Proposed 30-day themes
4. **Calendar:**
   - Planable-style grid, 3 channels (IG, FB, LinkedIn enough for demo)
   - Populates async, staggered reveal
   - **One "spotlight" post opens full-bleed** with rationale line
   - Channel picker with favicons (Google s2/favicons lookup)
   - All posting is mocked — no real socials API

## Premises (agreed with user)

1. Apify MCP makes research tractable in the budget. (Agreed)
2. Research + orchestration coherence is the hard part, not UI. (Agreed — UI is tasteful but not the bar)
3. Favicon lookup for channel icons, no real posting. (Agreed)
4. One real Apify path in the research agent; everything else LLM synthesis. (Agreed)

## Architecture (sketch)

- Next.js 15 App Router
- Vercel AI SDK `streamText` + tool calling
- Apify MCP as LLM tool (scrapeWebsite, scrapeInstagram, scrapeReddit)
- SSE for research log and calendar populate
- In-memory session store (Map). No DB. Demo-only.
- Shadcn + Tailwind.

## Demo-path risks

- balanceyourbp.com socials must be public + scrapable. **Verify first.**
- Apify actor latency — cache a dry run ahead of demo.
- LLM output coherence across 90 posts (3 channels × 30 days) — use two-stage:
  stage A = 30 content beats (1 call), stage B = adapt each to each channel.

## Next steps

1. Init repo, scaffold Next.js.
2. Verify balanceyourbp.com socials are scrapable.
3. Build screens 1→2 with streaming research.
4. Build screen 3 confirm + stage-A beat generation.
5. Build screen 4 calendar with stage-B per-channel adaptation.
6. Pick the spotlight post. Polish that one.

## DECIDED: A+C+D synthesis

Research phase does three things in parallel:
- **Brand/ICP** (scrape site + infer)
- **Own social performance** (scrape TikTok @balanceyourbp_ + IG @greg_hoyd) — which
  posts popped, which flopped, tone analysis
- **Competitor/industry** (find other Unicity distributors on TikTok/IG/FB, surface
  what's trending in the niche, what hooks/formats work)

Confirm screen narrative:
"Here's what we found about your audience, your current content performance, and
what's working in your niche across other Unicity distributors. Here are the patterns
worth doubling down on and the gaps worth closing. Here's your 30-day plan that
reuses your best hits and leans into the trends."

Calendar is still the finale — posts "pop in" across channels. One spotlight post
opens full-bleed with a rationale line tying it back to a specific research finding
(e.g., "this reuses your top-performing hook from April — 'your doctor has 7 minutes'
— adapted for TikTok short-form").

## Demo brand social accounts

- TikTok: https://www.tiktok.com/@balanceyourbp_
- Instagram: https://www.instagram.com/greg_hoyd/
- Angle: Unicity distributor. Competitor research = other Unicity distributors.

## Apify auth

DONE. Authenticated. Actors confirmed:
- `apify/website-content-crawler` (free, markdown)
- `clockworks/tiktok-scraper` (profile + hashtag modes)
- `apify/instagram-profile-scraper` (official, profile + posts)
- `clockworks/tiktok-hashtag-scraper` (competitor discovery via #unicity)

Total per-demo-run cost: ~$0.20.

## Full plan

See PLAN.md — 20 sections covering architecture, parallel lanes, contracts,
error handling, demo script, and failure mitigations. Read that before
touching any code.
