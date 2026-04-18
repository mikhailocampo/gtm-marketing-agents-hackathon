/**
 * Thin typed wrappers around 4 Apify actors.
 * Bodies here are stubs that return fixture data when the token is missing or
 * DEMO_FALLBACK is set. Lane A wires them to live actors.
 */

import { toolError, type ToolError } from "./errors";
import * as fx from "./fixtures/balanceyourbp";

const TIMEOUT_MS = 30_000;

export type TikTokPost = {
  url: string;
  caption: string;
  views?: number;
  likes?: number;
  comments?: number;
  postedAt?: string;
};

export type IGPost = {
  url: string;
  caption: string;
  likes?: number;
  comments?: number;
  postedAt?: string;
};

function isFallback(token: string | undefined, demoFallback?: string): boolean {
  return !token || demoFallback === "1";
}

export async function scrapeWebsite(
  token: string | undefined,
  url: string,
  opts: { demoFallback?: string } = {},
): Promise<{ markdown: string; title: string } | ToolError> {
  if (isFallback(token, opts.demoFallback)) {
    return {
      markdown: fx.fixtureMarkdown,
      title: fx.FIXTURE_RESEARCH.brand.name,
    };
  }
  return toolError({
    code: "apify_not_configured",
    message: `scrapeWebsite stub — wire live actor in Lane A. url=${url}`,
    recoverable: true,
    retry_safe: true,
  });
}

export async function scrapeTikTokProfile(
  token: string | undefined,
  username: string,
  opts: { demoFallback?: string } = {},
): Promise<TikTokPost[] | ToolError> {
  if (isFallback(token, opts.demoFallback)) {
    return fx.FIXTURE_RESEARCH.ownPosts
      .filter((p) => p.platform === "tiktok")
      .map((p) => ({
        url: p.url,
        caption: p.caption,
        views: p.views,
        likes: p.likes,
        comments: p.comments,
        postedAt: p.postedAt,
      }));
  }
  return toolError({
    code: "apify_not_configured",
    message: `scrapeTikTokProfile stub — wire live actor in Lane A. username=${username}`,
    recoverable: true,
    retry_safe: true,
  });
}

export async function scrapeInstagramProfile(
  token: string | undefined,
  username: string,
  opts: { demoFallback?: string } = {},
): Promise<IGPost[] | ToolError> {
  if (isFallback(token, opts.demoFallback)) {
    return fx.FIXTURE_RESEARCH.ownPosts
      .filter((p) => p.platform === "instagram")
      .map((p) => ({
        url: p.url,
        caption: p.caption,
        likes: p.likes,
        comments: p.comments,
        postedAt: p.postedAt,
      }));
  }
  return toolError({
    code: "apify_not_configured",
    message: `scrapeInstagramProfile stub — wire live actor in Lane A. username=${username}`,
    recoverable: true,
    retry_safe: true,
  });
}

export async function scrapeTikTokHashtag(
  token: string | undefined,
  hashtag: string,
  opts: { demoFallback?: string } = {},
): Promise<TikTokPost[] | ToolError> {
  if (isFallback(token, opts.demoFallback)) {
    return fx.FIXTURE_RESEARCH.competitors.map((c, i) => ({
      url: c.topPostUrl ?? `https://tiktok.com/@${c.handle}/video/${i}`,
      caption: c.topHook ?? "",
      views: (c.followers ?? 5000) * 3,
    }));
  }
  return toolError({
    code: "apify_not_configured",
    message: `scrapeTikTokHashtag stub — wire live actor in Lane A. hashtag=${hashtag}`,
    recoverable: true,
    retry_safe: true,
  });
}

export const APIFY_TIMEOUT_MS = TIMEOUT_MS;
