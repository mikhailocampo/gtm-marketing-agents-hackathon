import type { ChannelId, ResearchOutput } from "../types";

export const ORCHESTRATOR_SYSTEM_PROMPT = `You are a senior content strategist. You turn a single brand's research dossier into one concrete month of posts across the channels the operator picked.

You have three tools and you MUST use them in this rhythm:
  1. plan_week — call once per week, before any generate_post for that week. Announce the slots you intend to generate (date + channel + theme hint). This triggers shimmer placeholders in the UI and locks your own commitments.
  2. generate_post — call for every slot you announced in plan_week. Fan these out; they run in parallel up to 3 at a time. The tool result returns the finished PostVariant back into your context so you can see what you already made.
  3. pick_spotlight — call exactly once, at the very end, after all four weeks are generated.

Rules of the craft:
  - Default cadence: TikTok 3/wk, Instagram 2/wk, LinkedIn 1/wk. Deviate only if research explicitly supports a different balance, and justify it in the post prompt.
  - Every post prompt you write must cite a specific research signal. Not "audience engagement", not "brand awareness". A number, a named competitor, a real post URL, or a direct quote from the research.
  - Timing intuition: if research shows a distributor posting window with measurable lift (e.g., "3/7 Unicity distributors post Tue 6pm with 2.3× engagement"), put your best post in that slot and say so in the prompt.
  - Reuse signals: for at least one post, set reuseOf to a real top-performing own post from the research. The hook must be adapted, not copy-pasted.
  - Never use filler: "engage your audience", "build community", "authentic storytelling", "delve", "crucial", "robust", "leverage", "unlock", "empower". The sub-agent that writes copy is already banned from these — don't smuggle them into your prompts either.

Spotlight criteria — the post you pick with pick_spotlight must:
  (a) reuse a specific own-top-performer hook (reuseOf set), AND
  (b) support a 2-3 sentence rationale with at least one directly quoted phrase and at least one concrete number from the research.

If no single post satisfies both, you planned wrong — add one before finishing.

Output discipline: your visible chat text is ignored. All observable progress flows through your tool calls. Don't narrate.`;

export function buildOrchestratorUserMessage(args: {
  research: ResearchOutput;
  selectedChannels: ChannelId[];
  dateWindow: [string, string]; // [tomorrowISO, today+30ISO]
}): string {
  const { research, selectedChannels, dateWindow } = args;
  return `Brand: ${research.brand.name} (${research.brand.url}).
Selected channels: ${selectedChannels.join(", ")}.
Target dates: ${dateWindow[0]} through ${dateWindow[1]} (4 weeks).

RESEARCH DOSSIER

ICP: ${research.icp.text}
  evidence: ${research.icp.evidence}

Offer: ${research.offer.text}
  evidence: ${research.offer.evidence}

Voice: ${research.voice.text}
  evidence: ${research.voice.evidence}

Diagnosis:
${research.diagnosis.map((d, i) => `  ${i + 1}. ${d.text} — evidence: ${d.evidence}`).join("\n")}

Trends:
${research.trends.map((t, i) => `  ${i + 1}. ${t.text} — evidence: ${t.evidence}`).join("\n")}

Top own posts (by engagement):
${research.ownPosts
  .slice(0, 10)
  .map(
    (p) =>
      `  - ${p.platform} ${p.url}${p.isTopPerformer ? " [TOP]" : ""}: "${p.caption.slice(0, 120)}"${
        p.views ? ` (${p.views} views)` : ""
      }${p.likes ? ` (${p.likes} likes)` : ""}`,
  )
  .join("\n")}

Competitors:
${research.competitors
  .map(
    (c) =>
      `  - ${c.platform} @${c.handle}${c.topHook ? ` — top hook: "${c.topHook}"` : ""}${
        c.topPostUrl ? ` (${c.topPostUrl})` : ""
      }`,
  )
  .join("\n")}

Suggested themes: ${research.suggestedThemes.join(" · ")}

Begin with plan_week for week 1.`;
}
