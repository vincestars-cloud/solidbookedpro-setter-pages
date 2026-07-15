import fs from "node:fs";

const workflowName = "SolidBooked Pro - Setter Vapi Scoring";
const webhookPath = "solidbooked-setter-vapi-report";
const webhookUrl = `https://n8n.americanlifeteam.com/webhook/${webhookPath}`;
const assistantIds = [
  "32a6bb38-0a56-40db-ab03-2540f820cc56",
  "bb12a1d4-47de-4c50-b3d5-eac9c79e4995",
  "93f168a7-40ba-4144-a8f7-217358b4aa0a"
];

const root = new URL("..", import.meta.url);
const clientBridge = fs.readFileSync(new URL("lib/clientBridge.ts", root), "utf8");
const n8nSkill = fs.readFileSync("/Users/vincentohasiligwo/.openclaw/workspace-otto/skills/n8n-api/SKILL.md", "utf8");
const openAiSkill = fs.readFileSync("/Users/vincentohasiligwo/.openclaw/workspace-otto/skills/openai-api/SKILL.md", "utf8");

const n8nKey = n8nSkill.match(/N8N_KEY="([^"]+)"/)?.[1];
const openAiKey = openAiSkill.match(/Authorization: Bearer ([^\s`]+)/)?.[1];
const vapiKey = process.env.VAPI_PRIVATE_KEY;
const supabaseUrl = clientBridge.match(/const defaultSupabaseUrl = "([^"]+)/)?.[1];
const supabaseAnonKey = clientBridge.match(/const defaultSupabaseAnonKey =\n  "([^"]+)/)?.[1];
const bridgeUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/sbp_setter_bridge`;
const adminToken = process.env.SETTER_ADMIN_TOKEN || "scalingsos2026";

if (!n8nKey) throw new Error("n8n public API key not found.");
if (!openAiKey) throw new Error("OpenAI API key not found.");
if (!vapiKey) throw new Error("Set VAPI_PRIVATE_KEY before running this script.");
if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase public bridge config not found.");

const scoringCode = `
const helpers = this.helpers;
const VAPI_KEY = ${JSON.stringify(vapiKey)};
const OPENAI_KEY = ${JSON.stringify(openAiKey)};
const BRIDGE_URL = ${JSON.stringify(bridgeUrl)};
const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
const ADMIN_TOKEN = ${JSON.stringify(adminToken)};

function firstString(values) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function getPath(source, path) {
  return path.reduce((value, key) => (value && value[key] !== undefined ? value[key] : undefined), source);
}

function transcriptFromMessages(messages) {
  if (!Array.isArray(messages)) return '';
  const lines = [];
  for (const message of messages) {
    const role = String(message.role || message.type || '').toLowerCase();
    if (!['assistant', 'bot', 'ai', 'user', 'customer'].includes(role)) continue;
    const text = message.message || message.content || message.text || message.transcript || '';
    if (!text || typeof text !== 'string') continue;
    if (/you are role playing|evaluate through conversation|rules:|company context:|starting point:/i.test(text)) continue;
    const label = role === 'user' || role === 'customer' ? 'Applicant' : 'Prospect';
    lines.push(label + ': ' + text.trim());
  }
  return lines.join('\\n');
}

function cleanTranscript(value) {
  if (!value || typeof value !== 'string') return '';
  if (/you are role playing|evaluate through conversation|rules:|company context:|starting point:/i.test(value)) return '';
  return value
    .replace(/\\bAI:/g, 'Prospect:')
    .replace(/\\bAssistant:/g, 'Prospect:')
    .replace(/\\bUser:/g, 'Applicant:')
    .replace(/\\bCustomer:/g, 'Applicant:')
    .trim();
}

function hasApplicantSpeech(transcript) {
  return /(^|\\n)\\s*Applicant\\s*:/i.test(transcript || '');
}

function safeJson(value) {
  if (!value || typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
}

function durationSeconds(startedAt, endedAt, fallback) {
  if (Number.isFinite(Number(fallback)) && Number(fallback) > 0) return Math.round(Number(fallback));
  const start = startedAt ? new Date(startedAt).getTime() : NaN;
  const end = endedAt ? new Date(endedAt).getTime() : NaN;
  if (Number.isFinite(start) && Number.isFinite(end) && end >= start) return Math.round((end - start) / 1000);
  return null;
}

const incoming = $input.first().json || {};
const payload = incoming.body || incoming;
const message = payload.message || payload;
const eventType = String(message.type || payload.type || '');
if (eventType && eventType !== 'end-of-call-report') {
  return [{ json: { ok: true, skipped: true, eventType, reason: 'Only end-of-call-report events are scored.' } }];
}
const payloadCall = message.call || payload.call || {};
const payloadMetadata = payloadCall.metadata || message.metadata || getPath(payloadCall, ['assistantOverrides', 'metadata']) || {};
const initialCallId = firstString([
  payloadCall.id,
  message.callId,
  payload.callId,
  payload.call_id,
  payload.vapiCallId,
  payload.id
]);

let callDetail = {};
if (initialCallId) {
  try {
    const fetched = await helpers.httpRequest({
      method: 'GET',
      url: 'https://api.vapi.ai/call/' + encodeURIComponent(initialCallId),
      headers: { Authorization: 'Bearer ' + VAPI_KEY },
      json: true,
      ignoreHttpStatusErrors: true,
      timeout: 30000
    });
    if (fetched && !fetched.error) callDetail = fetched;
  } catch (error) {
    callDetail = {};
  }
}

const detailMetadata = callDetail.metadata || getPath(callDetail, ['assistantOverrides', 'metadata']) || {};
const metadata = { ...detailMetadata, ...payloadMetadata };
const vapiCallId = firstString([initialCallId, callDetail.id]);
const applicantId = firstString([
  metadata.application_id,
  metadata.applicant_id,
  payload.applicantId,
  payload.applicant_id
]);
const mockCallNumber = Number(
  metadata.mock_call_number ||
  metadata.mockCallNumber ||
  payload.mockCallNumber ||
  payload.mock_call_number ||
  0
);

const transcript = firstString([
  transcriptFromMessages(message.artifact?.messages),
  transcriptFromMessages(callDetail.artifact?.messages),
  transcriptFromMessages(message.messages),
  transcriptFromMessages(callDetail.messages),
  cleanTranscript(message.artifact?.transcript),
  cleanTranscript(payload.transcript),
  cleanTranscript(callDetail.artifact?.transcript),
  cleanTranscript(callDetail.transcript)
]);
const recordingUrl = firstString([
  message.artifact?.recording?.url,
  message.artifact?.recordingUrl,
  payload.recordingUrl,
  payload.recording_url,
  callDetail.recordingUrl,
  callDetail.artifact?.recordingUrl,
  callDetail.artifact?.recording?.url
]);
const startedAt = firstString([payload.startedAt, payload.started_at, payloadCall.startedAt, callDetail.startedAt, callDetail.createdAt]);
const endedAt = firstString([payload.endedAt, payload.ended_at, payloadCall.endedAt, callDetail.endedAt]);
const endedReason = firstString([payload.endedReason, payload.ended_reason, message.endedReason, payloadCall.endedReason, callDetail.endedReason]);
const duration = durationSeconds(startedAt, endedAt, payload.durationSeconds || payload.duration_seconds || callDetail.durationSeconds || callDetail.duration);
let summary = '';
let structuredOutput = {};
let backendScore = null;
let aiReview = null;

if (transcript && hasApplicantSpeech(transcript)) {
  const prompt = {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a strict appointment-setter hiring evaluator. Score only the applicant behavior in the transcript. Reward confident communication, listening, isolating objections, challenging brush-offs respectfully, and asking for a concrete appointment next step. Penalize accepting brush-offs like send me info or let me think without clarifying, low confidence, no next-step ask, rambling, or weak judgment. Return only valid JSON.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          mock_call_number: mockCallNumber,
          ended_reason: endedReason,
          transcript,
          required_json: {
            overall_score: '0-100 integer',
            recommendation: 'strong_fit | manual_review | poor_fit',
            summary: 'short hiring summary',
            strengths: ['specific strengths'],
            concerns: ['specific concerns'],
            criteria: {
              communication: '0-20',
              listening: '0-15',
              confidence: '0-15',
              objection_handling: '0-25',
              next_step_control: '0-15',
              judgment: '0-10'
            },
            objection_moments: [
              {
                objection: 'prospect objection or brush-off',
                candidate_response: 'what the applicant said',
                judgment: 'what was good or weak',
                score: '0-10',
                recommended_move: 'what a trained setter should have done'
              }
            ]
          }
        })
      }
    ]
  };
  const openAiResponse = await helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/chat/completions',
    headers: {
      Authorization: 'Bearer ' + OPENAI_KEY,
      'Content-Type': 'application/json'
    },
    body: prompt,
    json: true,
    ignoreHttpStatusErrors: true,
    timeout: 45000
  });
  aiReview = safeJson(openAiResponse?.choices?.[0]?.message?.content) || {
    summary: 'OpenAI scoring did not return parseable JSON.',
    concerns: ['Scoring parse failed.'],
    overall_score: null
  };
  const parsedScore = Number(aiReview.overall_score ?? aiReview.overallScore ?? aiReview.score);
  if (Number.isFinite(parsedScore)) backendScore = Math.max(0, Math.min(100, Math.round(parsedScore)));
  summary = summary || aiReview.summary || '';
  structuredOutput = {
    ...(structuredOutput && typeof structuredOutput === 'object' ? structuredOutput : {}),
    ai_review: aiReview,
    overall_score: backendScore,
    objection_moments: aiReview.objection_moments || []
  };
} else if (endedReason.includes('did-not-receive-customer-audio')) {
  backendScore = 0;
  structuredOutput = {
    ...(structuredOutput && typeof structuredOutput === 'object' ? structuredOutput : {}),
    overall_score: 0,
    ai_review: {
      overall_score: 0,
      recommendation: 'poor_fit',
      summary: 'Vapi did not receive applicant audio, so there was no usable applicant response to evaluate.',
      strengths: [],
      concerns: ['No applicant audio received by Vapi.'],
      objection_moments: []
    }
  };
} else {
  backendScore = 0;
  structuredOutput = {
    overall_score: 0,
    ai_review: {
      overall_score: 0,
      recommendation: 'poor_fit',
      summary: transcript
        ? 'The call did not include a captured applicant response, so there was no usable applicant behavior to evaluate.'
        : 'No usable transcript was available from Vapi for this call.',
      strengths: [],
      concerns: [transcript ? 'No applicant speech captured in transcript.' : 'No usable transcript received from Vapi.'],
      objection_moments: []
    }
  };
  summary = structuredOutput.ai_review.summary;
}

if (!applicantId || !mockCallNumber || !vapiCallId) {
  return [{ json: { ok: false, skipped: true, reason: 'Missing applicantId, mockCallNumber, or vapiCallId.', applicantId, mockCallNumber, vapiCallId } }];
}

const bridgePayload = {
  token: ADMIN_TOKEN,
  applicantId,
  mockCallNumber,
  vapiCallId,
  status: 'completed',
  startedAt,
  endedAt,
  durationSeconds: duration,
  endedReason,
  transcript,
  recordingUrl,
  summary,
  structuredOutput,
  backendScore,
  rawEventReference: payload
};

const saved = await helpers.httpRequest({
  method: 'POST',
  url: BRIDGE_URL,
  headers: {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: 'Bearer ' + SUPABASE_ANON_KEY
  },
  body: { req: { action: 'vapi_report', payload: bridgePayload } },
  json: true,
  ignoreHttpStatusErrors: true,
  timeout: 30000
});

return [{
  json: {
    ok: saved?.ok !== false,
    applicantId,
    mockCallNumber,
    vapiCallId,
    transcriptSaved: Boolean(transcript),
    recordingSaved: Boolean(recordingUrl),
    backendScore,
    supabase: saved
  }
}];
`;

const workflow = {
  name: workflowName,
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: webhookPath,
        options: {}
      },
      type: "n8n-nodes-base.webhook",
      typeVersion: 2.1,
      position: [0, 0],
      name: "Vapi End Of Call Webhook",
      webhookId: "solidbooked-setter-vapi-report"
    },
    {
      parameters: { jsCode: scoringCode },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [320, 0],
      name: "Score and Save Call"
    }
  ],
  connections: {
    "Vapi End Of Call Webhook": {
      main: [[{ node: "Score and Save Call", type: "main", index: 0 }]]
    }
  },
  settings: { executionOrder: "v1" }
};

