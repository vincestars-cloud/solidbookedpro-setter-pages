import { NextRequest } from "next/server";
import { saveEvent, updateMockCallByVapiId, upsertMockCall } from "@/lib/db";
import { json, verifyVapiSignature } from "@/lib/security";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const verified = await verifyVapiSignature(request, rawBody);
  if (!verified) return json({ error: "Invalid signature." }, { status: 401 });
  const payload = JSON.parse(rawBody || "{}");
  const message = payload.message || {};
  const call = message.call || {};
  const metadata = call.metadata || message.metadata || {};
  const applicantId = metadata.application_id || metadata.applicant_id || call.assistantOverrides?.metadata?.application_id;
  const mockCallNumber = Number(metadata.mock_call_number || call.assistantOverrides?.metadata?.mock_call_number);
  const vapiCallId = call.id || message.callId;

  if (applicantId && mockCallNumber && vapiCallId) {
    if (message.type === "status-update") {
      await upsertMockCall(applicantId, {
        mockCallNumber,
        vapiCallId,
        status: message.status === "ended" ? "completed" : message.status === "in-progress" ? "live" : "connecting",
        startedAt: call.startedAt || call.createdAt || null,
        endedAt: message.status === "ended" ? new Date().toISOString() : null
      });
    }
    if (message.type === "end-of-call-report") {
      await upsertMockCall(applicantId, {
        mockCallNumber,
        vapiCallId,
        status: "completed",
        startedAt: call.startedAt || call.createdAt || null,
        endedAt: call.endedAt || new Date().toISOString(),
        durationSeconds: call.durationSeconds || call.duration || null,
        endedReason: message.endedReason || call.endedReason || null
      });
      await updateMockCallByVapiId(vapiCallId, {
        transcript: message.artifact?.transcript || null,
        recording_url: message.artifact?.recording?.url || message.artifact?.recordingUrl || null,
        summary: message.summary || message.analysis?.summary || null,
        structured_output: message.analysis?.structuredData || message.analysis || null,
        raw_event_reference: payload
      });
    }
  }

  await saveEvent(applicantId || null, `vapi_${message.type || "webhook"}`, { callId: vapiCallId, mockCallNumber, message });
  return json({ received: true });
}
