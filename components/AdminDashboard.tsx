"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicantRecord, MediaEngagementInput } from "@/lib/types";

const staticPagesMode = process.env.NEXT_PUBLIC_STATIC_PAGES_MODE === "1";

type StaticSubmission = {
  applicantId: string;
  currentStep?: number;
  highestStep?: number;
  fields?: Record<string, any>;
  callLibrary?: MediaEngagementInput[];
  mockCalls?: Array<Record<string, any>>;
  scenarios?: Array<Record<string, any>>;
  submittedAt?: string | null;
  updatedAt?: string;
  statusOverride?: Partial<ApplicantRecord>;
  notes?: Array<{ note: string; createdAt: string }>;
};

type Bundle = {
  applicant: ApplicantRecord;
  events: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  mockCalls: Array<Record<string, unknown>>;
  scenarios: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
  raw?: StaticSubmission | null;
};

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [applicants, setApplicants] = useState<ApplicantRecord[]>([]);
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [note, setNote] = useState("");
  const [loadMessage, setLoadMessage] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("sbp_admin_token") || "";
    setToken(saved);
    if (staticPagesMode || saved) loadApplicants(saved);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = applicants.filter((a) => {
      const haystack = [
        a.full_name,
        a.preferred_name,
        a.normalized_email,
        a.application_status,
        a.qualification_status,
        a.crm_platforms,
        a.appointment_setting_experience,
        a.industries,
        a.past_metrics
      ]
        .join(" ")
        .toLowerCase();
      return (!q || haystack.includes(q)) && (!status || a.application_status === status || a.qualification_status === status || a.interview_status === status);
    });
    list.sort((a, b) => {
      if (sort === "oldest") return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      if (sort === "pay") return Number(b.desired_hourly_pay || 0) - Number(a.desired_hourly_pay || 0);
      if (sort === "qualified") return String(a.qualification_status).localeCompare(String(b.qualification_status));
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });
    return list;
  }, [applicants, search, status, sort]);

  const stats = useMemo(() => {
    const completed = applicants.filter((a) => a.application_status === "application_completed").length;
    const qualified = applicants.filter((a) => a.qualification_status === "qualified").length;
    const review = applicants.filter((a) => a.qualification_status === "manual_review").length;
    const calls = getStaticSubmissions().reduce((sum, item) => sum + (item.mockCalls || []).filter((call) => call.status === "completed").length, 0);
    return { total: applicants.length, completed, qualified, review, calls };
  }, [applicants]);

  async function loadApplicants(authToken = token) {
    sessionStorage.setItem("sbp_admin_token", authToken);
    if (staticPagesMode) {
      loadStaticApplicants();
      return;
    }
    try {
      const response = await fetch("/api/admin/applicants", { headers: { "x-admin-token": authToken } });
      if (!response.ok) throw new Error("Admin API unavailable.");
      setApplicants((await response.json()).applicants || []);
      setLoadMessage("");
    } catch {
      loadStaticApplicants();
    }
  }

  function loadStaticApplicants() {
    const submissions = getStaticSubmissions();
    const applicants = submissions.map(staticSubmissionToApplicant);
    setApplicants(applicants);
    setLoadMessage(
      staticPagesMode
        ? "Showing submissions saved in this browser. A server database is required to collect applications across devices."
        : "Admin API is unavailable, so this view is showing submissions saved in this browser."
    );
    if (selected && !applicants.some((applicant) => applicant.id === selected.applicant.id)) setSelected(null);
  }

  async function openApplicant(id: string) {
    if (!staticPagesMode) {
      try {
        const response = await fetch(`/api/admin/applicants/${id}`, { headers: { "x-admin-token": token } });
        if (!response.ok) throw new Error("Admin detail API unavailable.");
        setSelected(await response.json());
        return;
      } catch {
        // Fall through to static detail.
      }
    }
    const submissions = getStaticSubmissions();
    const raw = submissions.find((item) => item.applicantId === id);
    const applicant = raw ? staticSubmissionToApplicant(raw) : applicants.find((item) => item.id === id);
    if (!applicant) return;
    setSelected({
      applicant,
      events: [],
      media: raw?.callLibrary || [],
      mockCalls: raw?.mockCalls || [],
      scenarios: raw?.scenarios || [],
      notes: raw?.notes || [],
      raw
    });
  }

  async function updateStatus(patch: Record<string, unknown>) {
    if (!selected) return;
    if (staticPagesMode) {
      const submissions = getStaticSubmissions().map((item) => {
        if (item.applicantId !== selected.applicant.id) return item;
        const statusOverride = { ...(item.statusOverride || {}) };
        if (patch.qualificationStatus) statusOverride.qualification_status = patch.qualificationStatus as any;
        if (patch.applicationStatus) statusOverride.application_status = patch.applicationStatus as any;
        if (patch.reopen) {
          statusOverride.application_status = "started";
          statusOverride.qualification_status = "manual_review";
          statusOverride.reopened_at = new Date().toISOString();
        }
        return { ...item, statusOverride, updatedAt: new Date().toISOString() };
      });
      saveStaticSubmissions(submissions);
      loadStaticApplicants();
      await openApplicant(selected.applicant.id);
      return;
    }
    const response = await fetch(`/api/admin/applicants/${selected.applicant.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify(patch)
    });
    if (response.ok) {
      await loadApplicants();
      await openApplicant(selected.applicant.id);
    }
  }

  async function addNote() {
    if (!selected || !note.trim()) return;
    if (staticPagesMode) {
      const submissions = getStaticSubmissions().map((item) =>
        item.applicantId === selected.applicant.id
          ? { ...item, notes: [...(item.notes || []), { note: note.trim(), createdAt: new Date().toISOString() }], updatedAt: new Date().toISOString() }
          : item
      );
      saveStaticSubmissions(submissions);
      setNote("");
      await openApplicant(selected.applicant.id);
      return;
    }
    await fetch(`/api/admin/applicants/${selected.applicant.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ note })
    });
    setNote("");
    await openApplicant(selected.applicant.id);
  }

  function exportStatic(format: "csv" | "json") {
    const submissions = getStaticSubmissions();
    const fileBody =
      format === "json"
        ? JSON.stringify(submissions, null, 2)
        : toCsv(submissions.map(staticSubmissionToApplicant));
    const type = format === "json" ? "application/json" : "text/csv";
    const url = URL.createObjectURL(new Blob([fileBody], { type }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `solidbooked-setter-applicants.${format}`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="admin-shell">
      <div className="container">
        <a className="brand" href="/"><span className="brand-mark">✓</span><span>SolidBooked Pro Admin</span></a>

        <section className="admin-hero">
          <div>
            <span className="eyebrow"><span className="dot" /> Hiring command center</span>
            <h1>Setter Application Dashboard</h1>
            <p>Review submissions, call activity, scenario answers, status changes, and notes from one place.</p>
          </div>
          <div className="admin-actions">
            {!staticPagesMode && <input className="control" placeholder="Admin API token" value={token} onChange={(event) => setToken(event.target.value)} />}
            <button className="btn btn-primary" onClick={() => loadApplicants()}>Refresh applicants</button>
            <button className="btn btn-secondary" onClick={() => staticPagesMode ? exportStatic("csv") : window.location.assign("/api/admin/export?format=csv")}>CSV export</button>
            <button className="btn btn-secondary" onClick={() => staticPagesMode ? exportStatic("json") : window.location.assign("/api/admin/export?format=json")}>JSON export</button>
          </div>
        </section>

        {loadMessage && <p className="notice">{loadMessage}</p>}

        <section className="admin-stat-grid" aria-label="Application statistics">
          <Stat label="Applicants" value={stats.total} />
          <Stat label="Completed" value={stats.completed} />
          <Stat label="Qualified" value={stats.qualified} />
          <Stat label="Manual review" value={stats.review} />
          <Stat label="Mock calls completed" value={stats.calls} />
        </section>

        <div className="admin-toolbar">
          <input className="control" placeholder="Search name, email, platform, experience, metrics" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="control" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {["started", "application_completed", "qualified", "manual_review", "not_qualified", "interview_scheduled", "scheduled", "hired", "rejected", "withdrawn"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="control" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="pay">Highest pay expectation</option>
            <option value="qualified">Qualification</option>
          </select>
        </div>

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Desired pay</th>
                <th>Availability</th>
                <th>Start date</th>
                <th>Experience summary</th>
                <th>Status</th>
                <th>Qualification</th>
                <th>Mock calls</th>
                <th>Interview</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((applicant) => (
                <tr key={applicant.id}>
                  <td><strong>{applicant.full_name || "Unnamed"}</strong><br /><span className="media-meta">{applicant.preferred_name || ""}</span></td>
                  <td>{applicant.normalized_email}</td>
                  <td>{applicant.desired_hourly_pay ? `$${applicant.desired_hourly_pay}/hr` : ""}</td>
                  <td>{applicant.availability_est ? `${applicant.availability_est.start}-${applicant.availability_est.end} ET` : ""}</td>
                  <td>{applicant.earliest_start_date || ""}</td>
                  <td>{truncate(applicant.appointment_setting_experience || applicant.past_metrics || "", 110)}</td>
                  <td><span className="pill">{applicant.application_status}</span></td>
                  <td><span className="pill">{applicant.qualification_status || "pending"}</span></td>
                  <td>{getMockCallsCompleted(applicant.id)}/3</td>
                  <td>{applicant.interview_status}</td>
                  <td>{applicant.submitted_at ? new Date(applicant.submitted_at).toLocaleString() : ""}</td>
                  <td><button className="btn btn-secondary btn-small" onClick={() => openApplicant(applicant.id)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="admin-table-empty">No applicants found yet. Complete a test submission in this same browser, then refresh this dashboard.</div>}
        </div>

        {selected && (
          <section className="admin-detail-grid">
            <aside className="admin-detail-panel">
              <div className="admin-detail-head">
                <div>
                  <h2>{selected.applicant.full_name || "Applicant detail"}</h2>
                  <p>{selected.applicant.normalized_email}</p>
                </div>
                <button className="btn btn-secondary btn-small" onClick={() => setSelected(null)}>Close</button>
              </div>
              <div className="admin-detail-body">
                <div className="admin-actions">
                  <button className="btn btn-secondary" onClick={() => updateStatus({ qualificationStatus: "qualified" })}>Qualify</button>
                  <button className="btn btn-secondary" onClick={() => updateStatus({ qualificationStatus: "manual_review" })}>Manual review</button>
                  <button className="btn btn-secondary" onClick={() => updateStatus({ qualificationStatus: "not_qualified" })}>Disqualify</button>
                  <button className="btn btn-secondary" onClick={() => updateStatus({ reopen: true })}>Reopen</button>
                </div>
                <div className="admin-answer-grid">
                  <Answer label="Preferred name" value={selected.applicant.preferred_name} />
                  <Answer label="Desired pay" value={selected.applicant.desired_hourly_pay ? `$${selected.applicant.desired_hourly_pay}/hr` : ""} />
                  <Answer label="Availability" value={selected.applicant.availability_est ? `${selected.applicant.availability_est.start}-${selected.applicant.availability_est.end} ET` : ""} />
                  <Answer label="Earliest start" value={selected.applicant.earliest_start_date} />
                  <Answer label="Vocaroo" value={selected.applicant.vocaroo_url} />
                  <Answer label="Resume" value={selected.raw?.fields?.resumeFileName || ""} />
                </div>
                <div className="field full">
                  <label htmlFor="note">Internal notes</label>
                  <textarea className="control" id="note" value={note} onChange={(event) => setNote(event.target.value)} />
                  <button className="btn btn-primary" onClick={addNote}>Add note</button>
                </div>
              </div>
            </aside>

            <div className="admin-detail-panel">
              <div className="admin-detail-head">
                <div>
                  <h2>Application Review</h2>
                  <p>Status, answers, engagement, mock calls, and notes.</p>
                </div>
              </div>
              <div className="admin-detail-body">
                <Detail title="Application answers" value={selected.applicant} />
                <Detail title="Call-library engagement" value={selected.media} />
                <Detail title="Mock-call recordings, transcripts, summaries, and structured outputs" value={selected.mockCalls} />
                <Detail title="Scenario answers" value={selected.scenarios} />
                <Detail title="Step timing, abandonment, qualification outcome, hard flags, internal score" value={{ events: selected.events, hardFlags: selected.applicant.hard_flags, internalScore: selected.applicant.internal_score, abandonmentPoint: selected.applicant.abandoned_at_step, qualificationOutcome: selected.applicant.qualification_status }} />
                <Detail title="Interview details and hiring-stage status" value={{ interview: selected.applicant.interview_details, interviewStatus: selected.applicant.interview_status, hiringStageStatus: selected.applicant.hiring_stage_status }} />
                <Detail title="Internal notes" value={selected.notes} />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="admin-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Answer({ label, value }: { label: string; value: unknown }) {
  return <div className="answer-card"><span>{label}</span><p>{String(value || "")}</p></div>;
}

function Detail({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="admin-detail-block">
      <summary><strong>{title}</strong></summary>
      <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function getStaticSubmissions(): StaticSubmission[] {
  if (typeof window === "undefined") return [];
  const submissions = readJson<StaticSubmission[]>("sbp_setter_static_submissions", []);
  const active = readJson<StaticSubmission | null>("sbp_setter_next_state", null);
  const normalizedActive = active?.applicantId ? [{ ...active, submittedAt: active.submittedAt || null }] : [];
  const byId = new Map<string, StaticSubmission>();
  [...normalizedActive, ...submissions].forEach((item) => {
    if (!item.applicantId) return;
    byId.set(item.applicantId, { ...(byId.get(item.applicantId) || {}), ...item });
  });
  return Array.from(byId.values());
}

function saveStaticSubmissions(submissions: StaticSubmission[]) {
  localStorage.setItem("sbp_setter_static_submissions", JSON.stringify(submissions));
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function staticSubmissionToApplicant(submission: StaticSubmission): ApplicantRecord {
  const fields = submission.fields || {};
  const now = new Date().toISOString();
  const completed = Boolean(submission.submittedAt);
  const base: ApplicantRecord = {
    id: submission.applicantId,
    full_name: fields.fullName || null,
    preferred_name: fields.preferredName || null,
    normalized_email: String(fields.email || "").trim().toLowerCase(),
    country: fields.country || null,
    desired_hourly_pay: fields.desiredHourly || null,
    earliest_start_date: fields.earliestStartDate || null,
    availability_est: fields.availableStart ? { start: fields.availableStart, end: fields.availableEnd } : null,
    vocaroo_url: fields.vocarooUrl || null,
    crm_platforms: fields.crmPlatforms || null,
    appointment_setting_experience: fields.appointmentSettingExperience || null,
    industries: fields.industries || null,
    past_metrics: fields.pastMetrics || null,
    application_status: completed ? "application_completed" : "started",
    qualification_status: completed ? "manual_review" : null,
    internal_score: null,
    current_step: submission.currentStep || 1,
    started_at: submission.updatedAt || submission.submittedAt || now,
    submitted_at: submission.submittedAt || null,
    total_completion_seconds: null,
    interview_status: "not_scheduled",
    interview_scheduled_at: null,
    interview_details: null,
    hiring_stage_status: null,
    abandoned_at_step: completed ? null : submission.currentStep || 1,
    hard_flags: null,
    reopened_at: null,
    created_at: submission.updatedAt || submission.submittedAt || now,
    updated_at: submission.updatedAt || submission.submittedAt || now
  };
  return { ...base, ...(submission.statusOverride || {}) };
}

function getMockCallsCompleted(applicantId: string) {
  const submission = getStaticSubmissions().find((item) => item.applicantId === applicantId);
  return (submission?.mockCalls || []).filter((call) => call.status === "completed").length;
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function toCsv(applicants: ApplicantRecord[]) {
  const headers = ["Name", "Preferred name", "Email", "Desired pay", "Availability", "Start date", "Experience", "Status", "Qualification", "Interview", "Submitted"];
  const rows = applicants.map((a) => [
    a.full_name || "",
    a.preferred_name || "",
    a.normalized_email,
    a.desired_hourly_pay ? `$${a.desired_hourly_pay}/hr` : "",
    a.availability_est ? `${a.availability_est.start}-${a.availability_est.end} ET` : "",
    a.earliest_start_date || "",
    a.appointment_setting_experience || "",
    a.application_status,
    a.qualification_status || "",
    a.interview_status,
    a.submitted_at || ""
  ]);
  return [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}
