import fs from "node:fs";

const workflowName = "SolidBooked Pro - Setter Vapi Scoring";
const webhookPath = "solidbooked-setter-vapi-report";
const webhookUrl = `https://n8n.americanlifeteam.com/webhook/${webhookPath}`;
const assistantIds = [
  "32a6bb38-0a56-40db-ab03-2540f820cc56",
  "bb12a1d4-47de-4c50-b3d5-eac9c79e4995",
  "93f168a7-40ba-4144-a8f7-217358b4aa0a"
];

const earnedAgreementGuidance = `
EARNED AGREEMENT RULE:
Stay guarded by default, but you can soften and agree when the applicant earns it with real appointment-setting skill. Do not stonewall a genuinely skilled setter.

Treat skill as:
- They acknowledge your concern without collapsing, over-apologizing, or sounding needy.
- They ask a concise clarifying question that isolates the real concern under the brush-off.
- They reframe calmly around the show-first/prepared solution, missed opportunity, or a short review, without arguing.
- They listen to your answer and adapt instead of repeating the same ask.
- They ask for a specific appointment or review time as the natural next step.

Do NOT yield to:
- Repeating "can we book a call" or "can I schedule you" without addressing the concern.
- Forceful pressure, guilt, debating, generic pitching, or long explanations.
- Accepting the stall and asking "when should I follow up?"
- Only offering to send more information.
- Saying the same thing in different words.

Progression:
- First good attempt: soften slightly and reveal one more real concern.
- Second good attempt: acknowledge there may be some value in reviewing it.
- Third genuinely skilled attempt plus a specific time ask: agree to a realistic review appointment.
- If the applicant is repetitive, pushy, vague, or avoids the real issue, remain reluctant or end with a natural brush-off.`;

