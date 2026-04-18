import type { SpotlightPayload } from "../types";

export function validateSpotlight(
  payload: SpotlightPayload,
): { ok: true } | { ok: false; missing: string[] } {
  const chipIds = new Set(payload.evidenceChips.map((c) => c.id));
  const missing = payload.rationale.highlights
    .map((h) => h.chipId)
    .filter((id) => !chipIds.has(id));
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true };
}
