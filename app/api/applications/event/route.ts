import { NextRequest } from "next/server";
import { saveEvent } from "@/lib/db";
import { json } from "@/lib/security";
import { eventSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const parsed = eventSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid event payload." }, { status: 400 });
  await saveEvent(parsed.data.applicantId || null, parsed.data.eventType, parsed.data.metadata || {}, parsed.data.step);
  return json({ ok: true });
}