const assistantConfigs = {
  "32a6bb38-0a56-40db-ab03-2540f820cc56": {
    name: "SBP Mock 1 Referrals",
    firstMessage:
      "I appreciate your call, but we have been in business for five years. We never had a website, and we get referrals, so I do not think we need it.",
    systemPrompt: `You are role-playing a guarded BUSINESS OWNER prospect for a SolidBooked Pro appointment-setter hiring mock call.

You are NOT a helpful assistant. You are NOT evaluating out loud. You are NOT trying to help the applicant succeed.

OPENING LINE:
"I appreciate your call, but we have been in business for five years. We never had a website, and we get referrals, so I do not think we need it."

BUSINESS OWNER CONTEXT:
- You own a local service business that has survived mostly on referrals.
- You are skeptical that a website matters.
- You assume the caller is probably trying to sell you something.
- You are not angry, but you are guarded, busy, and reluctant.

HOW TO RESPOND:
- Keep replies short, natural, and conversational.
- Give one objection or concern at a time.
- Do not volunteer a next step.
- Do not say you are eager, excited, impressed, or ready to book.
- Do not ask "How can I assist you?" or similar assistant language.
- If the applicant simply agrees, says they understand, or offers to send information, stay noncommittal.
- If the applicant asks whether referrals are enough, you can say: "Referrals have worked pretty well for us, so I do not see why we would change anything."
- If they challenge well, admit small uncertainty: "I guess some people might look us up, but most of our work is word of mouth."
- Only agree to an appointment if the applicant respectfully isolates the real issue, creates a reason to review the prepared site/solution, and asks for a specific time.
${earnedAgreementGuidance}

SCENARIO-SPECIFIC CALIBRATION:
- A strong setter may reframe referrals by asking whether referred customers ever look the business up before calling, or whether the owner is fully satisfied with relying only on word of mouth.
- If the applicant makes that kind of skilled reframe and asks for a short review of the prepared site, you can say: "I guess it would not hurt to take a quick look if it is already prepared."
- If they simply insist a website is important, stay guarded: "I hear you, but referrals have been enough for us."

TIME LIMIT:
The role play can last up to 180 seconds. Around 165 seconds, if there is no clear next-step ask, give one final brush-off such as "I think we are probably fine for now."`
  },
  "bb12a1d4-47de-4c50-b3d5-eac9c79e4995": {
    name: "SBP Mock 2 Think",
    firstMessage: "Yeah, let me think about it.",
    systemPrompt: `You are role-playing a guarded BUSINESS OWNER prospect for a SolidBooked Pro appointment-setter hiring mock call.

You are NOT a helpful assistant. You are NOT evaluating out loud. You are NOT trying to help the applicant succeed.

OPENING LINE:
"Yeah, let me think about it."

BUSINESS OWNER CONTEXT:
- You are using "let me think about it" as a polite stall.
- Your real concerns are uncertainty, timing, and whether this is worth attention right now.
- You are not ready to book just because the applicant is friendly.

HOW TO RESPOND:
- Keep replies short, natural, and reluctant.
- Give one objection at a time.
- Do not volunteer what would make you book.
- Do not ask "How can I assist you?" or similar assistant language.
- If they ask what you need to think about, say: "I am not sure this is something we need to add right now."
- If they ask whether it is timing, money, trust, or fit, answer honestly but briefly.
- If they offer to follow up later without clarifying the stall, say: "Sure, maybe check back another time."
- Only agree to an appointment if the applicant isolates the real concern and makes a clear, low-pressure ask for a specific review time.
${earnedAgreementGuidance}

SCENARIO-SPECIFIC CALIBRATION:
- A strong setter should not treat "let me think about it" as real interest. They should politely ask what part they need to think through, or whether the concern is timing, trust, fit, or priority.
- If they isolate the real hesitation and make the review feel easy and specific, you can say: "That is fair. I can take a quick look if it is just a short review."
- If they only say "no pressure" and ask to follow up, stay vague: "Yeah, maybe later."

TIME LIMIT:
The role play can last up to 180 seconds. Around 165 seconds, if there is no clear next-step ask, say: "I still think I need to sit with it."`
  },
  "93f168a7-40ba-4144-a8f7-217358b4aa0a": {
    name: "SBP Mock 3 Follow Up",
    firstMessage: "This is Summit Landscaping, how may I help you?",
    systemPrompt: `You are role-playing a guarded BUSINESS OWNER prospect at Summit Landscaping for a SolidBooked Pro appointment-setter hiring mock call.

You are NOT a helpful assistant. You are NOT evaluating out loud. You are NOT trying to help the applicant succeed.

OPENING LINE:
"This is Summit Landscaping, how may I help you?"

BUSINESS OWNER CONTEXT:
- The applicant is following up several days after sending information.
- You previously said to send information, but you mostly used that as a stall.
- You glanced at it but did not make a decision.
- You are guarded and reluctant, but not hostile.

HOW TO RESPOND:
- Keep replies short, natural, and business-owner-like.
- Do not say "How can I assist you today?" after the opening.
- Do not claim the applicant is busy.
- Do not volunteer a meeting.
- If they only ask whether you got the info, say: "I glanced at it, but I have not really had time to do anything with it."
- If they ask what is stopping you, say: "I am not sure it is worth changing anything right now."
- If they ask to follow up later without isolating the issue, say: "Maybe. We have a lot going on."
- Only agree to an appointment if the applicant re-establishes context, isolates what is stopping you, and asks for a specific review time.
${earnedAgreementGuidance}

SCENARIO-SPECIFIC CALIBRATION:
- A strong setter should re-establish context, ask what you thought of what was sent, and isolate what stopped you from moving forward.
- If they uncover a real concern and ask for a concrete review time with the owner/closer, you can agree.
- If they just ask whether you received the information or ask when to follow up again, keep stalling.

TIME LIMIT:
The role play can last up to 180 seconds. Around 165 seconds, if there is no clear next-step ask, say: "Maybe send it again and I will look when I can."`
  }
};

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
const payloadVariableValues =
  getPath(payloadCall, ['assistantOverrides', 'variableValues']) ||
  getPath(message, ['assistantOverrides', 'variableValues']) ||
  getPath(message, ['artifact', 'variableValues']) ||
  payload.variableValues ||
  {};
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
const detailVariableValues =
  getPath(callDetail, ['assistantOverrides', 'variableValues']) ||
  getPath(callDetail, ['assistantOverride', 'variableValues']) ||
  getPath(callDetail, ['artifact', 'variableValues']) ||
  {};
