create or replace function public.sbp_setter_time_minutes(value text)
returns integer
language sql
immutable
as $$
  select case
    when value ~ '^[0-2][0-9]:[0-5][0-9]$'
      and split_part(value, ':', 1)::integer between 0 and 23
    then split_part(value, ':', 1)::integer * 60 + split_part(value, ':', 2)::integer
    else null
  end
$$;

alter table public.sbp_setter_applicants
  add column if not exists resume_file_type text,
  add column if not exists resume_uploaded_at timestamptz,
  add column if not exists location_city text,
  add column if not exists location_region text,
  add column if not exists location_country text,
  add column if not exists location_timezone text,
  add column if not exists location_metadata jsonb;

create table if not exists public.sbp_setter_resume_files (
  applicant_id uuid primary key references public.sbp_setter_applicants(id) on delete cascade,
  file_name text not null,
  file_type text not null,
  file_size integer not null,
  file_base64 text not null,
  uploaded_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sbp_setter_resume_files enable row level security;

create or replace function public.sbp_setter_status_from_step(step_value integer)
returns text
language sql
immutable
as $$
  select case
    when step_value >= 4 then 'mock_calls_in_progress'
    when step_value = 3 then 'step_3_complete'
    when step_value = 2 then 'step_2_complete'
    when step_value = 1 then 'step_1_complete'
    else 'started'
  end
$$;

create or replace function public.sbp_setter_apply_state(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  applicant_uuid uuid;
  fields jsonb := coalesce(payload->'fields', '{}'::jsonb);
  location jsonb := coalesce(payload->'location', '{}'::jsonb);
  item jsonb;
  current_step_value integer := coalesce(nullif(payload->>'currentStep', '')::integer, 1);
  highest_step_value integer := coalesce(nullif(payload->>'highestStep', '')::integer, current_step_value);
begin
  applicant_uuid := nullif(payload->>'applicantId', '')::uuid;

  update public.sbp_setter_applicants
  set
    full_name = case when fields ? 'fullName' then nullif(fields->>'fullName', '') else full_name end,
    preferred_name = case when fields ? 'preferredName' then nullif(fields->>'preferredName', '') else preferred_name end,
    normalized_email = case when fields ? 'email' then lower(trim(fields->>'email')) else normalized_email end,
    country = case when fields ? 'country' then nullif(fields->>'country', '') else country end,
    desired_hourly_pay = case
      when fields ? 'desiredHourly' and nullif(fields->>'desiredHourly', '') is not null then (fields->>'desiredHourly')::numeric
      else desired_hourly_pay
    end,
    earliest_start_date = case
      when fields ? 'earliestStartDate' and nullif(fields->>'earliestStartDate', '') is not null then (fields->>'earliestStartDate')::date
      else earliest_start_date
    end,
    availability_est = case
      when fields ? 'availableStart' or fields ? 'availableEnd' then jsonb_build_object('start', fields->>'availableStart', 'end', fields->>'availableEnd')
      else availability_est
    end,
    vocaroo_url = case when fields ? 'vocarooUrl' then nullif(fields->>'vocarooUrl', '') else vocaroo_url end,
    crm_platforms = case when fields ? 'crmPlatforms' then nullif(fields->>'crmPlatforms', '') else crm_platforms end,
    appointment_setting_experience = case when fields ? 'appointmentSettingExperience' then nullif(fields->>'appointmentSettingExperience', '') else appointment_setting_experience end,
    industries = case when fields ? 'industries' then nullif(fields->>'industries', '') else industries end,
    past_metrics = case when fields ? 'pastMetrics' then nullif(fields->>'pastMetrics', '') else past_metrics end,
    resume_file_name = case when fields ? 'resumeFileName' then nullif(fields->>'resumeFileName', '') else resume_file_name end,
    resume_file_size = case
      when fields ? 'resumeFileSize' and nullif(fields->>'resumeFileSize', '') is not null then (fields->>'resumeFileSize')::integer
      else resume_file_size
    end,
    resume_file_type = case when fields ? 'resumeFileType' then nullif(fields->>'resumeFileType', '') else resume_file_type end,
    location_city = case when location ? 'city' then nullif(location->>'city', '') else location_city end,
    location_region = case when location ? 'region' then nullif(location->>'region', '') else location_region end,
    location_country = case when location ? 'country' then nullif(location->>'country', '') else location_country end,
    location_timezone = case when location ? 'timezone' then nullif(location->>'timezone', '') else location_timezone end,
    location_metadata = case when location <> '{}'::jsonb then location else location_metadata end,
    current_step = current_step_value,
    application_status = public.sbp_setter_status_from_step(highest_step_value),
    abandoned_at_step = current_step_value,
    updated_at = now()
  where id = applicant_uuid;

  for item in select * from jsonb_array_elements(coalesce(payload->'callLibrary', '[]'::jsonb))
  loop
    insert into public.sbp_setter_media_engagement (
      applicant_id,
      media_type,
      media_key,
      started,
      seconds_consumed,
      percentage_consumed,
      completed,
      replay_count,
      pause_count,
      updated_at
    )
    values (
      applicant_uuid,
      item->>'mediaType',
      item->>'mediaKey',
      coalesce((item->>'started')::boolean, false),
      coalesce(nullif(item->>'secondsConsumed', '')::numeric::integer, 0),
      coalesce(nullif(item->>'percentageConsumed', '')::numeric::integer, 0),
      coalesce((item->>'completed')::boolean, false),
      coalesce(nullif(item->>'replayCount', '')::numeric::integer, 0),
      coalesce(nullif(item->>'pauseCount', '')::numeric::integer, 0),
      now()
    )
    on conflict (applicant_id, media_type, media_key)
    do update set
      started = excluded.started,
      seconds_consumed = excluded.seconds_consumed,
      percentage_consumed = excluded.percentage_consumed,
      completed = excluded.completed,
      replay_count = excluded.replay_count,
      pause_count = excluded.pause_count,
      updated_at = now();
  end loop;

  for item in select * from jsonb_array_elements(coalesce(payload->'scenarios', '[]'::jsonb))
  loop
    insert into public.sbp_setter_scenario_responses (applicant_id, question_key, response, updated_at)
    values (applicant_uuid, item->>'questionKey', coalesce(item->>'response', ''), now())
    on conflict (applicant_id, question_key)
    do update set response = excluded.response, updated_at = now();
  end loop;

  for item in select * from jsonb_array_elements(coalesce(payload->'mockCalls', '[]'::jsonb))
  loop
    insert into public.sbp_setter_mock_calls (
      applicant_id,
      mock_call_number,
      vapi_call_id,
      status,
      started_at,
      ended_at,
      duration_seconds,
      ended_reason,
      updated_at
    )
    values (
      applicant_uuid,
      (item->>'mockCallNumber')::integer,
      nullif(item->>'vapiCallId', ''),
      coalesce(item->>'status', 'not_started'),
      nullif(item->>'startedAt', '')::timestamptz,
      nullif(item->>'endedAt', '')::timestamptz,
      nullif(item->>'durationSeconds', '')::numeric::integer,
      nullif(item->>'endedReason', ''),
      now()
    )
    on conflict (applicant_id, mock_call_number)
    do update set
      vapi_call_id = coalesce(excluded.vapi_call_id, public.sbp_setter_mock_calls.vapi_call_id),
      status = excluded.status,
      started_at = coalesce(excluded.started_at, public.sbp_setter_mock_calls.started_at),
      ended_at = coalesce(excluded.ended_at, public.sbp_setter_mock_calls.ended_at),
      duration_seconds = coalesce(excluded.duration_seconds, public.sbp_setter_mock_calls.duration_seconds),
      ended_reason = coalesce(excluded.ended_reason, public.sbp_setter_mock_calls.ended_reason),
      updated_at = now();
  end loop;

  return applicant_uuid;
end
$$;

create or replace function public.sbp_setter_bridge(req jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  action text := coalesce(req->>'action', '');
  payload jsonb := coalesce(req->'payload', '{}'::jsonb);
  applicant public.sbp_setter_applicants%rowtype;
  applicant_uuid uuid;
  email_norm text;
  duplicate_exists boolean;
  duplicate_message text := 'An application has already been started or submitted using this email address. Please use the same device to continue, or contact us if you need assistance.';
  admin_password text := 'scalingsos2026';
  completed_calls integer := 0;
  hard_flags_arr text[] := array[]::text[];
  score integer := 0;
  result_status text := 'manual_review';
  fields jsonb;
  available_start text;
  available_end text;
  overlap_hours numeric := 0;
  start_minutes integer;
  end_minutes integer;
  office_start integer := public.sbp_setter_time_minutes('09:00');
  office_end integer := public.sbp_setter_time_minutes('17:00');
  rows_json jsonb;
  patch jsonb;
  file_name text;
  file_type text;
  file_size integer;
  file_base64 text;
  resume_row public.sbp_setter_resume_files%rowtype;
  previous_hiring_stage text;
begin
  if action = 'health' then
    return jsonb_build_object('ok', true, 'service', 'sbp_setter_bridge');
  end if;

  if action = 'session' then
    email_norm := lower(trim(payload->>'email'));
    if email_norm is null or email_norm = '' then
      return jsonb_build_object('ok', false, 'message', 'Valid email is required.');
    end if;

    select *
    into applicant
    from public.sbp_setter_applicants
    where sbp_setter_applicants.normalized_email = email_norm
      and reopened_at is null
    order by created_at desc
    limit 1;

    if found then
      return jsonb_build_object('ok', true, 'duplicate', true, 'applicantId', applicant.id, 'message', duplicate_message);
    end if;

    insert into public.sbp_setter_applicants (
      normalized_email,
      application_status,
      current_step,
      interview_status,
      location_city,
      location_region,
      location_country,
      location_timezone,
      location_metadata
    )
    values (
      email_norm,
      'started',
      1,
      'not_scheduled',
      nullif(payload->'location'->>'city', ''),
      nullif(payload->'location'->>'region', ''),
      nullif(payload->'location'->>'country', ''),
      nullif(payload->'location'->>'timezone', ''),
      nullif(payload->'location', 'null'::jsonb)
    )
    returning * into applicant;

    insert into public.sbp_setter_application_events (applicant_id, event_type, step, metadata)
    values (applicant.id, 'valid_email_entered', 1, jsonb_build_object('email', email_norm));

    return jsonb_build_object('ok', true, 'duplicate', false, 'applicantId', applicant.id);
  end if;

  if action = 'check_email' then
    email_norm := lower(trim(payload->>'email'));
    select exists (
      select 1
      from public.sbp_setter_applicants
      where sbp_setter_applicants.normalized_email = email_norm
        and reopened_at is null
        and (nullif(payload->>'applicantId', '') is null or id::text <> payload->>'applicantId')
    )
    into duplicate_exists;
    return jsonb_build_object('ok', true, 'exists', duplicate_exists, 'message', case when duplicate_exists then duplicate_message else '' end);
  end if;

  if action = 'autosave' then
    applicant_uuid := public.sbp_setter_apply_state(payload);
    insert into public.sbp_setter_application_events (applicant_id, event_type, step, metadata)
    values (applicant_uuid, 'autosave', nullif(payload->>'currentStep', '')::integer, jsonb_build_object('highestStep', payload->>'highestStep'));
    return jsonb_build_object('ok', true, 'applicantId', applicant_uuid, 'savedAt', now());
  end if;

  if action = 'event' then
    insert into public.sbp_setter_application_events (applicant_id, event_type, step, metadata)
    values (
      nullif(payload->>'applicantId', '')::uuid,
      coalesce(payload->>'eventType', 'event'),
      nullif(payload->>'step', '')::integer,
      coalesce(payload->'metadata', '{}'::jsonb)
    );
    return jsonb_build_object('ok', true);
  end if;

  if action = 'resume_upload' then
    applicant_uuid := nullif(payload->>'applicantId', '')::uuid;
    file_name := nullif(payload->>'fileName', '');
    file_type := coalesce(nullif(payload->>'fileType', ''), 'application/octet-stream');
    file_size := coalesce(nullif(payload->>'fileSize', '')::integer, 0);
    file_base64 := nullif(payload->>'fileBase64', '');

    if applicant_uuid is null or file_name is null or file_base64 is null then
      return jsonb_build_object('ok', false, 'message', 'Resume upload is missing required data.');
    end if;
    if file_size <= 0 or file_size > 5000000 then
      return jsonb_build_object('ok', false, 'message', 'Resume must be 5 MB or smaller.');
    end if;
    if file_type not in (
      'application/pdf',
      'image/png',
      'image/jpeg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) then
      return jsonb_build_object('ok', false, 'message', 'Upload a PDF, DOC, DOCX, PNG, or JPG resume.');
    end if;

    insert into public.sbp_setter_resume_files (applicant_id, file_name, file_type, file_size, file_base64, uploaded_at, updated_at)
    values (applicant_uuid, file_name, file_type, file_size, file_base64, now(), now())
    on conflict (applicant_id)
    do update set
      file_name = excluded.file_name,
      file_type = excluded.file_type,
      file_size = excluded.file_size,
      file_base64 = excluded.file_base64,
      updated_at = now()
    returning * into resume_row;

    update public.sbp_setter_applicants
    set
      resume_file_name = file_name,
      resume_file_size = file_size,
      resume_file_type = file_type,
      resume_uploaded_at = resume_row.updated_at,
      updated_at = now()
    where id = applicant_uuid;

    insert into public.sbp_setter_application_events (applicant_id, event_type, metadata)
    values (applicant_uuid, 'resume_uploaded', jsonb_build_object('fileName', file_name, 'fileType', file_type, 'fileSize', file_size));

    return jsonb_build_object('ok', true, 'resume', jsonb_build_object(
      'fileName', file_name,
      'fileType', file_type,
      'fileSize', file_size,
      'uploadedAt', resume_row.updated_at
    ));
  end if;

  if action = 'submit' then
    fields := coalesce(payload->'fields', '{}'::jsonb);
    applicant_uuid := nullif(payload->>'applicantId', '')::uuid;
    email_norm := lower(trim(fields->>'email'));

    select exists (
      select 1
      from public.sbp_setter_applicants
      where sbp_setter_applicants.normalized_email = email_norm
        and reopened_at is null
        and id <> applicant_uuid
    )
    into duplicate_exists;

    if duplicate_exists then
      return jsonb_build_object('ok', false, 'status', 'manual_review', 'message', duplicate_message);
    end if;

    perform public.sbp_setter_apply_state(payload);

    select count(*)
    into completed_calls
    from public.sbp_setter_mock_calls
    where applicant_id = applicant_uuid and status = 'completed';

    available_start := fields->>'availableStart';
    available_end := fields->>'availableEnd';
    start_minutes := public.sbp_setter_time_minutes(available_start);
    end_minutes := public.sbp_setter_time_minutes(available_end);
    if start_minutes is not null and end_minutes is not null then
      overlap_hours := greatest(0, least(end_minutes, office_end) - greatest(start_minutes, office_start)) / 60.0;
    end if;

    if coalesce((fields->>'accuracyConfirmation')::boolean, false) = false then
      hard_flags_arr := array_append(hard_flags_arr, 'required_acknowledgment_missing');
    end if;
    if nullif(fields->>'fullName', '') is null
      or nullif(fields->>'preferredName', '') is null
      or nullif(fields->>'email', '') is null
      or nullif(fields->>'desiredHourly', '') is null
      or nullif(fields->>'earliestStartDate', '') is null
      or nullif(fields->>'availableStart', '') is null
      or nullif(fields->>'availableEnd', '') is null
      or nullif(fields->>'vocarooUrl', '') is null
      or nullif(fields->>'crmPlatforms', '') is null
      or nullif(fields->>'appointmentSettingExperience', '') is null
      or nullif(fields->>'industries', '') is null
      or nullif(fields->>'pastMetrics', '') is null then
      hard_flags_arr := array_append(hard_flags_arr, 'required_answers_missing');
    end if;
    if coalesce(fields->>'email', '') !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
      hard_flags_arr := array_append(hard_flags_arr, 'invalid_email');
    end if;
    if coalesce(fields->>'vocarooUrl', '') !~* '^https?://(www\.)?(voca\.ro|vocaroo\.com)/' then
      hard_flags_arr := array_append(hard_flags_arr, 'invalid_vocaroo_url');
    end if;
    if completed_calls < 1 then
      hard_flags_arr := array_append(hard_flags_arr, 'microphone_not_confirmed');
    end if;
    if completed_calls < 3 then
      hard_flags_arr := array_append(hard_flags_arr, 'mock_calls_incomplete');
    end if;
    if coalesce(nullif(fields->>'desiredHourly', '')::numeric, 0) > 8 then
      hard_flags_arr := array_append(hard_flags_arr, 'pay_expectation_above_range');
    end if;
    if nullif(fields->>'earliestStartDate', '') is null or (fields->>'earliestStartDate')::date < current_date then
      hard_flags_arr := array_append(hard_flags_arr, 'start_date_not_acceptable');
    end if;
    if overlap_hours < 5 then
      hard_flags_arr := array_append(hard_flags_arr, 'availability_outside_required_window');
    end if;

    if coalesce(fields->>'pastMetrics', '') ~ '\d' then score := score + 18; end if;
    if length(coalesce(fields->>'appointmentSettingExperience', '')) >= 160 then score := score + 18; end if;
    if length(coalesce(fields->>'crmPlatforms', '')) >= 8 then score := score + 8; end if;
    if length(coalesce(fields->>'industries', '')) >= 6 then score := score + 6; end if;
    if coalesce(nullif(fields->>'desiredHourly', '')::numeric, 999) <= 8 then score := score + 12; end if;
    if overlap_hours >= 5 then score := score + 10; end if;
    if completed_calls = 3 then score := score + 6; end if;

    if array_length(hard_flags_arr, 1) is not null then
      result_status := 'not_qualified';
    elsif score >= 70 then
      result_status := 'qualified';
    else
      result_status := 'manual_review';
    end if;

    update public.sbp_setter_applicants
    set
      application_status = 'application_completed',
      qualification_status = result_status,
      internal_score = score,
      hard_flags = hard_flags_arr,
      submitted_at = now(),
      total_completion_seconds = null,
      current_step = 4,
      abandoned_at_step = null,
      updated_at = now()
    where id = applicant_uuid
    returning * into applicant;

    insert into public.sbp_setter_application_events (applicant_id, event_type, step, metadata)
    values
      (applicant_uuid, 'qualification_result', 4, jsonb_build_object('status', result_status, 'internalScore', score, 'hardFlags', hard_flags_arr)),
      (applicant_uuid, 'application_submitted', 4, jsonb_build_object('status', result_status));

    return jsonb_build_object(
      'ok', true,
      'applicantId', applicant_uuid,
      'status', result_status,
      'applicationStatus', applicant.application_status,
      'calendar', case when result_status = 'qualified' then jsonb_build_object(
        'provider', 'google_calendar',
        'embedUrl', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2c0u01gGhjxCaT7LyovBofGNWBAxhG5JSKa2-5LZrQc4kUX5guVGhqKhXD6N2GC4qFkVIpVwYS?gv=true',
        'externalUrl', 'https://calendar.google.com/calendar/appointments/schedules/AcZssZ2c0u01gGhjxCaT7LyovBofGNWBAxhG5JSKa2-5LZrQc4kUX5guVGhqKhXD6N2GC4qFkVIpVwYS?gv=true'
      ) else null end,
      'message', case
        when result_status = 'qualified' then 'Congratulations - based on your application, you seem to be a strong potential fit for the role.'
        else 'Thank you for completing your application. We will review your submission and contact you if we decide to move forward.'
      end
    );
  end if;

  if action in ('admin_list', 'admin_detail', 'admin_status', 'admin_note', 'admin_resume', 'vapi_report') then
    if coalesce(payload->>'token', '') <> admin_password then
      return jsonb_build_object('ok', false, 'message', 'Enter the admin password to view applicants.');
    end if;
  end if;

  if action = 'admin_list' then
    select coalesce(jsonb_agg(to_jsonb(a) || jsonb_build_object(
      'mock_calls_completed', coalesce(mc.completed_count, 0),
      'mock_average_score', coalesce(mc.average_score, a.internal_score),
      'mock_scored_calls', coalesce(mc.scored_count, 0)
    ) order by coalesce(mc.average_score, a.internal_score, 0) desc, a.started_at desc), '[]'::jsonb)
    into rows_json
    from public.sbp_setter_applicants a
    left join (
      select
        applicant_id,
        count(*) filter (where status = 'completed') as completed_count,
        round(avg(backend_score) filter (where backend_score is not null))::integer as average_score,
        count(*) filter (where backend_score is not null) as scored_count
      from public.sbp_setter_mock_calls
      group by applicant_id
    ) mc on mc.applicant_id = a.id;
    return jsonb_build_object('ok', true, 'applicants', rows_json);
  end if;

  if action = 'admin_detail' then
    applicant_uuid := nullif(payload->>'id', '')::uuid;
    select * into applicant from public.sbp_setter_applicants where id = applicant_uuid;
    return jsonb_build_object(
      'ok', true,
      'applicant', to_jsonb(applicant),
      'events', coalesce((select jsonb_agg(to_jsonb(e) order by e.occurred_at desc) from public.sbp_setter_application_events e where e.applicant_id = applicant_uuid), '[]'::jsonb),
      'media', coalesce((select jsonb_agg(to_jsonb(m) order by m.updated_at desc) from public.sbp_setter_media_engagement m where m.applicant_id = applicant_uuid), '[]'::jsonb),
      'mockCalls', coalesce((select jsonb_agg(to_jsonb(c) order by c.mock_call_number) from public.sbp_setter_mock_calls c where c.applicant_id = applicant_uuid), '[]'::jsonb),
      'scenarios', coalesce((select jsonb_agg(to_jsonb(s) order by s.question_key) from public.sbp_setter_scenario_responses s where s.applicant_id = applicant_uuid), '[]'::jsonb),
      'notes', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from public.sbp_setter_admin_notes n where n.applicant_id = applicant_uuid), '[]'::jsonb)
    );
  end if;

  if action = 'admin_resume' then
    applicant_uuid := nullif(payload->>'id', '')::uuid;
    select * into resume_row from public.sbp_setter_resume_files where applicant_id = applicant_uuid;
    if not found then
      return jsonb_build_object('ok', false, 'message', 'No resume file is stored for this applicant.');
    end if;
    return jsonb_build_object(
      'ok', true,
      'resume', jsonb_build_object(
        'fileName', resume_row.file_name,
        'fileType', resume_row.file_type,
        'fileSize', resume_row.file_size,
        'fileBase64', resume_row.file_base64,
        'uploadedAt', resume_row.updated_at
      )
    );
  end if;

  if action = 'admin_status' then
    applicant_uuid := nullif(payload->>'id', '')::uuid;
    patch := coalesce(payload->'patch', '{}'::jsonb);
    select hiring_stage_status into previous_hiring_stage from public.sbp_setter_applicants where id = applicant_uuid;
    update public.sbp_setter_applicants
    set
      qualification_status = case
        when coalesce((patch->>'reopen')::boolean, false) then 'manual_review'
        when patch ? 'qualificationStatus' then patch->>'qualificationStatus'
        else qualification_status
      end,
      application_status = case
        when coalesce((patch->>'reopen')::boolean, false) then 'started'
        when patch ? 'applicationStatus' then patch->>'applicationStatus'
        else application_status
      end,
      interview_status = case
        when patch ? 'interviewStatus' then patch->>'interviewStatus'
        else interview_status
      end,
      hiring_stage_status = case
        when patch ? 'hiringStageStatus' then nullif(patch->>'hiringStageStatus', '')
        else hiring_stage_status
      end,
      reopened_at = case when coalesce((patch->>'reopen')::boolean, false) then now() else reopened_at end,
      submitted_at = case when coalesce((patch->>'reopen')::boolean, false) then null else submitted_at end,
      updated_at = now()
    where id = applicant_uuid
    returning * into applicant;
    insert into public.sbp_setter_application_events (applicant_id, event_type, metadata)
    values (applicant_uuid, 'admin_status_changed', patch);
    if patch ? 'hiringStageStatus'
      and nullif(patch->>'hiringStageStatus', '') = 'bad_fit'
      and coalesce(previous_hiring_stage, '') <> 'bad_fit' then
      insert into public.sbp_setter_application_events (applicant_id, event_type, metadata)
      values (
        applicant_uuid,
        'rejection_email_requested',
        jsonb_build_object(
          'email', applicant.normalized_email,
          'name', applicant.full_name,
          'source', 'admin_bad_fit_status'
        )
      );
    end if;
    return jsonb_build_object('ok', true, 'applicant', to_jsonb(applicant));
  end if;

  if action = 'vapi_report' then
    applicant_uuid := nullif(coalesce(payload->>'applicantId', payload->>'applicant_id'), '')::uuid;
    insert into public.sbp_setter_mock_calls (
      applicant_id,
      mock_call_number,
      vapi_call_id,
      status,
      started_at,
      ended_at,
      duration_seconds,
      ended_reason,
      transcript,
      recording_url,
      summary,
      structured_output,
      backend_score,
      raw_event_reference,
      updated_at
    )
    values (
      applicant_uuid,
      nullif(coalesce(payload->>'mockCallNumber', payload->>'mock_call_number'), '')::integer,
      nullif(coalesce(payload->>'vapiCallId', payload->>'vapi_call_id', payload->>'callId', payload->>'call_id'), ''),
      coalesce(nullif(payload->>'status', ''), 'completed'),
      nullif(coalesce(payload->>'startedAt', payload->>'started_at'), '')::timestamptz,
      nullif(coalesce(payload->>'endedAt', payload->>'ended_at'), '')::timestamptz,
      nullif(coalesce(payload->>'durationSeconds', payload->>'duration_seconds'), '')::numeric::integer,
      nullif(coalesce(payload->>'endedReason', payload->>'ended_reason'), ''),
      nullif(payload->>'transcript', ''),
      nullif(coalesce(payload->>'recordingUrl', payload->>'recording_url'), ''),
      nullif(payload->>'summary', ''),
      coalesce(payload->'structuredOutput', payload->'structured_output', payload->'analysis', '{}'::jsonb),
      nullif(coalesce(payload->>'backendScore', payload->>'backend_score'), '')::numeric::integer,
      coalesce(payload->'rawEvent', payload->'raw_event', payload - 'token'),
      now()
    )
    on conflict (applicant_id, mock_call_number)
    do update set
      vapi_call_id = coalesce(excluded.vapi_call_id, public.sbp_setter_mock_calls.vapi_call_id),
      status = coalesce(excluded.status, public.sbp_setter_mock_calls.status),
      started_at = coalesce(excluded.started_at, public.sbp_setter_mock_calls.started_at),
      ended_at = coalesce(excluded.ended_at, public.sbp_setter_mock_calls.ended_at),
      duration_seconds = coalesce(excluded.duration_seconds, public.sbp_setter_mock_calls.duration_seconds),
      ended_reason = coalesce(excluded.ended_reason, public.sbp_setter_mock_calls.ended_reason),
      transcript = coalesce(excluded.transcript, public.sbp_setter_mock_calls.transcript),
      recording_url = coalesce(excluded.recording_url, public.sbp_setter_mock_calls.recording_url),
      summary = coalesce(excluded.summary, public.sbp_setter_mock_calls.summary),
      structured_output = case
        when excluded.structured_output = '{}'::jsonb then public.sbp_setter_mock_calls.structured_output
        else excluded.structured_output
      end,
      backend_score = coalesce(excluded.backend_score, public.sbp_setter_mock_calls.backend_score),
      raw_event_reference = coalesce(excluded.raw_event_reference, public.sbp_setter_mock_calls.raw_event_reference),
      updated_at = now();
    insert into public.sbp_setter_application_events (applicant_id, event_type, metadata)
    values (
      applicant_uuid,
      'vapi_end_of_call_report_saved',
      jsonb_build_object(
        'mockCallNumber', nullif(coalesce(payload->>'mockCallNumber', payload->>'mock_call_number'), '')::integer,
        'vapiCallId', nullif(coalesce(payload->>'vapiCallId', payload->>'vapi_call_id', payload->>'callId', payload->>'call_id'), ''),
        'hasTranscript', coalesce(payload->>'transcript', '') <> '',
        'hasRecordingUrl', coalesce(payload->>'recordingUrl', payload->>'recording_url', '') <> ''
      )
    );
    return jsonb_build_object('ok', true);
  end if;

  if action = 'admin_note' then
    applicant_uuid := nullif(payload->>'id', '')::uuid;
    insert into public.sbp_setter_admin_notes (applicant_id, admin_user_id, note)
    values (applicant_uuid, 'admin', payload->>'note');
    insert into public.sbp_setter_application_events (applicant_id, event_type, metadata)
    values (applicant_uuid, 'admin_note_added', '{}'::jsonb);
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'message', 'Unknown bridge action.');
exception
  when others then
    return jsonb_build_object('ok', false, 'message', SQLERRM);
end
$$;

revoke all on function public.sbp_setter_apply_state(jsonb) from public;
revoke all on function public.sbp_setter_time_minutes(text) from public;
revoke all on function public.sbp_setter_status_from_step(integer) from public;
grant execute on function public.sbp_setter_bridge(jsonb) to anon, authenticated;
