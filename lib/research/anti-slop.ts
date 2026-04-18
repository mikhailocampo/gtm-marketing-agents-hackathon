/**
 * Regex validators that enforce DESIGN.md §7.5 anti-slop rules.
 * Used inside finalize_research zod refinements + standalone post-validation.
 */

import type { ResearchFact } from "../types";

const BANNED_PHRASES = [
  "engage your audience",
  "build community",
  "authentic storytelling",
  "unlock the power",
  "delve",
  "crucial",
  "robust",
  "comprehensive",
  "leverage",
  "harness",
  "elevate your",
  "in today's fast-paced",
  "in the world of",
  "navigate the",
];

export function containsBannedPhrase(text: string): string | null {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

export function hasConcreteNumber(text: string): boolean {
  return /\d+(\.\d+)?(K|k|M|m|%|x|×)?/.test(text);
}

export function hasNamedEntity(
  text: string,
  brandContext: string[],
): boolean {
  if (/@[A-Za-z0-9._-]{2,}/.test(text)) return true;
  if (/#[A-Za-z0-9_]{2,}/.test(text)) return true;
  if (/https?:\/\//.test(text)) return true;
  for (const ctx of brandContext) {
    if (ctx && text.toLowerCase().includes(ctx.toLowerCase())) return true;
  }
  return false;
}

export type ValidationResult =
  | { ok: true }
  | { ok: false; reason: string };

export function validateResearchFact(
  fact: ResearchFact,
  brandContext: string[],
): ValidationResult {
  if (!fact.evidence?.trim()) {
    return { ok: false, reason: "evidence is empty" };
  }
  const banned = containsBannedPhrase(fact.text);
  if (banned) return { ok: false, reason: `banned phrase: "${banned}"` };

  // Soft requirement: at least one of concrete number OR named entity in text.
  if (!hasConcreteNumber(fact.text) && !hasNamedEntity(fact.text, brandContext)) {
    return {
      ok: false,
      reason: "fact must contain a concrete number or named entity",
    };
  }
  return { ok: true };
}
