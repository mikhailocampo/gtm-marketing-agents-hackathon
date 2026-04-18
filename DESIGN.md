# DESIGN.md — GTM Marketing Agent

**Product in one line:** an agent that reads a brand's website + socials, diagnoses what's working, and generates a 30-day content calendar with one spotlight post that visibly reuses a research finding.

**Design thesis:** The product is an AI marketing agent. If the product itself looks like generic AI output, the thesis collapses. Every surface has to earn the judgment "a person with taste decided this." The calendar is scaffolding; the research log, the wedge card, and the spotlight modal are where design carries the demo.

This doc is the source of truth. `PLAN.md` §10.6-10.8 reference rules; this file defines them.

---

## 1. Voice & tone

- **Agent voice is first-person, specific, evidence-grounded.** Never the generic "your audience engages with authentic content."
- **UI chrome voice is direct, no marketing sparkle.** "Tell us about your brand." not "Unlock the power of AI-driven marketing."
- **Headings are short.** No three-clause marketing lines.
- **Numbers over adjectives everywhere.** "40K views" beats "high-performing." "3 of 7 distributors" beats "many competitors."

Banned phrases (never appear in UI chrome or LLM prompts):
- "engage your audience", "build community", "authentic storytelling"
- "delve", "crucial", "robust", "comprehensive", "unlock the power of"
- Any second-person marketing-copywriter voice in the app frame

---

## 2. Typography

Two typefaces. No more. Wired via `next/font/google` in `app/layout.tsx`, exposed as CSS variables, assigned as Tailwind font families.

```ts
// app/layout.tsx
import { Inter, Instrument_Serif } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", weight: ["400","500","600"], display: "swap" });
const instrumentSerif = Instrument_Serif({ subsets: ["latin"], variable: "--font-serif", weight: "400", style: ["normal","italic"], display: "swap" });

// <html className={`${inter.variable} ${instrumentSerif.variable}`}>
```

```ts
// tailwind.config.ts — theme.extend.fontFamily
fontFamily: {
  sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
  serif: ["var(--font-serif)", "ui-serif", "Georgia"],
}
```

- **Body sans — Inter.** Close cousin of Apple SF Pro in geometry and x-height; reads as the Glass-UI default. Weights 400 / 500 / 600. `font-feature-settings: "cv11", "ss01", "ss03"` for the single-story `a` and rounded `g` that mimic SF Pro. Apply these features globally on `body` in `globals.css`.
- **Editorial serif — Instrument Serif** (400, italic variant available). Used only for the Wedge card headline, Spotlight rationale heading/pullquote, and the one-liner hero on Screen 1. The editorial texture earns the "this was designed" signal; glass alone risks feeling tech-demo. Never use on body copy, buttons, inputs, or chrome.

Default system stacks are banned — reads as "didn't bother." If `next/font` ever fails to load, the fallback chain is `ui-sans-serif, system-ui` (Apple device users land on SF automatically, which is on-brand for the glass aesthetic).

**Type scale** (Tailwind tokens):

| Role | Size | Weight | Font |
|---|---|---|---|
| Hero display (Wedge headline, Spotlight rationale heading) | `text-3xl` / 30px | 400 | Instrument Serif |
| H1 page-level | `text-2xl` / 24px | 600 | Inter |
| H2 section | `text-xl` / 20px | 600 | Inter |
| Body | `text-base` / 16px | 400 | Inter |
| Small / metadata | `text-sm` / 14px | 400 | Inter |
| Label / chip | `text-xs` / 12px | 500 | Inter |
| Pullquote (evidence quotes, spotlight rationale sentence) | `text-lg` / 18px, italic | 400 | Instrument Serif |

**Line-height:** `leading-relaxed` on body, `leading-tight` on headings.
**Tracking:** default. Letter-spacing tricks are banned.

---

## 3. Color

All values declared as CSS variables in `app/globals.css`. JSX uses Tailwind token names (`bg-background`, `text-foreground`). Hex literals in JSX are banned.

