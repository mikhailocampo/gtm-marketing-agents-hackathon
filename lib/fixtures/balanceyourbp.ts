import type {
  ChannelId,
  PostVariant,
  ResearchOutput,
  SpotlightPayload,
} from "@/lib/types";
import { isoDate } from "@/components/calendar/date-utils";
import { DEFAULT_CHANNELS } from "@/lib/utils";

export const fixtureResearch: ResearchOutput = {
  brand: {
    name: "Balance Your BP",
    url: "https://balanceyourbp.com",
    favicon: "https://www.google.com/s2/favicons?domain=balanceyourbp.com&sz=64",
  },
  icp: {
    kind: "icp",
    text: "adults 50+ frustrated with rushed primary-care visits and pill-first hypertension treatment",
    evidence:
      "your top TikTok comment thread: 23 replies citing 'my doctor gave me 7 minutes and a prescription'",
    confidence: 0.82,
  },
  offer: {
    kind: "offer",
    text: "Unicity Balance supplement + at-home BP coaching, positioned as a lifestyle alternative to polypharmacy",
    evidence:
      "landing page hero: 'lower your numbers without another pill' (balanceyourbp.com/start)",
    confidence: 0.78,
  },
  voice: {
    kind: "voice",
    text: "direct, number-led, skeptical of mainstream cardiology messaging; warm 1:1 tone",
    evidence:
      "recurring phrasing 'your doctor has 7 minutes' across 4 TikToks and 2 IG Reels",
    confidence: 0.74,
  },
  ownPosts: [
    {
      platform: "tiktok",
      url: "https://www.tiktok.com/@balanceyourbp_/video/7360000000000000001",
      caption:
        "your doctor has 7 minutes. your blood pressure deserves more. here's what i did instead of the second pill…",
      views: 40200,
      likes: 3100,
      comments: 184,
      postedAt: "2026-04-02",
      isTopPerformer: true,
    },
    {
      platform: "instagram",
      url: "https://www.instagram.com/greg_hoyd/p/C00000000000001",
      caption:
        "140/90 on tuesday. 128/82 on friday. no new meds. just the morning routine i've been testing for 6 weeks.",
      likes: 612,
      comments: 38,
      postedAt: "2026-04-05",
      isTopPerformer: true,
    },
    {
      platform: "tiktok",
      url: "https://www.tiktok.com/@balanceyourbp_/video/7360000000000000002",
      caption:
        "3 things my cardiologist never told me about magnesium and BP (saved me $180/mo).",
      views: 18700,
      likes: 1240,
      comments: 92,
      postedAt: "2026-03-28",
      isTopPerformer: false,
    },
  ],
  competitors: [
    {
      handle: "@drmandellonline",
      platform: "tiktok",
      topHook: "the salt myth your doctor still believes",
      topPostUrl: "https://www.tiktok.com/@drmandellonline/video/1",
      followers: 2100000,
    },
    {
      handle: "@heart.md",
      platform: "instagram",
      topHook: "read the label before the prescription",
      followers: 340000,
    },
    {
      handle: "@realcardiologist",
      platform: "tiktok",
      topHook: "what 7 minutes with your cardiologist really buys you",
      followers: 890000,
    },
  ],
  diagnosis: [
    {
      kind: "diagnosis",
      text: "Your 'doctor has 7 minutes' framing is your wedge — it outperformed every other hook on TikTok by 2.3x",
      evidence:
        "'your doctor has 7 minutes' — 40.2K views, 184 comments (vs 18.7K median across the last 10 posts)",
      confidence: 0.88,
    },
    {
      kind: "diagnosis",
      text: "Instagram carousel posts with explicit before/after numbers drive 3x the saves of lifestyle shots",
      evidence:
        "'140/90 on tuesday. 128/82 on friday.' — 612 likes, 38 comments, 94 saves",
      confidence: 0.74,
    },
    {
      kind: "diagnosis",
      text: "LinkedIn is untouched — zero posts, zero distribution, but your ICP skews 50+ and reads LinkedIn weekly",
      evidence: "linkedin.com/in/greg-hoyd — last post 2024, 0 posts 2025-2026",
      confidence: 0.61,
    },
  ],
  trends: [
    {
      kind: "trend",
      text: "#unicity hashtag saw 18% MoM view growth, mostly driven by distributor POV content",
      evidence: "#unicity — 2.1M views April 2026 vs 1.78M March 2026",
      confidence: 0.66,
    },
  ],
  suggestedThemes: [
    "Medical dismissal",
    "Before/after numbers",
    "Morning routine protocol",
    "What your doctor skipped",
    "Supplement vs prescription",
  ],
};