async function n8n(path, options = {}) {
  const response = await fetch(`https://n8n.americanlifeteam.com/api/v1${path}`, {
    ...options,
    headers: {
      "X-N8N-API-KEY": n8nKey,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = {};
  try { body = JSON.parse(text); } catch { body = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

async function vapi(path, options = {}) {
  const response = await fetch(`https://api.vapi.ai${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${vapiKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body = {};
  try { body = JSON.parse(text); } catch { body = { message: text.slice(0, 500) }; }
  if (!response.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed: ${response.status} ${JSON.stringify(body).slice(0, 500)}`);
  }
  return body;
}

const workflows = await n8n("/workflows?limit=250");
const matches = (workflows.data || workflows || []).filter((item) => item.name === workflowName);
const existing = matches.find((item) => item.active) || matches[0];
let deployed;
if (existing?.id) {
  deployed = await n8n(`/workflows/${existing.id}`, {
    method: "PUT",
    body: JSON.stringify(workflow)
  });
} else {
  deployed = await n8n("/workflows", {
    method: "POST",
    body: JSON.stringify(workflow)
  });
}
const workflowId = deployed.id || deployed.data?.id || existing?.id;
await n8n(`/workflows/${workflowId}/activate`, { method: "POST" }).catch((error) => {
  if (!String(error.message).includes("already active")) throw error;
});

const assistantResults = [];
for (const id of assistantIds) {
  const updated = await vapi(`/assistant/${id}`, {
    method: "PATCH",
    body: JSON.stringify({
      serverUrl: webhookUrl,
      serverMessages: ["end-of-call-report", "status-update", "conversation-update", "hang"],
      analysisPlan: {
        summaryPlan: { enabled: false },
        structuredDataPlan: { enabled: false }
      }
    })
  });
  assistantResults.push({ id, name: updated.name, serverUrl: updated.serverUrl, serverMessages: updated.serverMessages });
}

console.log(JSON.stringify({
  ok: true,
  workflowId,
  webhookUrl,
  assistants: assistantResults
}, null, 2));
