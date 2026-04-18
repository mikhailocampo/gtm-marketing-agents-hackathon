import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { SocialSchema } from "@/lib/types";

export const runtime = "nodejs";

const InputSchema = z.object({
  websiteUrl: z.string().url(),
  socials: z.array(SocialSchema).default([]),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const parsed = InputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const sid = nanoid(12);
  const { env } = getCloudflareContext();
  const stub = env.SESSION_DO.get(env.SESSION_DO.idFromName(sid));
  await stub.createSession(sid, parsed.data);

  console.log(`[research:${sid.slice(0, 6)}] session created ${parsed.data.websiteUrl}`);
  return NextResponse.json({ sid }, { status: 201 });
}
