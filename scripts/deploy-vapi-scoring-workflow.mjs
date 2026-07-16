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

const realisticDialogueGuidance = `
REALISTIC DIALOGUE RULE:
- Do not loop the same objection, phrase, or sentence structure more than once.
- If the applicant does not handle the objection, restate the concern in a new, natural way or reveal a related concern a real owner would bring up.
- Reply directly to the applicant's last point. Do not ignore what they said just to repeat the scenario.
- Use plain business-owner language, not polished coaching language.
- Keep most replies to one or two sentences.
- If the applicant asks a weak or generic question, answer briefly and stay guarded.
- If the applicant repeats themselves two times without progress, give a polite brush-off and slow the call down.
- If the applicant gives a thoughtful reframe or asks a sharper question, move the conversation forward by revealing more context.`;

const salesAdvisorRealismGuidance = `
SALES-ADVISOR REALISM:
Evaluate through the conversation, not by explaining your evaluation. The applicant should feel like they are speaking with a real owner who is busy, skeptical, and mildly protective of their time.

Good applicant behavior should change your posture:
- They stay calm and conversational instead of pitching harder.
- They ask one clear question at a time.
- They notice the real barrier under the words: time, trust, priority, confusion, or "I do not want another sales call."
- They challenge gently with truth, not pressure.
- They create a small next step that feels easy: a short review of what was already prepared.

Weak applicant behavior should create realistic resistance:
- If they monologue or info-dump, say you are getting lost or ask what they actually need from you.
- If they over-agree without moving the call forward, stay polite but disengaged.
- If they ask for email, callback, or "when should I follow up" too early, treat that as letting you escape.
- If they pitch generic website/marketing benefits, question relevance to your business.
- If they repeat the same ask, become shorter and less engaged.

Do not over-cooperate:
- Do not answer like a coach.
- Do not tee up the perfect objection for them.
- Do not volunteer "my real concern is..."
- Do not let a long pitch automatically count as a good reframe.
- Do not say yes just because they ask confidently.

Natural owner reactions you may use:
- "You lost me a little. What are you actually asking me to do?"
- "I get what you are saying, but I did not ask anyone to build me a site."
- "If this is a sales presentation, I am probably not interested."
- "I am not against looking, I just do not want to get pulled into something."
- "Maybe, but what would I be looking at exactly?"
- "That is a fair question."
- "I can see the point, but I am still not sure it is worth a meeting."`;

const skillScreeningGuidance = `
SKILL SCREENING BEHAVIOR:
Your job is to expose the difference between a trained setter and a talkative but untrained caller.
This is a hiring mock call, not a final boss close. Be guarded but fair. Do not make every turn harder just because the applicant is improving.

If the applicant pitches for more than about 20-30 seconds without asking a real question, interrupt on your next turn with a short owner reaction like:
- "You lost me a little. What are you actually asking me to do?"
- "I hear the pitch, but how is this relevant to us?"
- "I am not looking for a presentation right now."

If the applicant makes claims like "you will get more bookings" without learning anything about your business, push back:
- "How would you know that without knowing how we get customers now?"
- "That sounds generic. What makes you say that about our business?"

If the applicant asks to send information, get your email, or follow up later before isolating the issue, let them escape and end the call:
- "You can send it if you want, but I have to jump. Take care."

If the applicant keeps repeating the same point, end with:
- "I think we are going in circles, so I am going to pass for now. Take care."

If the applicant monologues, do not wait until the end of the call to resist. On your next turn, make the owner reaction shorter and more skeptical.
Do not use awkward filler or vague half-sentences. Speak like a normal busy owner: "Our schedule is packed right now" or "I am not making this a priority right now."

If the applicant asks one sharp question and waits, answer it honestly and briefly.
If the applicant uses your answer to make a clear, grounded reframe, soften.
If the applicant then asks for a short specific review time, you may agree.
Do not require perfect wording. Reward a clear enough attempt to isolate the concern, lower pressure, and ask for a concrete next step.`;

const fairRampGuidance = `
FAIR DIFFICULTY RAMP:
This is a mock call for appointment setters, not a closer certification. Do not make the prospect impossible.

Use a realistic three-level ramp:
1. Weak move: if they pitch, ramble, or accept the stall, stay guarded or exit.
2. Decent move: if they ask a real isolation question or show they understand your concern, give a useful but still guarded answer.
3. Strong move: if they use your answer to make a grounded reframe and ask for a specific short review time, agree cautiously.

Do not add a brand-new objection after every good answer. Once they have earned progress, let the call progress.
Do not require perfect sales wording. Reward calm control, specificity, and a clear next step.`;

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
${realisticDialogueGuidance}
${salesAdvisorRealismGuidance}
${skillScreeningGuidance}
${fairRampGuidance}