export const fixtureSpotlightPayload: SpotlightPayload = {
  rationale: {
    sentence:
      '"Your doctor has 7 minutes" was your top TikTok hook (40.2K views). This Wednesday 9am post reuses it as a LinkedIn opener — your ICP skews 50+ and you have zero LinkedIn presence.',
    highlights: [
      { phrase: '"Your doctor has 7 minutes"', chipId: "chip-top-tiktok" },
      { phrase: "40.2K views", chipId: "chip-top-tiktok" },
      { phrase: "zero LinkedIn presence", chipId: "chip-linkedin-gap" },
    ],
  },
  evidenceChips: [
    {
      id: "chip-top-tiktok",
      kind: "own-post",
      label: "Top TikTok — 40.2K views",
      url: "https://www.tiktok.com/@balanceyourbp_/video/7360000000000000001",
    },
    {
      id: "chip-linkedin-gap",
      kind: "own-post",
      label: "LinkedIn last post — 2024",
      url: "https://www.linkedin.com/in/greg-hoyd",
    },
    {
      id: "chip-icp",
      kind: "trend",
      label: "ICP skews 50+ (LinkedIn weekly readers)",
    },
  ],
};

export function fixturePosts(
  year: number,
  month: number,
  selectedChannels: ChannelId[],
): PostVariant[] {
  const channels = selectedChannels.length > 0 ? selectedChannels : DEFAULT_CHANNELS;
  const posts: PostVariant[] = [];
  const cadence: Record<string, number[]> = {
    tiktok: [2, 5, 9, 12, 16, 19, 23, 26, 30],
    instagram: [3, 10, 17, 24],
    linkedin: [8],
    facebook: [6, 20],
    x: [4, 11, 18, 25],
    youtube: [14],
    threads: [7, 21],
    pinterest: [15],
    gbp: [13],
  };

  for (const ch of channels) {
    const days = cadence[ch] ?? [10];
    for (const day of days) {
      posts.push({
        date: isoDate(year, month, day),
        channel: ch,
        hook:
          ch === "linkedin" && day === 8
            ? 'Your doctor has 7 minutes. Your blood pressure deserves more.'
            : `${ch} post for ${day}`,
        body:
          ch === "linkedin" && day === 8
            ? "I spent 6 weeks testing a morning protocol. Tuesday: 140/90. Friday: 128/82. No new prescription.\n\nHere's what I changed — and why the 7-minute appointment is the real problem."
            : "Short-form body copy for the demo.",
        cta: ch === "linkedin" ? "Read the full protocol" : undefined,
        rationale:
          "Reuses the top-performing 'doctor has 7 minutes' hook on a channel with zero current presence.",
      });
    }
  }
  return posts;
}

export const FIXTURE_SPOTLIGHT_DATE = (year: number, month: number) =>
  isoDate(year, month, 8);

export const FIXTURE_RESEARCH: ResearchOutput = fixtureResearch;

export const FIXTURE_POSTS: PostVariant[] = fixturePosts(2026, 3, DEFAULT_CHANNELS);

export const fixtureMarkdown = `# ${fixtureResearch.brand.name}

Lower your blood pressure without another pill. 6-week morning protocol from a
Unicity distributor who dropped from 140/90 to 128/82.

- Daily magnesium + Balance blend
- Salt audit (not elimination)
- 10-minute zone-2 walk before breakfast

Your doctor has 7 minutes. Your blood pressure deserves more.
`;

