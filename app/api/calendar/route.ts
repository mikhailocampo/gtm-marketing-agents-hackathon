import { getCloudflareContext } from "@opennextjs/cloudflare";
import { ChannelIdSchema, SessionIdSchema } from "@/lib/types";
import { z } from "zod";

export const runtime = "nodejs";

const BodySchema = z.object({
  sid: SessionIdSchema,
  selectedChannels: z.array(ChannelIdSchema).min(1),
});

export async function POST(req: Request): Promise<Response> {
  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "invalid_input", issues: parsed.error.issues },
      { status: 400 },
    );
  }
  const { sid, selectedChannels } = parsed.data;

  const { env } = getCloudflareContext();
  const id = env.SESSION_DO.idFromName(sid);
  const stub = env.SESSION_DO.get(id);
  await stub.startCalendar(selectedChannels);

  return Response.json({ ok: true });
}
