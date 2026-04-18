import type { ExistingPost, ResearchFact, ResearchOutput } from "@/lib/types";
import { formatCount } from "@/lib/utils";

export { formatCount };

export function postMetric(post: ExistingPost): string {
  if (post.views != null) return `${formatCount(post.views)} views`;
  if (post.likes != null) return `${formatCount(post.likes)} likes`;
  return "";
}

export function strongestDiagnosis(facts: ResearchFact[]): ResearchFact | undefined {
  if (facts.length === 0) return undefined;
  let best = facts[0];
  for (const f of facts) {
    if (f.confidence > best.confidence) best = f;
  }
  return best;
}

export function referencedPost(research: ResearchOutput): ExistingPost | undefined {
  const top = strongestDiagnosis(research.diagnosis);
  if (top) {
    const quoted = top.evidence.match(/"([^"]{6,})"|'([^']{6,})'/);
    const needle = (quoted?.[1] ?? quoted?.[2] ?? "").toLowerCase();
    if (needle) {
      const match = research.ownPosts.find((p) =>
        p.caption.toLowerCase().includes(needle),
      );
      if (match) return match;
    }
  }
  const topPerformers = research.ownPosts.filter((p) => p.isTopPerformer);
  const pool = topPerformers.length > 0 ? topPerformers : research.ownPosts;
  return pool
    .slice()
    .sort((a, b) => (b.views ?? b.likes ?? 0) - (a.views ?? a.likes ?? 0))[0];
}

export function matchThemeEvidence(
  theme: string,
  research: ResearchOutput,
): string | undefined {
  const tokens = theme
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return undefined;

  for (const d of research.diagnosis) {
    const hay = `${d.text} ${d.evidence}`.toLowerCase();
    if (tokens.some((t) => hay.includes(t))) {
      const n = d.evidence.match(/(\d[\d,.]*\s*[KkMm]?)\s*(views|likes|comments)/);
      if (n) return `sourced from ${n[0]}`;
      const truncated = d.evidence.length > 60 ? `${d.evidence.slice(0, 60)}…` : d.evidence;
      return `sourced from ${truncated}`;
    }
  }
  for (const p of research.ownPosts) {
    if (tokens.some((t) => p.caption.toLowerCase().includes(t))) {
      const metric = postMetric(p);
      return metric
        ? `sourced from your ${p.platform} post (${metric})`
        : `sourced from your ${p.platform} post`;
    }
  }
  return undefined;
}

export function diagnosisTag(
  fact: ResearchFact,
  posts: ExistingPost[],
): "WORKING" | "UNDERPERFORMING" {
  const evidenceL = fact.evidence.toLowerCase();
  const matched = posts.find((p) => {
    const cap = p.caption.toLowerCase();
    return cap.length > 12 && evidenceL.includes(cap.slice(0, 20));
  });
  if (matched?.isTopPerformer) return "WORKING";
  if (/zero|untouched|no posts|gap|missed/i.test(fact.text + " " + fact.evidence)) {
    return "UNDERPERFORMING";
  }
  return matched ? "WORKING" : "UNDERPERFORMING";
}
