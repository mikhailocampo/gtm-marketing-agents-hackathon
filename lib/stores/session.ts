"use client";

import { create } from "zustand";
import type { ChannelId, PostVariant, SpotlightPayload } from "@/lib/types";

export type SpotlightRefClient = {
  date: string;
  channel: ChannelId;
  payload: SpotlightPayload;
};

function slotKey(date: string, channel: ChannelId): string {
  return `${date}:${channel}`;
}

type SessionStore = {
  selectedDay?: string;
  viewingMonth: { year: number; month: number }; // month is 0-indexed
  shimmerSlots: Set<string>;
  postsMap: Map<string, PostVariant>;
  spotlightRef?: SpotlightRefClient;
  spotlightToastOpen: boolean;

  // actions
  addShimmer: (date: string, channel: ChannelId) => void;
  addPost: (post: PostVariant) => void;
  setSpotlight: (ref: SpotlightRefClient) => void;
  openDay: (date: string | undefined) => void;
  setToastOpen: (open: boolean) => void;
  nextMonth: () => void;
  prevMonth: () => void;
  reset: () => void;
};

function initialMonth() {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

export const useSessionStore = create<SessionStore>((set) => ({
  selectedDay: undefined,
  viewingMonth: initialMonth(),
  shimmerSlots: new Set(),
  postsMap: new Map(),
  spotlightRef: undefined,
  spotlightToastOpen: false,

  addShimmer: (date, channel) =>
    set((state) => {
      const next = new Set(state.shimmerSlots);
      next.add(slotKey(date, channel));
      return { shimmerSlots: next };
    }),

  addPost: (post) =>
    set((state) => {
      const key = slotKey(post.date, post.channel);
      const nextShim = new Set(state.shimmerSlots);
      nextShim.delete(key);
      const nextPosts = new Map(state.postsMap);
      nextPosts.set(key, post);
      return { shimmerSlots: nextShim, postsMap: nextPosts };
    }),

  setSpotlight: (ref) =>
    set({ spotlightRef: ref, spotlightToastOpen: true }),

  openDay: (date) => set({ selectedDay: date }),

  setToastOpen: (open) => set({ spotlightToastOpen: open }),

  nextMonth: () =>
    set((state) => {
      const m = state.viewingMonth.month + 1;
      return m > 11
        ? { viewingMonth: { year: state.viewingMonth.year + 1, month: 0 } }
        : { viewingMonth: { ...state.viewingMonth, month: m } };
    }),

  prevMonth: () =>
    set((state) => {
      const m = state.viewingMonth.month - 1;
      return m < 0
        ? { viewingMonth: { year: state.viewingMonth.year - 1, month: 11 } }
        : { viewingMonth: { ...state.viewingMonth, month: m } };
    }),

  reset: () =>
    set({
      selectedDay: undefined,
      viewingMonth: initialMonth(),
      shimmerSlots: new Set(),
      postsMap: new Map(),
      spotlightRef: undefined,
      spotlightToastOpen: false,
    }),
}));

export { slotKey };
