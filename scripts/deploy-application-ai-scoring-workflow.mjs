import fs from "node:fs";

const workflowName = "SolidBooked Pro - Setter Application AI Scoring";
const webhookPath = "solidbooked-setter-application-ai-score";
const webhookUrl = `https://n8n.americanlifeteam.com/webhook/${webhookPath}`;

const root = new URL("..", import.meta.url);
const clientBridge = fs.readFileSync(new URL("lib/clientBridge.ts", root), "utf8");
const n8nSkill = fs.readFileSync("/Users/vincentohasiligwo/.openclaw/workspace-otto/skills/n8n-api/SKILL.md", "utf8");
const openAiSkill = fs.readFileSync("/Users/vincentohasiligwo/.openclaw/workspace-otto/skills/openai-api/SKILL.md", "utf8");

const n8nKey = n8nSkill.match(/N8N_KEY="([^"]+)"/)?.[1];
const openAiKey = openAiSkill.match(/Authorization: Bearer ([^\s`]+)/)?.[1];
const supabaseUrl = clientBridge.match(/const defaultSupabaseUrl = "([^"]+)/)?.[1];
const supabaseAnonKey = clientBridge.match(/const defaultSupabaseAnonKey =\n  "([^"]+)/)?.[1];
const bridgeUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/sbp_setter_bridge`;
const adminToken = process.env.SETTER_ADMIN_TOKEN || "scalingsos2026";

if (!n8nKey) throw new Error("n8n public API key not found.");
if (!openAiKey) throw new Error("OpenAI API key not found.");
if (!supabaseUrl || !supabaseAnonKey) throw new Error("Supabase public bridge config not found.");

const scoringCode = `
const helpers = this.helpers;
const OPENAI_KEY = ${JSON.stringify(openAiKey)};
const BRIDGE_URL = ${JSON.stringify(bridgeUrl)};
const SUPABASE_ANON_KEY = ${JSON.stringify(supabaseAnonKey)};
const ADMIN_TOKEN = ${JSON.stringify(adminToken)};

function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.max(min, Math.min(max, Math.round(number)));
}

function safeJson(value) {
  if (!value || typeof value !== 'string') return null;
  try { return JSON.parse(value); } catch { return null; }
}

function readableAvailability(value) {
  if (!value || typeof value !== 'object') return '';
  return [value.start, value.end].filter(Boolean).join(' to ');
}

function extractResponseText(response) {
  if (typeof response?.output_text === 'string') return response.output_text;
  const pieces = [];
  for (const output of response?.output || []) {
    for (const item of output?.content || []) {
      if (typeof item?.text === 'string') pieces.push(item.text);
    }
  }
  return pieces.join('\\n').trim();
}

async function bridge(action, payload) {
  const response = await helpers.httpRequest({
    method: 'POST',
    url: BRIDGE_URL,
    headers: {
      'Content-Type': 'application/json',
      apikey: SUPABASE_ANON_KEY,
      Authorization: 'Bearer ' + SUPABASE_ANON_KEY
    },
    body: { req: { action, payload } },
    json: true,
    ignoreHttpStatusErrors: true,
    timeout: 30000
  });
  if (!response || response.ok === false) {
    throw new Error(response?.message || response?.error || 'Supabase bridge request failed.');
  }
  return response;
}

const incoming = $input.first().json || {};
const payload = incoming.body || incoming;
const applicantId = String(payload.applicantId || payload.applicant_id || '').trim();
if (!applicantId) throw new Error('Applicant ID is required.');

const detail = await bridge('admin_detail', { token: ADMIN_TOKEN, id: applicantId });
const applicant = detail.applicant || {};
let resume = {};
try {
  const resumeResponse = await bridge('admin_resume', { token: ADMIN_TOKEN, id: applicantId });
  resume = resumeResponse.resume || {};
} catch (error) {
  resume = {};
}

let resumeTextForScoring = String(resume.resumeText || '').trim();
let resumeTextSource = resumeTextForScoring ? 'browser_extracted_text' : 'none';

if (resumeTextForScoring.length < 100 && resume.fileBase64) {
  const fileType = String(resume.fileType || 'application/pdf');
  const fileName = String(resume.fileName || applicant.resume_file_name || 'resume.pdf');
  const fileData = 'data:' + fileType + ';base64,' + String(resume.fileBase64 || '');
  const extractionResponse = await helpers.httpRequest({
    method: 'POST',
    url: 'https://api.openai.com/v1/responses',
    headers: {
      Authorization: 'Bearer ' + OPENAI_KEY,
      'Content-Type': 'application/json'
    },
    body: {
      model: 'gpt-4o-mini',
      temperature: 0.1,
      input: [
        {
          role: 'user',
          content: [
            {
              type: 'input_file',
              filename: fileName,
              file_data: fileData
            },
            {
              type: 'input_text',
              text: 'Extract the candidate resume into concise plain text for hiring review. Preserve names, roles, companies, dates, tools, sales/calling experience, metrics, and achievements. If the file is an image or scan, read visible text. Return only the extracted resume text, maximum 12000 characters.'
            }
          ]
        }
      ]
    },
    json: true,
    ignoreHttpStatusErrors: true,
    timeout: 60000
  });
  const extracted = extractResponseText(extractionResponse);
  if (extracted && extracted.length > resumeTextForScoring.length) {
    resumeTextForScoring = extracted.slice(0, 16000);
    resumeTextSource = 'openai_file_input';
  }
}

const packet = {
  applicant_id: applicantId,
  role: 'Remote appointment setter for SolidBooked Pro, calling warm and cold business owners during U.S. Eastern hours.',
  application: {
    full_name: applicant.full_name,
    preferred_name: applicant.preferred_name,
    email: applicant.normalized_email,
    desired_hourly_pay: applicant.desired_hourly_pay,
    earliest_start_date: applicant.earliest_start_date,
    availability_est: readableAvailability(applicant.availability_est),
    crm_platforms: applicant.crm_platforms,
    appointment_setting_or_cold_calling_experience: applicant.appointment_setting_experience,
    industries_or_offers: applicant.industries,
    past_metrics: applicant.past_metrics,
    vocaroo_url_present: Boolean(applicant.vocaroo_url),
    location: [applicant.location_city, applicant.location_region, applicant.location_country].filter(Boolean).join(', ')
  },
  resume: {
    file_name: resume.fileName || applicant.resume_file_name,
    text: resumeTextForScoring.slice(0, 14000),
    text_extracted: Boolean(resumeTextForScoring),
    text_source: resumeTextSource,
    prior_resume_analysis: applicant.resume_analysis || resume.resumeAnalysis || null
  },
  scoring_rubric_total_70: {
    resume: '0-10: directly relevant sales, SDR, appointment setting, outbound, phone, CRM, measurable performance. Penalize unrelated, inflated, vague, or no readable resume.',
    appointment_setting_experience: '0-20: depth and specificity of appointment setting, cold calling, follow-up, objection handling, phone confidence, prior outbound sales. Reward evidence of staying in uncomfortable conversations, not just customer service.',
    past_metrics: '0-20: specific numbers such as calls, conversations, appointments booked, show rates, quotas, conversion rates. Strong metrics beat polished wording. Vague claims score low.',
    crm_tools: '0-8: relevant CRM, dialer, scheduling, tracking, prospecting tool familiarity.',
    industries_fit: '0-7: experience with local service, B2B, marketing, lead gen, websites, high-volume phone roles, or transferable offers.',
    reliability_clarity: '0-5: coherent answers, realistic schedule/pay expectations, consistency, professionalism, coachability, and no obvious contradictions.'
  }
};

const openAiResponse = await helpers.httpRequest({
  method: 'POST',
  url: 'https://api.openai.com/v1/chat/completions',
  headers: {
    Authorization: 'Bearer ' + OPENAI_KEY,
    'Content-Type': 'application/json'
  },
  body: {
    model: 'gpt-4o-mini',
    temperature: 0.1,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'You are a strict hiring evaluator for a remote appointment setter role, using a sales-advisor rubric informed by NEPQ, No Resistance Sales, Josh Lyons discovery depth, and practical outbound B2B appointment setting. Score only the application and resume packet, not mock-call transcripts. Reward evidence of real outbound reps: cold/warm calling, staying in uncomfortable objection moments, follow-up discipline, CRM/dialer use, measurable appointment production, show-rate awareness, phone stamina, coachability, and clear truthful communication. Do not over-reward polished resume language without numbers or proof. Penalize vague answers, no measurable proof, customer-service-only experience, job hopping without context, inflated claims, weak availability/pay mismatch, and obvious contradictions. Return only valid JSON.'
      },
      {
        role: 'user',
        content: JSON.stringify({
          packet,
          sales_expert_lens: {
            what_strong_looks_like: [
              'Has made many outbound calls and can stay calm through objections.',
              'Understands that send me info / let me think can be brush-offs, not buying signals.',
              'Tracks calls, conversations, booked appointments, show rate, quota, or similar KPIs.',
              'Has used CRM/dialer workflows and follows up consistently.',
              'Communicates specifically and can be coached.'
            ],
            what_weak_looks_like: [
              'Only says they are good with people but gives no phone-sales evidence.',
              'No numbers, quotas, appointment counts, or show-rate awareness.',
              'Treats follow-up as passive checking in instead of leading to a next step.',
              'Mostly retail/customer service/admin experience with no outbound sales transfer.',
              'Contradictory availability, unrealistic pay expectations, or vague answers.'
            ]
          },
          required_json: {
            application_score_70: '0-70 integer; sum of score_breakdown',
            resume_score_10: '0-10 integer',
            recommendation: 'strong_fit | manual_review | poor_fit',
            summary: 'plain English hiring summary',
            strengths: ['specific strengths'],
            concerns: ['specific concerns'],
            resume_assessment: 'what the resume suggests for this role',
            application_assessment: 'what the written application suggests',
            sales_experience_signal: 'none | weak | moderate | strong',
            metrics_quality: 'none | vague | usable | strong',
            risk_flags: ['specific risk flags'],
            score_breakdown: {
              resume: '0-10',
              appointment_setting_experience: '0-20',
              past_metrics: '0-20',
              crm_tools: '0-8',
              industries_fit: '0-7',
              reliability_clarity: '0-5'
            }
          }
        })
      }
    ]
  },
  json: true,
  ignoreHttpStatusErrors: true,
  timeout: 45000
});

const ai = safeJson(openAiResponse?.choices?.[0]?.message?.content);
if (!ai) throw new Error('OpenAI application scoring did not return valid JSON.');

const breakdown = ai.score_breakdown || ai.scoreBreakdown || {};
const applicationScore = clamp(
  ai.application_score_70 ??
    ai.applicationScore70 ??
    ai.application_score ??
    (
      Number(breakdown.resume || 0) +
      Number(breakdown.appointment_setting_experience || 0) +
      Number(breakdown.past_metrics || 0) +
      Number(breakdown.crm_tools || 0) +
      Number(breakdown.industries_fit || 0) +
      Number(breakdown.reliability_clarity || 0)
    ),
  0,
  70
);
const resumeScore = clamp(ai.resume_score_10 ?? breakdown.resume ?? ai.resumeScore, 0, 10);
const analysis = {
  ...ai,
  application_score_70: applicationScore,
  resume_score_10: resumeScore,
  model: 'gpt-4o-mini',
  scored_at: new Date().toISOString()
};
const resumeAnalysis = {
  summary: ai.resume_assessment || ai.resumeAssessment || '',
  strengths: Array.isArray(ai.strengths) ? ai.strengths : [],
  concerns: Array.isArray(ai.concerns) ? ai.concerns : [],
  textExtracted: Boolean(resumeTextForScoring),
  extractedCharacters: String(resumeTextForScoring || '').length,
  textSource: resumeTextSource,
  aiScored: true,
  score: resumeScore
};

const saved = await bridge('ai_application_score', {
  token: ADMIN_TOKEN,
  applicantId,
  applicationScore,
  resumeScore,
  analysis,
  resumeAnalysis,
  resumeText: resumeTextForScoring
});

return [{
  json: {
    ok: true,
    applicantId,
    applicationScore,
        resumeScore,
        resumeTextSource,
        recommendation: analysis.recommendation,
    saved
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
        responseMode: "lastNode",
        options: {}
      },
      type: "n8n-nodes-base.webhook",
      typeVersion: 2.1,
      position: [0, 0],
      name: "Application AI Score Webhook",
      webhookId: "solidbooked-setter-application-ai-score"
    },
    {
      parameters: { jsCode: scoringCode },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [320, 0],
      name: "Score Application and Resume"
    }
  ],
  connections: {
    "Application AI Score Webhook": {
      main: [[{ node: "Score Application and Resume", type: "main", index: 0 }]]
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
  try {
    body = JSON.parse(text);
  } catch {
    body = { message: text.slice(0, 500) };
  }
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

console.log(JSON.stringify({ ok: true, workflowId, webhookUrl }, null, 2));