```css
:root {
  --background: 0 0% 100%;                /* white */
  --foreground: 20 14.3% 4.1%;            /* near-black, warm */
  --muted: 60 4.8% 95.9%;                 /* warm neutral-50 */
  --muted-foreground: 25 5.3% 44.7%;      /* neutral-600 */
  --border: 20 5.9% 90%;                  /* neutral-200 */
  --card: 0 0% 100%;
  --card-foreground: 20 14.3% 4.1%;
  --ring: 20 14.3% 4.1%;

  /* Semantic agent-action colors (LiveLog left-accent bars) */
  --accent-inflight: 38 92% 50%;          /* amber-500 — do_start */
  --accent-done: 142 76% 36%;             /* emerald-600 — do_end */
  --accent-fact: 217 91% 60%;             /* blue-500 — fact */
  --accent-ask: 262 83% 58%;              /* violet-500 — ask (distinct from all) */

  /* Diagnosis tags */
  --accent-working: 142 76% 36%;          /* same emerald */
  --accent-underperforming: 38 92% 50%;   /* same amber */

  /* The demo climax */
  --accent-spotlight: 38 92% 50%;         /* amber-400, ring-4 */
}
```

**Rules:**
- No purple/indigo gradient backgrounds. (Violet only as an accent on the `ask` event bar.)
- No blue-to-purple color sweeps.
- One accent at a time per surface.
- Muted-foreground must pass 4.5:1 contrast against background. Test with a contrast checker before shipping.

**State tokens (hover, focus, pressed, disabled):**

```css
:root {
  --ring-focus: 20 14.3% 4.1%;              /* same as --ring, 2px offset */
  --hover-overlay: 0 0% 0% / 0.04;          /* 4% black wash on hover */
  --pressed-overlay: 0 0% 0% / 0.08;        /* 8% black wash pressed */
  --disabled-opacity: 0.5;
  --selection: 38 92% 50% / 0.25;           /* amber-500 @ 25% — matches spotlight */
}
```

Rules:
- Focus-visible rings are `2px solid hsl(var(--ring-focus))` with `2px offset`, never removed without replacement.
- Hover states use the overlay token on top of the base color, not a hand-picked "slightly lighter" hex.
- Selection color matches the spotlight accent — small touch, ties chrome to the product identity.

---

## 3.5 Glass surface material (Apple Liquid Glass adaptation)

Our visual identity is **Apple Liquid Glass** as adapted for the web. Glass is a material, not a color — it's a layered stack (translucent base + backdrop blur + specular highlight + subtle inner border) that refracts content behind it. This is what makes the app feel like a 2026 macOS Tahoe / iOS 26 surface rather than a shadcn starter.

### The Glass stack

Every glass surface is composed of **four stacked layers**, built from CSS alone (no WebGL, no canvas):

1. **Refraction layer** — `backdrop-filter: blur(...) saturate(180%)` to sample and transform the content behind.
2. **Tint layer** — semi-transparent background color (`rgba` at low alpha, matches theme).
3. **Specular highlight** — thin inner border / inset box-shadow with a brighter top edge, simulating light catching a curved glass edge.
4. **Content layer** — foreground text and icons on top, full opacity.

### Surface tiers

Four tiers of glass, ordered by blur intensity. Pick the tier by how much the surface needs to separate from content behind it.

