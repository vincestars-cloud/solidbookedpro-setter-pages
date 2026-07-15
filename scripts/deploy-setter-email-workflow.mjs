import fs from "node:fs";

const workflowName = "SolidBooked Pro - Setter Outbound Emails";
const webhookPath = "solidbooked-setter-outbound-email";
const webhookUrl = `https://n8n.americanlifeteam.com/webhook/${webhookPath}`;
const root = new URL("..", import.meta.url);
const n8nSkill = fs.readFileSync("/Users/vincentohasiligwo/.openclaw/workspace-otto/skills/n8n-api/SKILL.md", "utf8");
const n8nKey = n8nSkill.match(/N8N_KEY="([^"]+)/)?.[1];
const adminToken = process.env.SETTER_ADMIN_TOKEN || "scalingsos2026";

if (!n8nKey) throw new Error("n8n public API key not found.");

const normalizeCode = `
const body = $input.first().json.body || $input.first().json || {};
const ADMIN_TOKEN = ${JSON.stringify(adminToken)};
const calendarUrl = body.calendarUrl || 'https://calendar.app.google/gbRS4eD65Qw1W8bo8';
const type = String(body.type || '').trim();
const email = String(body.email || body.normalized_email || '').trim().toLowerCase();
const name = String(body.name || body.fullName || body.preferredName || '').trim();
const firstName = name.split(/\\s+/).filter(Boolean)[0] || 'there';

if (body.token !== ADMIN_TOKEN) throw new Error('Unauthorized setter email request.');
if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) throw new Error('Valid recipient email is required.');

if (type === 'bad_fit_rejection') {
  return [{
    json: {
      email,
      subject: 'SolidBooked Pro Appointment Setter Application',
      message: \`Hi \${firstName},

Thank you for taking the time to complete the SolidBooked Pro appointment setter application.

After reviewing your submission, we are not moving forward at this time.

We appreciate your interest and wish you the best in your search.

SolidBooked Pro\`,
      type
    }
  }];
}

if (type === 'manual_interview_request') {
  return [{
    json: {
      email,
      subject: 'Schedule your SolidBooked Pro interview',
      message: \`Hi \${firstName},

Thank you for completing the SolidBooked Pro appointment setter application.

We reviewed your submission and would like you to schedule an interview here:
\${calendarUrl}

Please choose a time that works for you.

SolidBooked Pro\`,
      type
    }
  }];
}

throw new Error('Unsupported setter email type: ' + type);
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
      name: "Setter Email Webhook",
      webhookId: "solidbooked-setter-outbound-email"
    },
    {
      parameters: { jsCode: normalizeCode },
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [300, 0],
      name: "Normalize Email Request"
    },
    {
      parameters: {
        sendTo: "={{ $json.email }}",
        subject: "={{ $json.subject }}",
        emailType: "text",
        message: "={{ $json.message }}",
        options: {
          appendAttribution: false
        }
      },
      type: "n8n-nodes-base.gmail",
      typeVersion: 2.2,
      position: [620, 0],
      name: "Send Gmail",
      credentials: {
        gmailOAuth2: {
          id: "KHnMC4KTVIDbmHD5",
          name: "Gmail - angela.starks13"
        }
      }
    }
  ],
  connections: {
    "Setter Email Webhook": {
      main: [[{ node: "Normalize Email Request", type: "main", index: 0 }]]
    },
    "Normalize Email Request": {
      main: [[{ node: "Send Gmail", type: "main", index: 0 }]]
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
