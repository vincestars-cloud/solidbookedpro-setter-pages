import { NextRequest } from "next/server";
import { saveEvent, saveMediaEngagement, saveScenarioResponses, updateApplicantFields, upsertMockCall } from "@/lib/db";
import { json } from "@/lib/security";
import { autosaveSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const parsed = autosaveSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid autosave payload.", issues: parsed.error.flatten() }, { status: 400 });
  const payload = parsed.data;
  await updateApplicantFields(payload.applicantId, payload.fields, payload.currentStep, payload.highestStep);
  const mediaItems = [
    ...(payload.founderVideo ? [payload.founderVideo] : []),
    ...(payload.callLibrary || [])
  ];
  await saveMediaEngagement(payload.applicantId, mediaItems);
  await saveScenarioResponses(payload.applicantId, payload.scenarios || []);
  for (const call of payload.mockCalls || []) await upsertMockCall(payload.applicantId, call);
  await saveEvent(payload.applicantId, "autosave", { currentStep: payload.currentStep, highestStep: payload.highestStep }, payload.currentStep);
  return json({ ok: true, applicantId: payload.applicantId, savedAt: new Date().toISOString() });
}