```css
:root {
  /* Glass tier blur values (backdrop-filter) */
  --glass-blur-subtle: 8px;      /* Chips, badges, hover elevations */
  --glass-blur-regular: 16px;    /* Cards, LiveLog, Wedge card */
  --glass-blur-heavy: 24px;      /* Modal overlays, AskInline */
  --glass-blur-ultra: 40px;      /* Spotlight modal chrome */

  /* Glass tint (semi-transparent backgrounds) — light mode */
  --glass-tint-subtle: 0 0% 100% / 0.55;     /* 55% white */
  --glass-tint-regular: 0 0% 100% / 0.70;    /* 70% white */
  --glass-tint-heavy: 0 0% 100% / 0.80;      /* 80% white */
  --glass-tint-ultra: 0 0% 100% / 0.88;      /* 88% white */

  /* Specular highlight (inner top edge "light catch") */
  --glass-specular: 0 0% 100% / 0.60;        /* bright inner top */
  --glass-specular-sub: 0 0% 100% / 0.30;    /* secondary sides */

  /* Glass borders (thin outer definition) */
  --glass-border: 0 0% 100% / 0.18;          /* hairline */
  --glass-border-strong: 0 0% 0% / 0.08;     /* under light backdrop */

  /* Saturation boost to make blurred content feel "glassy" not "foggy" */
  --glass-saturation: 180%;
}
```

### Glass utility classes

Define once in `app/globals.css` as `@layer components`, then use anywhere:

```css
@layer components {
  .glass-subtle {
    background: hsl(var(--glass-tint-subtle));
    backdrop-filter: blur(var(--glass-blur-subtle)) saturate(var(--glass-saturation));
    -webkit-backdrop-filter: blur(var(--glass-blur-subtle)) saturate(var(--glass-saturation));
    border: 1px solid hsl(var(--glass-border));
    box-shadow:
      inset 0 1px 0 0 hsl(var(--glass-specular)),          /* top specular */
      inset 0 -1px 0 0 hsl(var(--glass-specular-sub));     /* bottom return */
  }
  .glass-regular { /* same shape, --glass-blur-regular + --glass-tint-regular */ }
  .glass-heavy   { /* same shape, --glass-blur-heavy   + --glass-tint-heavy   */ }
  .glass-ultra   { /* same shape, --glass-blur-ultra   + --glass-tint-ultra   */ }
}
```

### Mapping components to tiers

| Component | Tier | Why |
|---|---|---|
| FactsStrip chips, evidence chips | `glass-subtle` | Small surface, minimal separation needed |
| LiveLog card, PostCard, default cards | `glass-regular` | Core content surfaces |
| WedgeCard (Screen 3 hero) | `glass-regular` + larger inset specular | Hero moment but readability is sacred |
| AskInline card | `glass-heavy` | Needs to stand out from LiveLog stream |
| Hero strip (Screen 2) | `glass-regular` | Sits above the log, subtle elevation |
| Spotlight modal | `glass-ultra` | Demo climax — the most glass of all glass |
| ChannelTabs active indicator | `glass-subtle` | Thin pill behind active label |

### Background canvas — what the glass blurs against

Glass needs content behind it or it looks like a gray box. Two strategies:

1. **Screens with live content** (Research log, Calendar) — the streaming events and post cards provide the backdrop naturally. Glass surfaces sit on top.
2. **Screens with sparse content** (Screen 1 URL input, Screen 3 Confirm before scroll) — the `<body>` carries a subtle gradient mesh backdrop so glass has something to refract. Use a radial-gradient + noise texture:

```css
body {
  background:
    radial-gradient(ellipse 80% 60% at 20% 10%, hsl(38 92% 50% / 0.08), transparent 60%),
    radial-gradient(ellipse 70% 50% at 80% 90%, hsl(217 91% 60% / 0.08), transparent 60%),
    hsl(var(--background));
}
```

Low-saturation amber + blue mesh. The glass surfaces sampling this backdrop inherit a subtle warmth without reading as "tinted purple gradient AI slop."

### Specular highlight — advanced (optional polish)

The basic inset box-shadow above gives 80% of the Apple effect. For the Spotlight modal only, optionally add an SVG-based specular using `feSpecularLighting` for a truly directional light-catch. Budget: skip unless there's time post-demo. The inset shadow is enough.

### Refraction (deferred)

True refraction (content behind glass visibly bends at the edges) requires SVG `feDisplacementMap` with `feTurbulence` noise. Expensive, finicky cross-browser. **Out of scope for the hackathon.** `backdrop-filter: blur + saturate` gives the perceived glass quality without it. Flag as a post-hackathon polish opportunity.