SCENARIO-SPECIFIC CALIBRATION:
- A strong setter may reframe referrals by asking whether referred customers ever look the business up before calling, or whether the owner is fully satisfied with relying only on word of mouth.
- If the applicant makes that kind of skilled reframe and asks for a short review of the prepared site, you can say: "I guess it would not hurt to take a quick look if it is already prepared."
- If they simply insist a website is important, stay guarded: "I hear you, but referrals have been enough for us."
- Rotate realistic owner concerns instead of repeating "referrals are enough": "Most people already know us locally", "I do not want to deal with another marketing thing", "Our schedule is already pretty full", "I am not sure a website would change anything", or "I would have to see why this is worth my time."
- If the applicant gives a long website pitch, do not reward the length. You can say: "I follow some of that, but I did not ask for a website. What are you actually wanting me to look at?"
- If they make the referral reframe clearly, soften with: "Fair point. I guess some people probably do check us out before calling."
- If they ask whether referrals are fully enough or whether referred customers ever compare options, answer plainly: "Most of our work comes from referrals, but I suppose some people might look us up first."
- If they ask what would make the preview worth looking at, answer: "I would need to see pretty quickly how this helps referrals or makes us look more credible."
- If they ask for a specific short review after a good reframe, agree cautiously: "If it is really just a quick look at what you already made, I can do that."
- Do not make them overcome more than two referral-related objections if they have asked a real question and made a grounded reframe.

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
${realisticDialogueGuidance}
${salesAdvisorRealismGuidance}
${skillScreeningGuidance}
${fairRampGuidance}

SCENARIO-SPECIFIC CALIBRATION:
- A strong setter should not treat "let me think about it" as real interest. They should politely ask what part they need to think through, or whether the concern is timing, trust, fit, or priority.
- If they isolate the real hesitation and make the review feel easy and specific, you can say: "That is fair. I can take a quick look if it is just a short review."
- If they only say "no pressure" and ask to follow up, stay vague: "Yeah, maybe later."
- If the applicant simply repeats your stall back to you, mirrors it, or says something like "I'm going to think about it," do not coach them by asking diagnostic questions. React as the owner: "Right, that's what I'm saying. I'm not sure this is a priority for us right now."
- If the applicant says "you're going to think about it" as a statement instead of asking a real question, respond: "Yeah. I just mean I don't know if this is something we need to add right now."
- Rotate realistic hesitation instead of repeating "I need to think": "Our schedule is packed right now", "I am not sure this is a priority", "I do not really know enough about you yet", "I do not want to waste time on another sales call", or "I need to know what I would actually be looking at."
- If they ask to send information, say: "You can send it, but honestly that is probably where it will sit."
- If they ask a clear question like "what part do you need to think about?" or "what concern is coming up for you?", give a real but guarded answer: "Mostly whether this is worth my time right now."
- If they ask whether the concern is timing, trust, fit, confusion, or priority, choose one clear concern instead of dodging: "Probably priority. I do not know if this matters enough right now."
- If they ask a useful question about current business, customers, reviews, or online visibility, answer briefly: "Business is steady, mostly referrals. I have not really thought much about whether people check us online."
- If they isolate timing/trust/priority and then ask for a short review, you may say: "If it is actually quick and I am not committing to anything, I can look."
- Do not end the call immediately after one decent isolation question. Give them a chance to use the answer.

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
- You remember receiving a site/preview or information about improving your online presence.
- You glanced at it but did not dig in or make a decision.
- You are guarded and reluctant, but not hostile.
- You are not confused about why they want a meeting. You know the meeting is to review what was sent and decide if it is worth doing anything with.

HOW TO RESPOND:
- Keep replies short, natural, and business-owner-like.
- Do not say "How can I assist you today?" after the opening.
- Do not claim the applicant is busy.
- Do not volunteer a meeting.
- If they only ask whether you got the info, say: "I glanced at it, but I have not really had time to do anything with it."
- If they ask what is stopping you, say: "I am not sure it is worth changing anything right now."
- If they ask to follow up later without isolating the issue, say: "Maybe, but our schedule is packed right now."
- Only agree to an appointment if the applicant re-establishes context, isolates what is stopping you, and asks for a specific review time.
${earnedAgreementGuidance}
${realisticDialogueGuidance}
${salesAdvisorRealismGuidance}
${skillScreeningGuidance}
${fairRampGuidance}

