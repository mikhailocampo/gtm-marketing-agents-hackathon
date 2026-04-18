"use client";
import * as React from "react";
import type { ChannelId, PostVariant, SpotlightRef } from "@/lib/types";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Favicon } from "@/components/ui/Favicon";
import { channelDomain, hashHue } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDay } from "./date-utils";
import { SpotlightPanel } from "./SpotlightPanel";

type Props = {
  open: boolean;
  date?: string;
  posts: PostVariant[];
  spotlight?: SpotlightRef;
  initialChannel?: ChannelId;
  onClose: () => void;
};

export function DayModal({
  open,
  date,
  posts,
  spotlight,
  initialChannel,
  onClose,
}: Props) {
  const defaultChannel = initialChannel ?? posts[0]?.channel;
  const [activeChannel, setActiveChannel] = React.useState<ChannelId | undefined>(
    defaultChannel,
  );
  const [toast, setToast] = React.useState<string | undefined>();
  const toastTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (open) setActiveChannel(defaultChannel);
  }, [open, defaultChannel]);

  React.useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );

  if (!open || !date) return null;

  const active = posts.find((p) => p.channel === activeChannel) ?? posts[0];
  if (!active) return null;

  const isSpotlight =
    spotlight &&
    spotlight.date === date &&
    spotlight.channel === active.channel &&
    !!spotlight.payload;

  const handlePublish = () => {
    setToast(`Mocked: would post to ${active.channel}`);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(undefined), 2200);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        onClose={onClose}
        className="max-w-[1000px] w-[92vw] p-0 overflow-hidden"
      >
        <div className="flex items-center gap-4 border-b border-border/30 px-6 py-4">
          <h2 className="text-lg font-semibold">{formatDay(date)}</h2>
          <div className="ml-auto flex gap-1">
            {posts.map((p) => {
              const isActive = p.channel === active.channel;
              const isSpot =
                spotlight?.date === date && spotlight?.channel === p.channel;
              return (
                <button
                  key={p.channel}
                  type="button"
                  onClick={() => setActiveChannel(p.channel)}
                  className={[
                    "p-2 rounded-input transition",
                    isActive ? "glass-regular" : "hover:bg-foreground/5",
                    isSpot ? "ring-2 ring-[hsl(var(--accent-spotlight))]" : "",
                  ].join(" ")}
                  aria-label={p.channel}
                >
                  <Favicon domain={channelDomain(p.channel)} size={16} />
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={bodyRef}
          className="relative grid grid-cols-1 md:grid-cols-[1fr_minmax(280px,_360px)] gap-6 p-6 max-h-[70vh] overflow-auto"
        >
          <article className="flex flex-col gap-3">
            {active.mediaUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={active.mediaUrl}
                alt=""
                className="w-full rounded-card object-cover max-h-[360px]"
              />
            ) : (
              <div
                className="w-full aspect-[4/3] rounded-card flex items-center justify-center p-6 text-center"
                style={{
                  background: `hsl(${hashHue(`${date}:${active.channel}`)} 40% 80%)`,
                }}
              >
                <span className="font-serif text-2xl text-foreground/80 leading-tight">
                  {active.hook}
                </span>
              </div>
            )}
            <h3 className="font-semibold text-lg leading-snug">{active.hook}</h3>
            <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
              {active.body}
            </p>
            {active.cta && (
              <p className="text-sm font-medium text-foreground">{active.cta}</p>
            )}
            <div className="pt-2">
              <Button onClick={handlePublish} variant="default">
                Publish on {active.channel}
              </Button>
            </div>
          </article>

          {isSpotlight && spotlight?.payload && (
            <SpotlightPanel
              payload={spotlight.payload}
              containerRef={bodyRef}
            />
          )}
        </div>

        {toast && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 glass-heavy rounded-chip px-4 py-2 text-sm">
            {toast}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
