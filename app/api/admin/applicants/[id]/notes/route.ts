import { NextRequest } from "next/server";
import { addAdminNote, saveEvent } from "@/lib/db";
import { json, requireAdmin } from "@/lib/security";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  if (!body.note || typeof body.note !== "string") return json({ error: "Note is required." }, { status: 400 });
  await addAdminNote(id, "admin", body.note);
  await saveEvent(id, "admin_note_added", {});
  return json({ ok: true });
}