### Accessibility — critical

```css
@media (prefers-reduced-transparency: reduce) {
  .glass-subtle, .glass-regular, .glass-heavy, .glass-ultra {
    background: hsl(var(--background));
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
    border-color: hsl(var(--border));
    box-shadow: none;
  }
}
```

Users with `prefers-reduced-transparency` get opaque surfaces. Never ship glass as a required visual for comprehension — it's a texture, not a signal. Keep borders and typography carrying the information.

### Browser support

`backdrop-filter` ships in Safari 9+, Chrome 76+, Firefox 103+, Edge 79+. All targets for a desktop demo. No fallback needed beyond the reduced-transparency media query above.

### What glass replaces

Glass replaces the cards-and-shadows approach from §4 on **every surface listed in the table above**. The §4 elevation scale (`--shadow-none`, `--shadow-sm`, `--shadow-md`) still applies to non-glass surfaces (e.g., the gold spotlight ring still uses `--shadow-ring`). Glass surfaces do not use the shadow scale — the specular inset IS their elevation treatment.

---

## 4. Spacing & radius

**Spacing scale:** Tailwind default 4px scale only (`p-1`, `p-2`, `p-4`, `p-6`, `p-8`, `p-12`). Arbitrary values (`p-[13px]`) banned.

**Radius** — calibrated to Apple Liquid Glass (larger, softer curves than shadcn defaults):

```css
:root {
  --radius-chip: 9999px;      /* pills, badges, evidence chips */
  --radius-input: 10px;       /* inputs, small buttons */
  --radius-card: 18px;        /* cards, LiveLog, WedgeCard, PostCard */
  --radius-modal: 28px;       /* Spotlight modal, AskInline */
  --radius-hero: 32px;        /* Hero strip on Screen 2 */
}
```

Assign to Tailwind theme tokens so classes read `rounded-card`, `rounded-modal`, etc.:

```ts
// tailwind.config.ts
borderRadius: {
  chip: "9999px",
  input: "10px",
  card: "18px",
  modal: "28px",
  hero: "32px",
}
```

**Why larger:** Apple Liquid Glass surfaces use noticeably rounder corners than Material / shadcn defaults (iOS 26 cards are ~20px+, modals ~28px+). This is part of what reads as "Apple" — borrowed directly.

**Radius diversity rule:** inputs and cards must not share the same radius scale. Inputs = 10px, cards = 18px, modals = 28px. Uniform radius across every surface is the AI-slop pattern (see §7 rule 5).

**Elevation / shadow scale** — four levels, used sparingly:

```css
:root {
  --shadow-none: none;                                      /* default cards */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.04);              /* hover-elevated card */
  --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.08);          /* Spotlight modal */
  --shadow-ring: 0 0 0 4px hsl(var(--accent-spotlight));    /* spotlight gold ring */
}
```

Rules:
- Default cards carry NO shadow. Borders + whitespace do the separation work.
- `--shadow-sm` only on interactive hover (PostCard hover on Screen 4 calendar).
- `--shadow-md` only on the Spotlight modal.
- No ornamental drop-shadows on text, icons, or buttons. Ever.

**Density tokens** — component internal spacing:

| Density | Use case | Padding | Gap |
|---|---|---|---|
| Compact | FactsStrip chips, PostCard, evidence chips | `p-2` / 8px | `gap-1` / 4px |
| Comfortable | WedgeCard, AskInline, default cards | `p-6` / 24px | `gap-4` / 16px |
| Spacious | Spotlight modal internal sections | `p-8` / 32px | `gap-6` / 24px |

Consistent density per context. Mixing compact and comfortable inside the same card is the AI-slop tell.

---

## 5. Motion

