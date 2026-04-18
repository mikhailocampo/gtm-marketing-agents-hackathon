import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ sid: string }> },
) {
  const { sid } = await ctx.params;
  if (!sid) {
    return NextResponse.json({ error: "missing_sid" }, { status: 400 });
  }
  const { env } = getCloudflareContext();
  const stub = env.SESSION_DO.get(env.SESSION_DO.idFromName(sid));
  const replay = await stub.getResearchReplay();
  return NextResponse.json(replay);
}
