import { NextRequest } from "next/server";
import { saveEvent, updateAdminStatus } from "@/lib/db";
import { json, requireAdmin } from "@/lib/security";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const patch: Record<string, unknown> = {};
  if (body.applicationStatus) patch.application_status = body.applicationStatus;
  if (body.qualificationStatus) patch.qualification_status = body.qualificationStatus;
  if (body.interviewStatus) patch.interview_status = body.interviewStatus;
  if (body.hiringStageStatus) patch.hiring_stage_status = body.hiringStageStatus;
  if (body.reopen === true) {
    patch.reopened_at = new Date().toISOString();
    patch.submitted_at = null;
    patch.qualification_status = null;
    patch.application_status = "started";
  }
  const applicant = await updateAdminStatus(id, patch);
  await saveEvent(id, "admin_status_changed", patch);
  return json({ applicant });
}
