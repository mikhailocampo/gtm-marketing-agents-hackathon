"use client";
import type { ExistingPost, ResearchFact } from "@/lib/types";
import { Favicon } from "@/components/ui/Favicon";
import { channelDomain } from "@/lib/utils";
import { formatCount } from "./derive";

type Props = {
  fact: ResearchFact;
  post?: ExistingPost;
  secondary?: ResearchFact;
};

export function WedgeCard({ fact, post, secondary }: Props) {
  return (
    <section
      className="glass-regular rounded-card p-8 flex flex-col gap-4"
      aria-labelledby="wedge-headline"
    >
      <h2
        id="wedge-headline"
        className="font-serif text-3xl leading-tight text-foreground"
      >
        {fact.text}
      </h2>
      <p className="font-serif italic text-lg text-muted-foreground leading-relaxed">
        {fact.evidence}
      </p>
      {post && (
        <div className="glass-subtle rounded-input p-3 flex items-center gap-3 text-sm">
          <Favicon domain={channelDomain(post.platform)} size={18} />
          <span className="text-foreground/80 line-clamp-1 flex-1">
            {post.caption}
          </span>
          <span className="text-muted-foreground whitespace-nowrap tabular-nums">
            {post.views != null
              ? `${formatCount(post.views)} views`
              : post.likes != null
                ? `${formatCount(post.likes)} likes`
                : ""}
          </span>
        </div>
      )}
      {secondary && (
        <p className="text-sm text-muted-foreground">
          <span className="font-medium">Also: </span>
          {secondary.text}
        </p>
      )}
    </section>
  );
}