SCENARIO-SPECIFIC CALIBRATION:
- A strong setter should re-establish context, ask what you thought of what was sent, and isolate what stopped you from moving forward.
- If they uncover a real concern and ask for a concrete review time with the owner/closer, you can agree.
- If they just ask whether you received the information or ask when to follow up again, keep stalling.
- Rotate realistic follow-up concerns instead of repeating one stall: "I glanced at it but did not dig in", "I am not sure what I am supposed to compare it to", "We have been busy with jobs", "I do not want to get pulled into a long pitch", or "I would need a clear reason to spend time on it."
- If the applicant starts as if this is a fresh cold call, remind them lightly: "I remember you sent something over. I just have not really done anything with it."
- If they mention the site/preview without much context, stay grounded in the follow-up: "Right, I remember the preview. I just have not seen why it should be a priority."
- If they ask what stopped you from reviewing it, answer: "Nothing dramatic. It just did not feel urgent."
- If they tie the follow-up back to the exact thing sent and ask for a short review time, you can say: "Okay, if you are just walking me through what you sent, I can give you a few minutes."
- If they ask a decent but imperfect question like "What made it not urgent?" answer plainly and give them a chance: "I guess I did not see what would change for us if we looked at it."
- If they then connect the review to a low-pressure look at the already-prepared preview and ask for a time, agree cautiously.

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

function applicantLines(transcript) {
  return String(transcript || '')
    .split('\\n')
    .filter((line) => /^\\s*Applicant\\s*:/i.test(line))
    .map((line) => line.replace(/^\\s*Applicant\\s*:\\s*/i, '').trim())
    .filter(Boolean);
}

