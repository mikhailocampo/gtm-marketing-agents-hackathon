import type { ChannelId, PostVariant } from "./types";

export type CalendarEvent =
  | { type: "shimmer"; date: string; channel: ChannelId; ts: number }
  | { type: "post"; post: PostVariant; ts: number }
  | {
      type: "calendar_done";
      spotlightRef: { date: string; channel: ChannelId };
      ts: number;
    }
  | { type: "error"; message: string; ts: number };

export function encodeSse(event: CalendarEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export const SSE_HEARTBEAT = ":\n\n";
