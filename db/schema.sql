create extension if not exists pgcrypto;

create table if not exists applicants (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  preferred_name text,
  normalized_email text not null,
  country text,
  desired_hourly_pay numeric(8, 2),
  earliest_start_date date,
  availability_est jsonb,
  vocaroo_url text,
  crm_platforms text,
  appointment_setting_experience text,
  industries text,
  past_metrics text,
  application_status text not null default 'started',
  qualification_status text check (qualification_status in ('qualified', 'manual_review', 'not_qualified')),
  internal_score integer,
  current_step integer not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  total_completion_seconds integer,
  interview_status text not null default 'not_scheduled',
  interview_scheduled_at timestamptz,
  interview_details jsonb,
  hiring_stage_status text,
  abandoned_at_step integer,
  hard_flags text[],
  reopened_at timestamptz,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists applicants_normalized_email_unique
  on applicants (normalized_email)
  where reopened_at is null;

create table if not exists application_events (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid references applicants(id) on delete cascade,
  event_type text not null,
  step integer,
  metadata jsonb,
  occurred_at timestamptz not null default now()
);

create table if not exists media_engagement (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  media_type text not null,
  media_key text not null,
  started boolean not null default false,
  seconds_consumed integer not null default 0,
  percentage_consumed integer not null default 0,
  completed boolean not null default false,
  replay_count integer not null default 0,
  pause_count integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (applicant_id, media_type, media_key)
);

create table if not exists mock_calls (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  mock_call_number integer not null check (mock_call_number in (1, 2, 3)),
  vapi_call_id text,
  status text not null default 'not_started',
  started_at timestamptz,
  ended_at timestamptz,
  duration_seconds integer,
  ended_reason text,
  transcript text,
  recording_url text,
  summary text,
  structured_output jsonb,
  backend_score integer,
  raw_event_reference jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, mock_call_number),
  unique (vapi_call_id)
);

create table if not exists scenario_responses (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  question_key text not null,
  response text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (applicant_id, question_key)
);

create table if not exists admin_notes (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references applicants(id) on delete cascade,
  admin_user_id text not null,
  note text not null,
  created_at timestamptz not null default now()
);

alter table applicants enable row level security;
alter table application_events enable row level security;
alter table media_engagement enable row level security;
alter table mock_calls enable row level security;
alter table scenario_responses enable row level security;
alter table admin_notes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'applicants' and policyname = 'service role full access applicants') then
    create policy "service role full access applicants" on applicants for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'application_events' and policyname = 'service role full access events') then
    create policy "service role full access events" on application_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'media_engagement' and policyname = 'service role full access media') then
    create policy "service role full access media" on media_engagement for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'mock_calls' and policyname = 'service role full access mock calls') then
    create policy "service role full access mock calls" on mock_calls for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'scenario_responses' and policyname = 'service role full access scenarios') then
    create policy "service role full access scenarios" on scenario_responses for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'admin_notes' and policyname = 'service role full access notes') then
    create policy "service role full access notes" on admin_notes for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
  end if;
end $$;
