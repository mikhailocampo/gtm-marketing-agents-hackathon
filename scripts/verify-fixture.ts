import { ResearchOutputSchema, PostVariantSchema } from "../lib/types";
import {
  FIXTURE_RESEARCH,
  FIXTURE_POSTS,
} from "../lib/fixtures/balanceyourbp";

const r = ResearchOutputSchema.safeParse(FIXTURE_RESEARCH);
if (!r.success) {
  console.error("RESEARCH FAIL:", JSON.stringify(r.error.issues, null, 2));
  process.exit(1);
}
console.log("ResearchOutput: ok");

for (const [i, post] of FIXTURE_POSTS.entries()) {
  const p = PostVariantSchema.safeParse(post);
  if (!p.success) {
    console.error(`POST[${i}] FAIL:`, JSON.stringify(p.error.issues, null, 2));
    process.exit(1);
  }
}
console.log(`PostVariant: all ${FIXTURE_POSTS.length} ok`);
