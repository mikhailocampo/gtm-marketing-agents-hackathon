import { z } from "zod";

// ────────────────── Primitives ──────────────────

export const ChannelIdSchema = z.enum([
  "tiktok",
  "instagram",
  "linkedin",
  "facebook",
  "x",
  "youtube",
  "threads",
  "pinterest",
  "gbp",
]);
export type ChannelId = z.infer<typeof ChannelIdSchema>;

export const SessionIdSchema = z.string().min(1);
export type SessionId = z.infer<typeof SessionIdSchema>;

export const SocialSchema = z.object({
  platform: ChannelIdSchema,
  handle: z.string(),
  url: z.string().url(),
});
export type Social = z.infer<typeof SocialSchema>;

// ────────────────── Research ──────────────────

export const ResearchFactSchema = z.object({
  kind: z.enum([
    "icp",
    "offer",
    "voice",
    "channel",
    "competitor",
    "diagnosis",
    "trend",
    "insight",
  ]),
  text: z.string().min(1),
  evidence: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export type ResearchFact = z.infer<typeof ResearchFactSchema>;

export const ExistingPostSchema = z.object({
  platform: ChannelIdSchema,
  url: z.string().url(),
  caption: z.string(),
  likes: z.number().int().nonnegative().optional(),
  comments: z.number().int().nonnegative().optional(),
  views: z.number().int().nonnegative().optional(),
  postedAt: z.string().optional(),
  isTopPerformer: z.boolean().optional(),
});
export type ExistingPost = z.infer<typeof ExistingPostSchema>;

export const CompetitorSchema = z.object({
  handle: z.string(),
  platform: ChannelIdSchema,
  topHook: z.string().optional(),
  topPostUrl: z.string().url().optional(),
  followers: z.number().int().nonnegative().optional(),
});
export type Competitor = z.infer<typeof CompetitorSchema>;

export const ResearchOutputSchema = z.object({
  brand: z.object({
    name: z.string(),
    url: z.string().url(),
    favicon: z.string().url(),
  }),
  icp: ResearchFactSchema,
  offer: ResearchFactSchema,
  voice: ResearchFactSchema,
  ownPosts: z.array(ExistingPostSchema),
  competitors: z.array(CompetitorSchema),
  diagnosis: z.array(ResearchFactSchema),
  trends: z.array(ResearchFactSchema),
  suggestedThemes: z.array(z.string()),
});
export type ResearchOutput = z.infer<typeof ResearchOutputSchema>;

// ────────────────── Calendar ──────────────────

export const PostVariantSchema = z.object({
  date: z.string(),
  channel: ChannelIdSchema,
  hook: z.string(),
  body: z.string(),
  cta: z.string().optional(),
  rationale: z.string(),
  mediaUrl: z.string().url().optional(),
  mediaKind: z.enum(["image", "video"]).optional(),
  reuseOf: z
    .object({
      kind: z.enum(["own", "competitor"]),
      postUrl: z.string().url(),
      hookText: z.string(),
    })
    .optional(),
  trendSignal: z.string().optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});
export type PostVariant = z.infer<typeof PostVariantSchema>;

export const SpotlightPayloadSchema = z.object({
  rationale: z.object({
    sentence: z.string(),
    highlights: z.array(z.object({ phrase: z.string(), chipId: z.string() })),
  }),
  evidenceChips: z.array(
    z.object({
      id: z.string(),
      kind: z.enum(["own-post", "competitor", "trend"]),
      label: z.string(),
      url: z.string().url().optional(),
      thumbnail: z.string().url().optional(),
    }),
  ),
});
export type SpotlightPayload = z.infer<typeof SpotlightPayloadSchema>;

export const SpotlightRefSchema = z.object({
  date: z.string(),
  channel: ChannelIdSchema,
  payload: SpotlightPayloadSchema.optional(),
});
export type SpotlightRef = z.infer<typeof SpotlightRefSchema>;

export const CampaignPlanSchema = z.object({
  selectedChannels: z.array(ChannelIdSchema),
  spotlightRef: SpotlightRefSchema.optional(),
});
export type CampaignPlan = z.infer<typeof CampaignPlanSchema>;

// ────────────────── Session ──────────────────

export const SessionStatusSchema = z.enum([
  "researching",
  "ready_to_confirm",
  "generating",
  "done",
  "error",
]);
export type SessionStatus = z.infer<typeof SessionStatusSchema>;

export const SessionStateSchema = z.object({
  sid: SessionIdSchema,
  websiteUrl: z.string().url(),
  socials: z.array(SocialSchema),
  status: SessionStatusSchema,
  research: ResearchOutputSchema.optional(),
  plan: CampaignPlanSchema.optional(),
  posts: z.array(PostVariantSchema),
  error: z.string().optional(),
  startedAt: z.number(),
});
export type SessionState = z.infer<typeof SessionStateSchema>;
