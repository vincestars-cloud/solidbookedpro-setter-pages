import fs from "node:fs";

const projectRef = "xxxmrbrwucsqeqbmwggd";
const tokenMemory = fs.readFileSync("/Users/vincentohasiligwo/claude-memory-sync/reference_supabase_mgmt_token.md", "utf8");
const token = tokenMemory.match(/Token: `([^`]+)`/)?.[1];

if (!token) throw new Error("Supabase management token not found.");

const query = `
with scoring as (
  select
    a.id,
    coalesce(a.ai_application_score, 0) as ai_score,
    coalesce((
      select avg(me.percentage_consumed) filter (where me.started = true or me.seconds_consumed > 0 or me.percentage_consumed > 0)
      from public.sbp_setter_media_engagement me
      where me.applicant_id = a.id and me.media_type = 'call_recording'
    ), 0) as call_avg,
    coalesce((
      select count(*) filter (where me.started = true or me.seconds_consumed > 0 or me.percentage_consumed > 0)
      from public.sbp_setter_media_engagement me
      where me.applicant_id = a.id and me.media_type = 'call_recording'
    ), 0) as call_opened,
    coalesce((select avg(m.backend_score) filter (where m.backend_score is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0) as mock_avg,
    coalesce((select max(m.backend_score) filter (where m.backend_score is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0) as mock_max,
    coalesce((select count(*) filter (where m.backend_score is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0) as mock_scored,
    coalesce((select count(*) filter (where m.status = 'completed' or m.vapi_call_id is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0) as completed_calls,
    case
      when coalesce((select count(*) filter (where m.status = 'completed' or m.vapi_call_id is not null) from public.sbp_setter_mock_calls m where m.applicant_id = a.id), 0) >= 3
        then array_remove(array_remove(coalesce(a.hard_flags, array[]::text[]), 'availability_outside_required_window'), 'mock_calls_incomplete')
      else array_remove(coalesce(a.hard_flags, array[]::text[]), 'availability_outside_required_window')
    end as hard_flags
  from public.sbp_setter_applicants a
  where a.application_status = 'application_completed'
),
computed as (
  select
    id,
    greatest(0, least(70, ai_score))
      + case when call_avg >= 75 or call_opened >= 3 then 10 when call_avg >= 40 or call_opened >= 2 then 6 when call_opened >= 1 then 3 else 0 end
      + case when mock_scored > 0 then case when mock_avg >= 85 then 20 when mock_avg >= 75 then 16 when mock_avg >= 65 then 10 when mock_avg >= 55 then 5 else 0 end else 0 end as score,
    mock_avg,
    mock_max,
    mock_scored,
    completed_calls,
    hard_flags
  from scoring
),
updated as (
  update public.sbp_setter_applicants a
  set
    internal_score = c.score,
    qualification_status = case
      when array_length(c.hard_flags, 1) is not null then 'not_qualified'
      when c.score >= 75 and c.completed_calls = 3 and (c.mock_avg >= 45 or c.mock_max >= 60) then 'qualified'
      else 'manual_review'
    end,
    interview_status = case
      when c.score >= 75 and c.completed_calls = 3 and (c.mock_avg >= 45 or c.mock_max >= 60) and array_length(c.hard_flags, 1) is null then 'displayed'
      else 'not_displayed'
    end,
    hard_flags = c.hard_flags,
    updated_at = now()
  from computed c
  where a.id = c.id
  returning a.id, a.full_name, a.normalized_email, a.internal_score, a.qualification_status, a.interview_status
)
insert into public.sbp_setter_application_events (applicant_id, event_type, step, metadata)
select id, 'qualification_recalculated', 4, jsonb_build_object('internalScore', internal_score, 'status', qualification_status, 'source', 'retroactive_live_audit')
from updated
returning applicant_id, metadata;
`;

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ query })
});

const text = await response.text();
console.log(text);
if (!response.ok) process.exit(1);
