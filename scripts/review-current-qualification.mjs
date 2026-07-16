import fs from "node:fs";

const projectRef = "xxxmrbrwucsqeqbmwggd";
const tokenMemory = fs.readFileSync("/Users/vincentohasiligwo/claude-memory-sync/reference_supabase_mgmt_token.md", "utf8");
const token = tokenMemory.match(/Token: `([^`]+)`/)?.[1];

if (!token) throw new Error("Supabase management token not found.");

async function runQuery(label, query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({ query })
  });

  const text = await response.text();
  console.log(`\n## ${label}`);
  console.log(text);
  if (!response.ok) process.exit(1);
}

await runQuery("Completed applicants", `
select
  a.full_name,
  a.normalized_email,
  a.internal_score,
  a.ai_application_score,
  a.resume_score,
  a.qualification_status,
  a.interview_status,
  a.hard_flags,
  coalesce((select avg(m.backend_score) filter (where m.backend_score is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0)::int as mock_avg,
  coalesce((select max(m.backend_score) filter (where m.backend_score is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0)::int as mock_max,
  coalesce((select count(*) filter (where m.status = 'completed' or m.vapi_call_id is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0) as completed_calls,
  coalesce((select round(sum(least(100, greatest(0, me.percentage_consumed))) / 3.0)::integer from public.sbp_setter_media_engagement me where me.applicant_id = a.id and me.media_type = 'call_recording'), 0) as call_library_avg_of_3,
  a.submitted_at
from public.sbp_setter_applicants a
where a.application_status = 'application_completed'
order by
  case a.qualification_status when 'qualified' then 0 when 'manual_review' then 1 else 2 end,
  a.internal_score desc nulls last,
  a.submitted_at desc nulls last;
`);

await runQuery("Mock-call review", `
select
  a.full_name,
  a.normalized_email,
  m.mock_call_number,
  m.backend_score,
  m.duration_seconds,
  m.ended_reason,
  m.summary,
  m.structured_output->>'objection_moment_score' as objection_moment_score,
  m.structured_output->>'applicant_reply' as applicant_reply,
  m.structured_output->>'ai_judge_note' as ai_judge_note,
  m.recording_url
from public.sbp_setter_mock_calls m
join public.sbp_setter_applicants a on a.id = m.applicant_id
where a.application_status = 'application_completed'
order by a.internal_score desc nulls last, a.submitted_at desc nulls last, m.mock_call_number;
`);
