import { NextRequest } from "next/server";
import { getApplicant, markInterviewScheduled } from "@/lib/db";
import { json } from "@/lib/security";
import { interviewScheduledSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const parsed = interviewScheduledSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid interview payload." }, { status: 400 });
  const applicant = await getApplicant(parsed.data.applicantId);
  if (!applicant || applicant.qualification_status !== "qualified") {
    return json({ error: "Interview scheduling is not available for this application." }, { status: 403 });
  }
  const updated = await markInterviewScheduled(parsed.data.applicantId, parsed.data.details || {});
  return json({ ok: true, applicant: updated });
}
