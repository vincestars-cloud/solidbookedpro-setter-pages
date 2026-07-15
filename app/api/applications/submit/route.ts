import { NextRequest } from "next/server";
import {
  completeSubmission,
  findApplicantByEmail,
  listMockCalls,
  saveEvent,
  saveMediaEngagement,
  saveScenarioResponses,
  updateApplicantFields,
  upsertMockCall
} from "@/lib/db";
import { publicConfig } from "@/lib/config";
import { evaluateQualification } from "@/lib/qualification";
import { json } from "@/lib/security";
import { submitSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const parsed = submitSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid submission.", issues: parsed.error.flatten() }, { status: 400 });
  const payload = parsed.data;
  const duplicate = await findApplicantByEmail(payload.fields.email);
  const duplicateSubmission = Boolean(duplicate && duplicate.id !== payload.applicantId && !duplicate.reopened_at);
  if (duplicateSubmission) {
    return json(
      {
        status: "manual_review",
        message:
          "An application has already been started or submitted using this email address. Please use the same device to continue, or contact us if you need assistance."
      },
      { status: 409 }
    );
  }

  await updateApplicantFields(payload.applicantId, payload.fields, 5, 5);
  await saveMediaEngagement(payload.applicantId, [
    ...(payload.founderVideo ? [payload.founderVideo] : []),
    ...(payload.callLibrary || [])
  ]);
  await saveScenarioResponses(payload.applicantId, payload.scenarios);
  for (const call of payload.mockCalls || []) await upsertMockCall(payload.applicantId, call);

  const mockCalls = await listMockCalls(payload.applicantId);
  const completed = mockCalls.filter((call) => call.status === "completed").length;
  const microphoneGranted = Boolean(payload.mockCalls?.some((call) => call.status === "completed" || call.status === "live"));
  const scoredCalls = mockCalls
    .map((call) => Number(call.backend_score || call.backendScore || 0))
    .filter((score) => Number.isFinite(score) && score > 0);
  const mockAverageScore = scoredCalls.length ? scoredCalls.reduce((sum, item) => sum + item, 0) / scoredCalls.length : 0;
  const qualification = evaluateQualification({
    fields: payload.fields,
    mockCallsCompleted: completed,
    microphoneGranted,
    duplicateSubmission,
    callLibrary: payload.callLibrary,
    mockAverageScore,
    mockScoredCalls: scoredCalls.length
  });
  const applicant = await completeSubmission(
    payload.applicantId,
    qualification.status,
    qualification.internalScore,
    qualification.hardFlags,
    null
  );
  await saveEvent(payload.applicantId, "qualification_result", {
    status: qualification.status,
    internalScore: qualification.internalScore,
    hardFlags: qualification.hardFlags,
    scoreBreakdown: qualification.scoreBreakdown
  });

  return json({
    applicantId: payload.applicantId,
    status: qualification.status,
    applicationStatus: applicant?.application_status,
    calendar:
      qualification.status === "qualified"
        ? {
            provider: publicConfig.calendar.provider,
            embedUrl: publicConfig.calendar.embedUrl,
            externalUrl: publicConfig.calendar.externalUrl
          }
        : null,
    message:
      qualification.status === "qualified"
        ? "Congratulations — based on your application, you seem to be a strong potential fit for the role."
        : "Thank you for completing your application. We will review your submission and contact you if we decide to move forward."
  });
}
