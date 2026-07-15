import { privateConfig } from "./config";
import type { ApplicantRecord, ApplicationFields, QualificationStatus } from "./types";
import { normalizeEmail } from "./validators";

type DbFilter = Record<string, string | number | boolean | null | undefined>;
type LogicalTable =
  | "applicants"
  | "application_events"
  | "media_engagement"
  | "mock_calls"
  | "scenario_responses"
  | "admin_notes";

const table = (name: LogicalTable) => `${privateConfig.supabaseTablePrefix}${name}`;

const headers = () => {
  if (!privateConfig.supabaseUrl || !privateConfig.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for database operations.");
  }
  return {
    apikey: privateConfig.supabaseServiceRoleKey,
    Authorization: `Bearer ${privateConfig.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation"
  };
};

function restUrl(table: string, filters?: DbFilter, select = "*", onConflict?: string) {
  const url = new URL(`${privateConfig.supabaseUrl.replace(/\/$/, "")}/rest/v1/${table}`);
  url.searchParams.set("select", select);
  if (onConflict) url.searchParams.set("on_conflict", onConflict);
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined) url.searchParams.set(key, value === null ? "is.null" : `eq.${value}`);
    });
  }
  return url.toString();
}

async function request<T>(tableName: LogicalTable, init: RequestInit & { filters?: DbFilter; select?: string; onConflict?: string } = {}) {
  const response = await fetch(restUrl(table(tableName), init.filters, init.select, init.onConflict), {
    ...init,
    headers: {
      ...headers(),
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Database request failed (${response.status}): ${body}`);
  }
  if (response.status === 204) return null as T;
  return (await response.json()) as T;
}

export async function findApplicantByEmail(email: string) {
  const rows = await request<ApplicantRecord[]>("applicants", {
    filters: { normalized_email: normalizeEmail(email) },
    select: "*"
  });
  return rows[0] || null;
}

export async function getApplicant(id: string) {
  const rows = await request<ApplicantRecord[]>("applicants", { filters: { id }, select: "*" });
  return rows[0] || null;
}

export async function createApplicant(email: string, ipAddress?: string) {
  const normalizedEmail = normalizeEmail(email);
  const existing = await findApplicantByEmail(normalizedEmail);
  if (existing && !existing.reopened_at) return { applicant: existing, duplicate: true };
  const rows = await request<ApplicantRecord[]>("applicants", {
    method: "POST",
    body: JSON.stringify({
      normalized_email: normalizedEmail,
      application_status: "started",
      current_step: 1,
      interview_status: "not_displayed",
      metadata: { created_ip: ipAddress || null }
    })
  });
  return { applicant: rows[0], duplicate: false };
}

export async function updateApplicantFields(id: string, fields: Partial<ApplicationFields>, currentStep?: number, highestStep?: number) {
  const patch: Record<string, unknown> = {};
  if (fields.fullName !== undefined) patch.full_name = fields.fullName;
  if (fields.preferredName !== undefined) patch.preferred_name = fields.preferredName;
  if (fields.email !== undefined) patch.normalized_email = normalizeEmail(fields.email);
  if (fields.country !== undefined) patch.country = fields.country;
  if (fields.desiredHourly !== undefined) patch.desired_hourly_pay = fields.desiredHourly;
  if (fields.earliestStartDate !== undefined) patch.earliest_start_date = fields.earliestStartDate;
  if (fields.availableStart !== undefined || fields.availableEnd !== undefined) {
    patch.availability_est = {
      start: fields.availableStart,
      end: fields.availableEnd
    };
  }
  if (fields.vocarooUrl !== undefined) patch.vocaroo_url = fields.vocarooUrl;
  if (fields.crmPlatforms !== undefined) patch.crm_platforms = fields.crmPlatforms;
  if (fields.appointmentSettingExperience !== undefined) patch.appointment_setting_experience = fields.appointmentSettingExperience;
  if (fields.industries !== undefined) patch.industries = fields.industries;
  if (fields.pastMetrics !== undefined) patch.past_metrics = fields.pastMetrics;
  if (fields.resumeFileName !== undefined) patch.resume_file_name = fields.resumeFileName;
  if (fields.resumeFileSize !== undefined) patch.resume_file_size = fields.resumeFileSize;
  if (fields.resumeFileType !== undefined) patch.resume_file_type = fields.resumeFileType;
  if (currentStep !== undefined) patch.current_step = currentStep;
  if (highestStep !== undefined) patch.application_status = statusFromStep(highestStep);
  patch.updated_at = new Date().toISOString();

  const rows = await request<ApplicantRecord[]>("applicants", {
    method: "PATCH",
    filters: { id },
    body: JSON.stringify(patch)
  });
  return rows[0] || null;
}

export async function saveEvent(applicantId: string | null, eventType: string, metadata: Record<string, unknown> = {}, step?: number) {
  await request("application_events", {
    method: "POST",
    body: JSON.stringify({
      applicant_id: applicantId,
      event_type: eventType,
      step,
      metadata,
      occurred_at: new Date().toISOString()
    })
  });
}

