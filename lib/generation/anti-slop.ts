// Duplicated intentionally: Lane A owns lib/research/anti-slop.ts and
// cross-lane imports are banned (PLAN.md §2.2). Merge can dedupe.
const BAN_LIST = [
  "delve",
  "crucial",
  "robust",
  "comprehensive",
  "engage your audience",
  "authentic storytelling",
  "build community",
  "unlock the power of",
  "elevate your brand",
  "in today's fast-paced",
  "leverage",
  "synergy",
  "game-changer",
  "game changing",
  "revolutionize",
  "seamless",
  "empower",
  "unleash",
];

const BAN_RE = new RegExp(
  `\\b(${BAN_LIST.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(
    "|",
  )})\\b`,
  "i",
);

export type SlopHit = { phrase: string; where: "hook" | "body" };

export function checkSlop(copy: {
  hook: string;
  body: string;
}): SlopHit | null {
  const h = copy.hook.match(BAN_RE);
  if (h) return { phrase: h[1].toLowerCase(), where: "hook" };
  const b = copy.body.match(BAN_RE);
  if (b) return { phrase: b[1].toLowerCase(), where: "body" };
  return null;
}