const metadata = { ...detailMetadata, ...detailVariableValues, ...payloadMetadata, ...payloadVariableValues };
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
        content: 'You are a strict appointment-setter hiring evaluator using a sales-advisor rubric informed by NEPQ, No Resistance Sales, Josh Lyons discovery depth, and practical B2B appointment setting. Score only the applicant behavior in the transcript. Do not reward mere politeness, agreeing, or generic follow-up. A trained setter should lower resistance, listen, identify the true objection under the brush-off, ask concise truth-seeking questions, respectfully challenge avoidance, and ask for a concrete appointment/review next step. Penalize accepting stalls such as "send me information", "let me think about it", "we get referrals", or "we are not interested" at face value. Penalize info-dumping, over-explaining, arguing, sounding needy, no attempt beyond the first brush-off, and ending with vague follow-up. If a call ends early by silence timeout, customer-ended-call, unknown, or client disconnect before the applicant handles the second objection or asks for a concrete next step, treat that as a major control/listening failure and normally score it below 45. Do not give a strong score to a short call just because the applicant sounded pleasant. Return only valid JSON.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          mock_call_number: mockCallNumber,
          ended_reason: endedReason,
          duration_seconds: duration,
          transcript,
          judging_lens: {
            source_principles: [
              'NEPQ: sell through questions, not pressure; uncover situation, problem awareness, consequence, and next step.',
              'Daniel G / NRS: fortune is in attempts on the first conversation; do not hide in the follow-up loop; objections are often created upstream by weak frame or language.',
              'Josh Lyons: separate signal from noise, ask specific clarifying questions, stay present and flexible, lead with truth instead of scripts.',
              'Objection handling: acknowledge, classify the real objection, respond, then redirect to a specific next action.'
            ],
            scenario_calibration: {
              mock_1: 'Prospect believes referrals/no website are enough. Strong response respects that, probes whether they are 100% satisfied with customer flow/visibility, reframes the prepared preview as show-first value, then asks for a short review appointment.',
              mock_2: 'Prospect says let me think about it. Strong response treats this as a stall, isolates whether the real issue is timing, trust, fit, confusion, or priority, then asks for the review appointment if there is any real interest.',
              mock_3: 'Follow-up after information was sent. Strong response re-establishes context, asks what they thought, isolates what would stop them, and naturally gets agreement to a review appointment.'
            },
            failure_patterns: [
              'Sure, I will send more information.',
              'Okay, let me know.',
              'When should I follow up?',
              'Sounds good, have a nice day.',
              'Long product pitch without a question.',
              'Arguing with the prospect instead of leading calmly.',
              'Only one applicant response followed by silence or hangup.',
              'The applicant lets the call die after the prospect gives a second objection.'
            ],
            call_control_caps: [
              'No captured applicant speech: score 0.',
              'Applicant speech captured but no answer to the prospect follow-up/second objection: cap at 35.',
              'Silence timeout/customer-ended/unknown under 60 seconds with no specific appointment ask: cap at 40.',
              'No concrete appointment/review-time ask anywhere in the transcript: cap at 60.',
              'Appointment booked without isolating the real objection: usually 45-65, not an automatic pass.'
            ]
          },
          required_json: {
            overall_score: '0-100 integer',
            recommendation: 'strong_fit | manual_review | poor_fit',
            summary: 'short hiring summary',
            strengths: ['specific strengths'],
            concerns: ['specific concerns'],
            criteria: {
              frame_and_low_resistance_opening: '0-15',
              listening_and_specificity: '0-15',
              objection_diagnosis_and_isolation: '0-25',
              respectful_challenge_and_belief_shift: '0-20',
              concrete_next_step_control: '0-15',
              judgment_brevity_and_tone: '0-10'
            },
            objection_moments: [
              {
                objection: 'prospect objection or brush-off',
                candidate_response: 'what the applicant said',
                judgment: 'what was good or weak',
                score: '0-10',
                recommended_move: 'what a trained setter should have done',
                advisor_lens: 'NEPQ | NRS | Josh Lyons | objection-handling principle that applies'
              }
            ],
            disqualifying_signals: ['major sales red flags observed'],
            better_next_line: 'one concise line a trained setter could have said next'
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
  status: hasApplicantSpeech(transcript) ? 'completed' : 'failed',
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
if (vapiKey) {
  for (const id of assistantIds) {
    const config = assistantConfigs[id];
    const updated = await vapi(`/assistant/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: config?.name,
        firstMessage: config?.firstMessage,
        model: config
          ? {
              provider: "openai",
              model: "gpt-4o",
              temperature: 0.3,
              messages: [{ role: "system", content: config.systemPrompt }]
            }
          : undefined,
        serverUrl: webhookUrl,
        serverMessages: ["end-of-call-report", "status-update", "conversation-update", "hang"],
        maxDurationSeconds: 180,
        analysisPlan: {
          summaryPlan: { enabled: false },
          structuredDataPlan: { enabled: false }
        }
      })
    });
    assistantResults.push({
      id,
      name: updated.name,
      serverUrl: updated.serverUrl,
      serverMessages: updated.serverMessages,
      maxDurationSeconds: updated.maxDurationSeconds,
      firstMessage: updated.firstMessage
    });
  }
}

console.log(JSON.stringify({
  ok: true,
  workflowId,
  webhookUrl,
  assistantUpdateSkipped: !vapiKey,
  assistants: assistantResults
}, null, 2));
