import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";

export async function POST(req: Request) {
  // Client's customFetch transport injects { sid, messages } into the body.
  const cloned = req.clone();
  let sid: string | undefined;
  try {
    const body = (await cloned.json()) as { sid?: string };
    sid = body.sid;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!sid) {
    return NextResponse.json({ error: "missing_sid" }, { status: 400 });
  }

  const { env } = getCloudflareContext();
  const stub = env.SESSION_DO.get(env.SESSION_DO.idFromName(sid));
  // Forward the original request so the DO sees the same body.
  return stub.handleChat(req);
}
