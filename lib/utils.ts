import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ChannelId } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function hashHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h) % 360;
}

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export const DEFAULT_CHANNELS: ChannelId[] = ["tiktok", "instagram", "linkedin"];

const CHANNEL_DOMAINS: Record<ChannelId, string> = {
  tiktok: "tiktok.com",
  instagram: "instagram.com",
  linkedin: "linkedin.com",
  facebook: "facebook.com",
  x: "x.com",
  youtube: "youtube.com",
  threads: "threads.net",
  pinterest: "pinterest.com",
  gbp: "business.google.com",
};

export function channelDomain(id: ChannelId): string {
  return CHANNEL_DOMAINS[id];
}

export const CHANNEL_LABELS: Record<ChannelId, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  x: "X",
  youtube: "YouTube",
  threads: "Threads",
  pinterest: "Pinterest",
  gbp: "Google Business",
};