export async function saveMediaEngagement(applicantId: string, items: Array<Record<string, unknown>>) {
  if (!items.length) return;
  await request("media_engagement", {
    method: "POST",
    onConflict: "applicant_id,media_type,media_key",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(
      items.map((item) => ({
        applicant_id: applicantId,
        media_type: item.mediaType,
        media_key: item.mediaKey,
        started: item.started,
        seconds_consumed: item.secondsConsumed,
        percentage_consumed: item.percentageConsumed,
        completed: item.completed,
        replay_count: item.replayCount,
        pause_count: item.pauseCount || 0,
        updated_at: new Date().toISOString()
      }))
    )
  });
}

export async function saveScenarioResponses(applicantId: string, responses: Array<{ questionKey: string; response: string }>) {
  if (!responses.length) return;
  await request("scenario_responses", {
    method: "POST",
    onConflict: "applicant_id,question_key",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(
      responses.map((response) => ({
        applicant_id: applicantId,
        question_key: response.questionKey,
        response: response.response,
        updated_at: new Date().toISOString()
      }))
    )
  });
}

export async function upsertMockCall(applicantId: string, call: Record<string, unknown>) {
  await request("mock_calls", {
    method: "POST",
    onConflict: "applicant_id,mock_call_number",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({
      applicant_id: applicantId,
      mock_call_number: call.mockCallNumber,
      vapi_call_id: call.vapiCallId || null,
      status: call.status,
      started_at: call.startedAt || null,
      ended_at: call.endedAt || null,
      duration_seconds: call.durationSeconds || null,
      ended_reason: call.endedReason || null,
      updated_at: new Date().toISOString()
    })
  });
}

export async function updateMockCallByVapiId(vapiCallId: string, patch: Record<string, unknown>) {
  const rows = await request<Array<{ id: string; applicant_id: string }>>("mock_calls", {
    method: "PATCH",
    filters: { vapi_call_id: vapiCallId },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  return rows[0] || null;
}

export async function listMockCalls(applicantId: string) {
  return request<Array<Record<string, unknown>>>("mock_calls", {
    filters: { applicant_id: applicantId },
    select: "*"
  });
}

export async function completeSubmission(
  applicantId: string,
  qualificationStatus: QualificationStatus,
  internalScore: number,
  hardFlags: string[],
  totalCompletionSeconds: number | null
) {
  const rows = await request<ApplicantRecord[]>("applicants", {
    method: "PATCH",
    filters: { id: applicantId },
    body: JSON.stringify({
      application_status: "application_completed",
      qualification_status: qualificationStatus,
      interview_status: qualificationStatus === "qualified" ? "displayed" : "not_displayed",
      internal_score: internalScore,
      hard_flags: hardFlags,
      submitted_at: new Date().toISOString(),
      total_completion_seconds: totalCompletionSeconds,
      current_step: 5,
      updated_at: new Date().toISOString()
    })
  });
  return rows[0] || null;
}

export async function markInterviewScheduled(applicantId: string, details: Record<string, unknown>) {
  const rows = await request<ApplicantRecord[]>("applicants", {
    method: "PATCH",
    filters: { id: applicantId },
    body: JSON.stringify({
      application_status: "interview_scheduled",
      interview_status: "scheduled",
      interview_scheduled_at: new Date().toISOString(),
      interview_details: details,
      updated_at: new Date().toISOString()
    })
  });
  await saveEvent(applicantId, "interview_booked", details);
  return rows[0] || null;
}

export async function listApplicants() {
  return request<ApplicantRecord[]>("applicants", {
    select: "*",
    headers: { Prefer: "count=exact" }
  });
}

export async function getApplicantBundle(id: string) {
  const [applicant, events, media, mockCalls, scenarios, notes] = await Promise.all([
    getApplicant(id),
    request<Record<string, unknown>[]>("application_events", { filters: { applicant_id: id }, select: "*" }),
    request<Record<string, unknown>[]>("media_engagement", { filters: { applicant_id: id }, select: "*" }),
    request<Record<string, unknown>[]>("mock_calls", { filters: { applicant_id: id }, select: "*" }),
    request<Record<string, unknown>[]>("scenario_responses", { filters: { applicant_id: id }, select: "*" }),
    request<Record<string, unknown>[]>("admin_notes", { filters: { applicant_id: id }, select: "*" })
  ]);
  return { applicant, events, media, mockCalls, scenarios, notes };
}

export async function updateAdminStatus(id: string, patch: Record<string, unknown>) {
  const rows = await request<ApplicantRecord[]>("applicants", {
    method: "PATCH",
    filters: { id },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() })
  });
  return rows[0] || null;
}

export async function addAdminNote(applicantId: string, adminUserId: string, note: string) {
  await request("admin_notes", {
    method: "POST",
    body: JSON.stringify({ applicant_id: applicantId, admin_user_id: adminUserId, note })
  });
}

function statusFromStep(step: number) {
  if (step >= 4) return "mock_calls_in_progress";
  if (step === 3) return "step_3_complete";
  if (step === 2) return "step_2_complete";
  if (step === 1) return "step_1_complete";
  return "started";
}
