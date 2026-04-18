import { getCloudflareContext } from "@opennextjs/cloudflare";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ sid: string }> },
): Promise<Response> {
  const { sid } = await params;
  if (!sid) return new Response("missing sid", { status: 400 });

  const { env } = getCloudflareContext();
  const id = env.SESSION_DO.idFromName(sid);
  const stub = env.SESSION_DO.get(id);
  return stub.subscribeCalendar(req);
}
