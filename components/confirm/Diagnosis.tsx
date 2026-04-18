"use client";
import type { ExistingPost, ResearchFact } from "@/lib/types";
import { Favicon } from "@/components/ui/Favicon";
import { channelDomain } from "@/lib/utils";
import { diagnosisTag, formatCount } from "./derive";

type Props = { extraFacts: ResearchFact[]; posts: ExistingPost[] };

export function Diagnosis({ extraFacts, posts }: Props) {
  const items = extraFacts.slice(0, 3);
  if (items.length === 0) return null;

  return (
    <section aria-labelledby="diagnosis-heading" className="flex flex-col gap-2">
      <h3
        id="diagnosis-heading"
        className="text-xl font-semibold text-foreground"
      >
        What I see
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {items.map((fact, i) => {
          const tag = diagnosisTag(fact, posts);
          const tagColor =
            tag === "WORKING"
              ? "text-accent-working"
              : "text-accent-underperforming";
          const post = posts.find((p) =>
            fact.evidence.toLowerCase().includes(p.caption.toLowerCase().slice(0, 18)),
          );
          return (
            <article
              key={i}
              className="glass-subtle rounded-card p-3 flex flex-col gap-2"
            >
              {post && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Favicon domain={channelDomain(post.platform)} size={14} />
                  <span className="tabular-nums">
                    {post.views != null
                      ? `${formatCount(post.views)} views`
                      : post.likes != null
                        ? `${formatCount(post.likes)} likes`
                        : ""}
                  </span>
                </div>
              )}
              <p className="text-sm text-foreground leading-snug">{fact.text}</p>
              <span className={`text-[11px] font-medium uppercase tracking-wide ${tagColor}`}>
                {tag}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
