/**
 * Thin typed wrappers around 5 Apify actors. Inputs and output shapes verified
 * via live probes against balanceyourbp.com / @greg_hoyd / @balanceyourbp_ /
 * #unicity. See conversation log on 2026-04-18 for probe details.
 *
 * Convention: every wrapper returns a typed DTO or a structured ToolError.
 * Never throws. 30s wall-clock cap via Promise.race.
 */

import { ApifyClient } from "apify-client";
import { toolError, type ToolError } from "./errors";

const TIMEOUT_MS = 30_000;

// ─────────────────────────────── DTOs ───────────────────────────────

export type WebsitePage = {
  url: string;
  title?: string;
  description?: string;
  markdown: string;
};

export type ScreenshotResult = {
  screenshotUrl: string;
};

export type TikTokPost = {
  url: string;
  caption: string;
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  postedAt?: string;
  durationSec?: number;
  hashtags?: string[];
  authorHandle?: string;
  authorFollowers?: number;
};

export type IGPost = {
  url: string;
  caption: string;
  likes?: number;
  comments?: number;
  views?: number;
  postedAt?: string;
  videoUrl?: string;
  audioUrl?: string;
  durationSec?: number;
  hashtags?: string[];
  ownerUsername?: string;
};

export const APIFY_TIMEOUT_MS = TIMEOUT_MS;

// ─────────────────────────── Internals ─────────────────────────────

function pickToken(env: { APIFY_TOKEN?: string; APIFY_API_KEY?: string }) {
  return env.APIFY_TOKEN ?? env.APIFY_API_KEY;
}

function withTimeout<T>(p: Promise<T>, label: string): Promise<T | ToolError> {
  return Promise.race<T | ToolError>([
    p,
    new Promise<ToolError>((resolve) =>
      setTimeout(
        () =>
          resolve(
            toolError({
              code: "apify_timeout",
              message: `${label} exceeded ${TIMEOUT_MS}ms`,
              recoverable: true,
              retry_safe: true,
            }),
          ),
        TIMEOUT_MS,
      ),
    ),
  ]);
}

async function callActor<TInput extends Record<string, unknown>, TItem>(
  token: string | undefined,
  actorId: string,
  input: TInput,
  label: string,
): Promise<TItem[] | ToolError> {
  if (!token) {
    return toolError({
      code: "apify_not_configured",
      message: `APIFY token missing for ${label}`,
      recoverable: false,
      retry_safe: false,
    });
  }
  const client = new ApifyClient({ token });
  try {
    const run = await withTimeout(
      client.actor(actorId).call(input as Record<string, unknown>),
      label,
    );
    if ("error" in (run as object) && (run as ToolError).error === true) {
      return run as ToolError;
    }
    const dataset = (run as { defaultDatasetId: string }).defaultDatasetId;
    const { items } = await client.dataset(dataset).listItems();
    return items as TItem[];
  } catch (err) {
    return toolError({
      code: "apify_empty_result",
      message: `${label} failed: ${(err as Error).message}`,
      recoverable: true,
      retry_safe: true,
      context: { actorId },
    });
  }
}

function stripHandle(s: string) {
  return s.replace(/^@/, "").trim();
}

// ─────────────────────────── Wrappers ──────────────────────────────

type RawWebsiteItem = {
  url: string;
  markdown?: string;
  text?: string;
  metadata?: { title?: string; description?: string };
};

export async function scrapeWebsite(
  env: { APIFY_TOKEN?: string; APIFY_API_KEY?: string },
  url: string,
): Promise<WebsitePage[] | ToolError> {
  const items = await callActor<Record<string, unknown>, RawWebsiteItem>(
    pickToken(env),
    "apify/website-content-crawler",
    {
      startUrls: [{ url }],
      maxCrawlPages: 4,
      saveMarkdown: true,
      crawlerType: "playwright:adaptive",
      proxyConfiguration: { useApifyProxy: true },
    },
    `scrapeWebsite(${url})`,
  );
  if ("error" in (items as object) && (items as ToolError).error === true)
    return items as ToolError;
  const arr = items as RawWebsiteItem[];
  if (arr.length === 0) {
    return toolError({
      code: "apify_empty_result",
      message: `scrapeWebsite returned 0 pages for ${url}`,
      recoverable: false,
      retry_safe: false,
    });
  }
  return arr.map((i) => ({
    url: i.url,
    title: i.metadata?.title,
    description: i.metadata?.description,
    markdown: i.markdown ?? i.text ?? "",
  }));
}

type RawScreenshotItem = {
  url: string;
  screenshotUrl?: string;
};