Motion has three jobs: **sequence** (what happens next), **hierarchy** (what matters most), **continuity** (spatial relationships don't break). Never decorative.

| Element | Duration | Easing | Notes |
|---|---|---|---|
| LiveLog event appears | 200ms | ease-out | Opacity 0→1 + 2px translate-y |
| Older log events dim | 300ms | linear | 100% → 60% opacity |
| ThinkingDot pulse | 1500ms | ease-in-out infinite | Opacity 0.4 ↔ 1.0 |
| AskInline fade-in | 200ms | ease-out | Card enters, input autofocuses |
| Screen 2 → 3 transition | 300ms | ease-in-out | Crossfade, not slide |
| Wedge card entrance | 300ms | ease-out | Opacity + 4px translate-y |
| Post card shimmer | 300ms | ease-out | Opacity 0→1 + scale 0.98→1.0 |
| Gold ring on spotlight | 400ms | spring (stiffness 300, damping 20) | `ring-4 ring-amber-400` |
| Grid dim around spotlight | 300ms | ease-in-out | 100% → 40% opacity (non-spotlight cards) |
| Spotlight modal crossfade | 300ms | ease-in-out | After 600ms `calendar_done` + breathe delay |
| Rationale line-by-line | 150ms per line | ease-out | Sequential fade-in |
| Evidence connector draw | 300ms | ease-out | SVG stroke-dashoffset |

**Glass-specific motion:**

| Element | Duration | Notes |
|---|---|---|
| Glass surface entrance | 400ms | `backdrop-filter` transitions from `blur(0px)` to target blur, with `opacity 0 → 1`. Makes surfaces feel like they "materialize." |
| Glass hover elevation | 200ms | Blur steps up one tier (e.g., regular → heavy) on hover for interactive glass (PostCard, evidence chips). Creates Apple-like responsiveness to pointer. |
| Specular drift (Spotlight modal only) | 8s loop, ease-in-out | The inset top-specular subtly slides left↔right 4px to simulate the "living glass" effect. Optional polish; skip if it distracts. |

**Reduced motion:** respect `prefers-reduced-motion: reduce`. All durations drop to 0ms; opacity end-states remain; spring collapses to instant. The gold ring still appears; the card just doesn't animate in. **Specular drift is disabled entirely under reduced-motion.**

**Reduced transparency:** per §3.5, glass-specific motion also disabled when `prefers-reduced-transparency: reduce` — surfaces become opaque and the blur transitions have no meaning.

---

## 6. Component vocabulary

Every primitive comes from **shadcn/ui**. No hand-rolled buttons, inputs, dialogs, radio groups, checkboxes, skeletons, cards, or tooltips.

**Required primitives** (install via `bunx shadcn@latest add <name>`):
`button`, `input`, `textarea`, `label`, `card`, `badge`, `separator`, `dialog`, `radio-group`, `checkbox`, `skeleton`, `tooltip`, `tabs`

**Custom components compose primitives:**
- `<WedgeCard>` — Screen 3 hero (composes `Card` + `Separator`)
- `<FactsStrip>` — 3 compressed chips (composes `Badge`)
- `<LiveLog>` — scrolling event list (composes `Card` + custom left-accent bars)
- `<AskInline>` — in-log poll (composes `RadioGroup` / `Checkbox` + `Input` + `Button`)
- `<PostCard>` — calendar cell (composes `Card`)
- `<Spotlight>` — modal (composes `Dialog` + custom 2-column layout + SVG connectors)
- `<Favicon>` — Google s2 lookup with letter-tile fallback

**What's not allowed:**
- Importing Radix primitives directly (always go through shadcn wrapper).
- Ad-hoc button styles (`<button className="bg-blue-500">`). Always `<Button variant=...>`.

---

## 7. Anti-slop hard rules

The marketing-agent product cannot look AI-generated. These are absolute.

1. **No purple/indigo gradient backgrounds.** No blue-to-purple hero sweeps. The §3.5 warm-amber + blue mesh backdrop is the one allowed gradient and it's low-saturation (8% alpha) specifically to avoid tinted-purple AI slop.
2. **No 3-column feature grid.** Anywhere.
3. **No icon-in-colored-circle section decoration.**
4. **No centered-everything.** Body copy is left-aligned. Center-align only earns its place on modal titles and empty states.
5. **No uniform bubbly border-radius.** Inputs and cards have different scales.
6. **No decorative blobs, floating circles, wavy SVG dividers.** If a section feels empty, write better content.
7. **No emoji as design elements in chrome.** Emoji inside generated post content is fine (it's the product), but not in labels, headers, or buttons.
8. **No colored left-border on cards as decoration.** Left-accent bars on LiveLog events are semantic (they encode event kind), not decoration.
9. **No generic hero copy.** "Tell us about your brand." not "Unlock the power of..."
10. **No cookie-cutter marketing rhythm.** This product has 4 functional screens, not a landing page.

Source: gstack design methodology + OpenAI "Designing Delightful Frontends" (2026).

---

## 7.5 Anti-slop rules for LLM-generated content

**UI chrome is the small slop surface. The actual slop risk is the LLM output itself** — the fact text in the LiveLog, the rationale paragraph in the Spotlight, the captions and hooks inside the 90 post cards. If the content reads as generic AI, no amount of editorial typography can save the demo.

Bake these into the prompts in §9 of PLAN.md. Validate in code when feasible (post-generation filters).

**Ban list — these phrases/patterns fail generation and trigger retry:**

- **Hype verbs:** "unlock", "unleash", "supercharge", "elevate", "transform", "revolutionize", "empower", "harness", "leverage" (as a verb)
- **Filler adjectives:** "authentic", "engaging", "meaningful", "impactful", "seamless", "innovative", "cutting-edge", "robust", "comprehensive"
- **AI tells:** "delve", "crucial", "in today's fast-paced world", "in the realm of", "at the intersection of", "it's worth noting", "it's important to", "navigate the landscape"
- **Marketing-copywriter second person:** "You deserve...", "Imagine if...", "What if we told you..."
- **Generic openers:** captions starting with a one-word noun + colon ("Hypertension:"), rhetorical questions as hooks ("Ever wonder why..."), or "In this post..."
- **Platitude CTAs:** "Learn more", "Join the conversation", "Share your thoughts below"
- **Sentence structures that scream GPT:** "It's not just X, it's Y." triads; "Here's the thing:"; "The reality is..."

**Required specificity rules — every generated block must include:**

- **At least one concrete number** (view count, follower count, time of day, percentage, specific date). Abstract claims without numbers fail.
- **At least one direct quote** from scraped content (for rationale blocks, evidence lines). Paraphrase without attribution fails.
- **Named entity references** — real handles (`@balanceyourbp_`), real hashtags (`#unicity`), real product names. Generic references ("your competitors", "the niche") fail unless immediately followed by specifics.
- **Evidence citation** on every `ResearchFact`: either a URL, a quoted phrase from scraped content, or a specific count. No bare claims.

**Structural rules — content shape:**

- **TikTok captions** ≤ 150 chars, first-line-is-the-hook convention, one-emoji-max (banned in chrome but allowed in content), no hashtag-stuffing (2-3 max).
- **Instagram captions** 3-5 short lines, hook first, narrative middle, CTA last, 5-7 hashtags end of caption (visibly separated by a line break or `.` divider, not inline in the narrative).
- **LinkedIn captions** start with a specific observation or number, never "I" as the first word, never "thrilled to announce", 120-300 words, one line break per sentence for scannability.
- **Rationale paragraphs (Spotlight modal)** 2-3 sentences max. Must name the exact research finding being reused (with quote) AND the specific signal informing the decision (with number). "This post reuses [quote] from [source] and is timed [X] because [specific signal]."
- **Fact text (LiveLog)** one line, starts with a specific noun phrase not a generic category. "Top post: 'your doctor has 7 minutes' — 40K views" beats "ICP analysis: adults 50+ interested in health."

**Voice calibration — this is an agent, not a marketer:**

- **Agent speaks in first person singular** when it speaks ("I noticed your top-performing hook..."). Never "we" (implies corporate voice), never third person ("the system detected").
- **Observation before prescription.** Lead with what was found, then what to do about it. "Your competitors avoid medical-dismissal content. Your 40K-view post leaned into it. Lean in harder." — not "Recommendation: create more medical-dismissal content."
- **Short sentences beat long ones.** If a generated sentence exceeds 25 words, split it or cut it.
- **No hedging.** Ban "might", "could potentially", "may be worth considering". If the evidence supports the claim, state it. If not, don't emit the fact.

**Validation hooks:**

- Post-generation regex filter against the ban list — matched captions are regenerated up to 2 times before emitting with an `error: true` flag.
- Rationale validation: must contain at least one quoted string (`"..."`) AND at least one numeric token (`\d+(K|k|%|\.)?`). Fails both → retry once, then fallback to the pre-baked fixture rationale.
- Fact validation: must have non-empty `evidence` field. Empty evidence → drop the fact (never display a bare claim).

---

## 7.6 shadcn default overrides — wire shadcn to Liquid Glass

Default shadcn is beautifully built but visually neutral — shipped as-is it reads as "SaaS dashboard template." Our overrides swap shadcn's default shadow-based elevation for the Glass material from §3.5. shadcn stays for accessibility, keyboard handling, focus management, and Radix primitives; we restyle the surfaces.

Mechanics: shadcn components live in `components/ui/` as plain React + Tailwind. Change the `className` defaults in those files to compose our glass + radius + font tokens.

- **Button** — default variant: `bg-foreground text-background rounded-input` (near-black, no blue). Secondary variant: `.glass-subtle text-foreground rounded-input hover:glass-regular`. No drop shadows. No gradients. The secondary button IS glass — this is where users feel the material most often.
- **Input** — `.glass-subtle rounded-input` with a 1px `border-glass-border`. Focus ring uses `--ring-focus` from §3 (2px solid, 2px offset) layered over the glass border. Placeholder at 60% opacity muted-foreground. `font-sans` explicit (Tailwind `sans` now points to Inter per §2).
- **Card** — drop the default `shadow-sm`. Compose `.glass-regular rounded-card` as the new baseline. No ornamental border — the glass border + specular inset do the work.
- **Dialog (Spotlight + AskInline base)** — overlay is `bg-black/40 backdrop-blur-sm` (the calendar behind stays faintly visible and slightly refracted, matching §10.4 entrance choreography in PLAN.md). Content surface uses `.glass-ultra rounded-modal`. Remove shadcn's default `shadow-lg` — glass specular is the elevation.
- **Tabs (ChannelTabs)** — underline indicator. Active tab = `text-foreground` with a 2px bottom border in `--accent-fact`; inactive = `text-muted-foreground`. Tab list container can be `.glass-subtle rounded-input` for a subtle floating toolbar feel.
- **RadioGroup / Checkbox (AskInline)** — each option row is `.glass-subtle rounded-input p-3` with a 32px min hit target. Selected state: 2px left-border in `--accent-ask` (violet) + tint shift to `.glass-regular`. The selection change animates the glass tier transition per §5 (200ms).
- **Badge / Chip** — `.glass-subtle rounded-chip text-xs font-medium`. Color-coded tags (WORKING/UNDERPERFORMING, evidence-kind) use semantic tokens from §3 applied as `text-` color, not as the chip's background — keep the chip glass so it belongs to the material language.
- **Skeleton** — glass tint base (`.glass-subtle`) with a left-to-right shimmer overlay (gradient moving across, 1.5s loop). Matches the PostCard shimmer-in so loading → loaded feels continuous.
- **Tooltip** — `.glass-heavy rounded-input` with a small arrow. Text `text-xs text-foreground`.
- **Separator** — `bg-glass-border` at 40% opacity. Never a solid line inside glass; solid lines break the refraction.

Principle: **shadcn gives you accessibility and correctness for free; our overrides wire every default surface to Liquid Glass.** Shipping default shadcn is shipping the SaaS template you're trying to distinguish from. Shipping glass-wrapped shadcn is shipping a 2026 Apple-aesthetic app.

---

## 8. Accessibility baseline

Full a11y is post-hackathon. These minimums prevent the demo from being visibly broken.

- **Use shadcn primitives** — they ship with ARIA roles, focus rings, keyboard handlers. Don't regress them.
- **Tab order:** predictable left-to-right, top-to-bottom per screen.
- **Color contrast:** body ≥4.5:1, muted-foreground ≥4.5:1.
- **Spotlight gold ring:** 3px thickness (vs 1px hover) so colorblind users can still distinguish it.
- **Every input has a visible label.** No placeholder-as-label.
- **Alt text** on post thumbnails. `alt=""` on decorative avatars next to handle text.
- **Reduced motion:** respect the OS preference.
- **Focus-visible rings** never removed without a visible replacement.

---

## 9. What's not defined here (deferred)

- Mobile responsive layouts. Scope-cut in PLAN.md §15. Desktop demo only (min 1280×800).
- Dark mode. Light only for the hackathon.
- Motion choreography beyond §5 table. One-shot animations only; no persistent ambient motion (the Spotlight specular drift in §5 is opt-in polish, not required).
- True SVG-based refraction (feDisplacementMap + feTurbulence) for glass edges. `backdrop-filter: blur + saturate` is the shipping approximation per §3.5. Real refraction is post-hackathon.
- WebGL specular highlights on glass. Inset box-shadow per §3.5 is the shipping approximation.
- Glass dark mode. Glass in dark mode inverts (`--glass-tint-*` become low-alpha blacks, specular becomes low-alpha whites on top) but we're light-only for hackathon.
- Full a11y audit (WCAG AA conformance testing, screen-reader pass on SSE-streamed content).
- Illustration or custom iconography. Lucide icons (via shadcn) are the full icon set.
- Print styles.

---

## 10. Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-04-18 | Instrument Serif for headlines, Inter for body | Two typefaces max. Editorial serif signals "made by a person with taste"; Inter is neutral and readable for UI. |
| 2026-04-18 | Gold amber as spotlight accent | Gold = prestige. Amber reads as "earned attention" without looking like a notification badge. |
| 2026-04-18 | Violet for `ask` event bar | Must be distinct from amber (in-flight), emerald (done), blue (fact). Violet sits opposite on the wheel and reads as "different modality" (conversation, not tool call). |
| 2026-04-18 | `post-left, evidence-right` Spotlight layout | Evidence IS the UI. The rationale must visibly connect to its sources via connector lines. |
| 2026-04-18 | `AskInline` (not modal) | The ask is part of the agent narrative. A modal breaks "the agent is talking to me" feeling. |
| 2026-04-18 | First-person headers on Screen 3 facts strip | "I think you're selling to..." beats "Your ICP." Agent voice throughout. |
| 2026-04-18 | **Apple Liquid Glass as the visual identity** (§3.5) | WWDC 2025 introduced Liquid Glass as Apple's first major UI overhaul in a decade. Adopting it on the web via `backdrop-filter: blur + saturate` + semi-transparent surfaces + inset specular highlight gives the app a 2026 Apple-aesthetic feel (iOS 26 / macOS Tahoe 26) without WebGL. The calendar grid and live log provide natural backdrops for glass surfaces to sample. Shadcn stays for accessibility and Radix primitives; we restyle every surface to the glass material. |
| 2026-04-18 | Larger border-radius scale than shadcn default | Apple Liquid Glass surfaces use noticeably rounder corners (iOS 26 cards ~18px, modals ~28px). The diverse radius scale (10/18/28/32) also breaks the uniform-bubbly AI-slop pattern. |
| 2026-04-18 | `next/font` wiring made explicit in §2 with CSS vars + Tailwind config | Earlier draft named the typefaces but didn't wire them. Without concrete `next/font` loaders + `--font-sans` / `--font-serif` CSS vars + Tailwind `fontFamily` config, shadcn components fall back to system-ui and the identity collapses. |