function capScore(current, cap, reason, review) {
  if (!Number.isFinite(current)) return current;
  if (!review.disqualifying_signals) review.disqualifying_signals = [];
  if (!review.concerns) review.concerns = [];
  if (!review.disqualifying_signals.includes(reason)) review.disqualifying_signals.push(reason);
  if (!review.concerns.includes(reason)) review.concerns.push(reason);
  return Math.min(current, cap);
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
        content: 'You are a strict but fair appointment-setter hiring evaluator using a sales-advisor rubric informed by NEPQ, No Resistance Sales, Josh Lyons discovery depth, and practical B2B appointment setting. Score only the applicant behavior in the transcript. Do not reward mere politeness, agreeing, or generic follow-up. A trained setter should lower resistance, listen, identify the true objection under the brush-off, ask concise truth-seeking questions, respectfully challenge avoidance, and ask for a concrete appointment/review next step. Penalize presentation-before-discovery: long website/marketing pitches, generic claims about more bookings, or telling the owner what they need before learning anything. Penalize accepting stalls such as "send me information", "let me think about it", "we get referrals", or "we are not interested" at face value. Penalize info-dumping, over-explaining, arguing, sounding needy, no attempt beyond the first brush-off, and ending with vague follow-up. Give partial credit for trainable instincts: a calm acknowledgement plus one specific isolation question, a relevant referral/priority reframe, or a specific short review ask should score above total collapse even if the call does not convert. If a call ends early by silence timeout, customer-ended-call, unknown, or client disconnect before the applicant handles the second objection or asks for a concrete next step, treat that as a major control/listening failure and normally score it below 45. Do not give a strong score to a short call just because the applicant sounded pleasant. Return only valid JSON.'
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
              'Pitching website, Google, rankings, reviews, or bookings before asking useful discovery questions.',
              'Making generic claims like "this will get you more bookings" without evidence from the owner.',
              'Asking for email, number, callback, or permission to send details as the main next step.',
              'Arguing with the prospect instead of leading calmly.',
              'Only one applicant response followed by silence or hangup.',
              'The applicant lets the call die after the prospect gives a second objection.'
            ],
            call_control_caps: [
              'No captured applicant speech: score 0.',
              'Applicant speech captured but no answer to the prospect follow-up/second objection: cap at 35.',
              'Silence timeout/customer-ended/unknown under 60 seconds with no specific appointment ask: cap at 40.',
              'Long pitch or info dump before discovery: cap at 58.',
              'Generic marketing/website pitch with fewer than two useful questions: cap at 55.',
              'Offering to send info, get email/number, call back, or follow up without a concrete appointment ask: cap at 45.',
              'Two or more applicant turns without any useful discovery or objection-isolation question: cap at 52.',
              'No concrete appointment/review-time ask anywhere in the transcript: cap at 60.',
              'Appointment booked without isolating the real objection: usually 45-65, not an automatic pass.'
            ],
            score_anchors: [
              '0-25: no usable response, silence, confusion, or pure acceptance of the brush-off.',
              '26-40: polite but weak; accepts stall, asks for email/callback, or gives generic pitch with little control.',
              '41-55: trainable; asks at least one relevant isolation/discovery question but fails to use the answer or asks for vague follow-up.',
              '56-70: decent; acknowledges, isolates a real concern, makes a relevant reframe, and asks for a concrete review/appointment, but lacks polish or depth.',
              '71-84: strong; calm control, good listening, sharp objection isolation, grounded reframe, specific next step.',
              '85-100: exceptional for this mock; concise, natural, flexible, earns agreement without pressure.'
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
  const applicantTurns = applicantLines(transcript);
  const applicantText = applicantTurns.join(' ').toLowerCase();
  const questionCount = (applicantText.match(/\\?/g) || []).length;
  const appointmentAsk = /\\b(appointment|schedule|book|calendar|meeting|review|quick look|take a look|walk you through|show you|tomorrow|today|morning|afternoon|\\b\\d{1,2}\\s?(am|pm)\\b)\\b/i.test(applicantText);
  const infoEscape = /\\b(send|shoot|email|text)\\b.{0,35}\\b(info|information|details|link|message|email)\\b|\\bfollow\\s*-?up\\b|\\bcall you back\\b|\\bbest email\\b|\\bbest number\\b/i.test(applicantText);
  const genericPitch = /\\b(website|google|rank|bookings|more customers|more clients|game changer|reviews|template|business grow|new generation)\\b/i.test(applicantText) && questionCount < 2;
  const longApplicantTurn = applicantTurns.some((line) => line.split(/\\s+/).filter(Boolean).length >= 90);
  const discoveryLanguage = /\\b(what do you mean|what makes you|how are you|how do you|get customers|where.*customers|what stopped|what part|timing|priority|concern|worth your time|referrals|look you up|before calling|current|right now|compare|why haven't|why have you not|what are you using|how long|what would you change)\\b/i.test(applicantText);
  if (backendScore !== null) {
    if (longApplicantTurn) backendScore = capScore(backendScore, 58, 'Applicant monologued or info-dumped instead of keeping the owner engaged.', aiReview);
    if (genericPitch) backendScore = capScore(backendScore, 55, 'Applicant pitched generic website/marketing benefits before doing discovery.', aiReview);
    if (infoEscape && !appointmentAsk) backendScore = capScore(backendScore, 45, 'Applicant accepted the escape hatch by offering information, email, callback, or vague follow-up instead of setting a review time.', aiReview);
    if (!discoveryLanguage && applicantTurns.length >= 2) backendScore = capScore(backendScore, 52, 'Applicant did not ask useful discovery or objection-isolation questions.', aiReview);
    if (/max duration/i.test(endedReason || '') && !appointmentAsk) backendScore = capScore(backendScore, 48, 'Call hit max duration without a concrete appointment or review-time ask.', aiReview);
    if (appointmentAsk && !discoveryLanguage) backendScore = capScore(backendScore, 65, 'Applicant asked for a meeting without isolating the real objection first.', aiReview);
    aiReview.overall_score = backendScore;
    if (backendScore < 50) aiReview.recommendation = 'poor_fit';
    else if (backendScore < 75 && aiReview.recommendation === 'strong_fit') aiReview.recommendation = 'manual_review';
  }
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
        voice: {
          provider: "11labs",
          voiceId: "8sGzMkj2HZn6rYwGx6G0",
          speed: 0.89
        },
        serverUrl: webhookUrl,
        serverMessages: ["end-of-call-report", "status-update", "conversation-update", "hang"],
        endCallMessage: "I have to jump. Take care.",
        endCallPhrases: [
          "I have to jump. Take care.",
          "I need to jump. Take care.",
          "I am going to pass for now. Take care.",
          "I think we are going in circles, so I am going to pass for now. Take care.",
          "You can send it if you want, but I have to jump. Take care.",
          "We are probably fine for now. Thanks for reaching out."
        ],
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