export async function screenshotWebsite(
  env: { APIFY_TOKEN?: string; APIFY_API_KEY?: string },
  url: string,
): Promise<ScreenshotResult | ToolError> {
  const items = await callActor<Record<string, unknown>, RawScreenshotItem>(
    pickToken(env),
    "apify/screenshot-url",
    {
      urls: [{ url }],
      format: "png",
      waitUntil: "networkidle2",
      delay: 1500,
      viewportWidth: 1440,
      scrollToBottom: false,
    },
    `screenshotWebsite(${url})`,
  );
  if ("error" in (items as object) && (items as ToolError).error === true)
    return items as ToolError;
  const first = (items as RawScreenshotItem[])[0];
  if (!first?.screenshotUrl) {
    return toolError({
      code: "apify_empty_result",
      message: `screenshot returned no URL for ${url}`,
      recoverable: false,
      retry_safe: false,
    });
  }
  return { screenshotUrl: first.screenshotUrl };
}

type RawTTItem = {
  text?: string;
  webVideoUrl?: string;
  playCount?: number;
  diggCount?: number;
  commentCount?: number;
  shareCount?: number;
  createTimeISO?: string;
  hashtags?: Array<{ name: string }> | string[];
  authorMeta?: { name?: string; fans?: number };
  ["videoMeta.duration"]?: number;
  videoMeta?: { duration?: number };
  note?: string;
};

function mapTikTok(items: RawTTItem[]): TikTokPost[] {
  return items
    .filter((i) => !!i.webVideoUrl) // drop profile-metadata-only rows
    .map((i) => ({
      url: i.webVideoUrl!,
      caption: i.text ?? "",
      views: i.playCount,
      likes: i.diggCount,
      comments: i.commentCount,
      shares: i.shareCount,
      postedAt: i.createTimeISO,
      durationSec: i.videoMeta?.duration ?? i["videoMeta.duration"],
      hashtags: Array.isArray(i.hashtags)
        ? i.hashtags
            .map((h) => (typeof h === "string" ? h : h?.name))
            .filter((h): h is string => !!h)
        : undefined,
      authorHandle: i.authorMeta?.name,
      authorFollowers: i.authorMeta?.fans,
    }));
}

export async function scrapeTikTokProfile(
  env: { APIFY_TOKEN?: string; APIFY_API_KEY?: string },
  username: string,
): Promise<TikTokPost[] | ToolError> {
  const items = await callActor<Record<string, unknown>, RawTTItem>(
    pickToken(env),
    "clockworks/tiktok-scraper",
    {
      profiles: [stripHandle(username)],
      resultsPerPage: 15,
      profileScrapeSections: ["videos"],
      profileSorting: "latest",
      excludePinnedPosts: false,
    },
    `scrapeTikTokProfile(@${username})`,
  );
  if ("error" in (items as object) && (items as ToolError).error === true)
    return items as ToolError;
  return mapTikTok(items as RawTTItem[]);
}

export async function scrapeTikTokHashtag(
  env: { APIFY_TOKEN?: string; APIFY_API_KEY?: string },
  hashtag: string,
): Promise<TikTokPost[] | ToolError> {
  const items = await callActor<Record<string, unknown>, RawTTItem>(
    pickToken(env),
    "clockworks/tiktok-hashtag-scraper",
    {
      hashtags: [hashtag.replace(/^#/, "")],
      resultsPerPage: 15,
    },
    `scrapeTikTokHashtag(#${hashtag})`,
  );
  if ("error" in (items as object) && (items as ToolError).error === true)
    return items as ToolError;
  return mapTikTok(items as RawTTItem[]);
}

type RawIGItem = {
  url: string;
  caption?: string;
  likesCount?: number;
  commentsCount?: number;
  videoViewCount?: number;
  videoPlayCount?: number;
  timestamp?: string;
  videoUrl?: string;
  audioUrl?: string;
  videoDuration?: number;
  hashtags?: string[];
  ownerUsername?: string;
};

export async function scrapeInstagramProfile(
  env: { APIFY_TOKEN?: string; APIFY_API_KEY?: string },
  username: string,
): Promise<IGPost[] | ToolError> {
  const handle = stripHandle(username);
  const items = await callActor<Record<string, unknown>, RawIGItem>(
    pickToken(env),
    "apify/instagram-scraper",
    {
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: "posts",
      resultsLimit: 10,
      addParentData: false,
    },
    `scrapeInstagramProfile(@${username})`,
  );
  if ("error" in (items as object) && (items as ToolError).error === true)
    return items as ToolError;
  return (items as RawIGItem[]).map((i) => ({
    url: i.url,
    caption: i.caption ?? "",
    likes: i.likesCount,
    comments: i.commentsCount,
    views: i.videoPlayCount ?? i.videoViewCount,
    postedAt: i.timestamp,
    videoUrl: i.videoUrl,
    audioUrl: i.audioUrl,
    durationSec: i.videoDuration,
    hashtags: i.hashtags,
    ownerUsername: i.ownerUsername,
  }));
}
