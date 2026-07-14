"use client";

import { useEffect, useMemo, useState } from "react";
import type { ApplicantRecord } from "@/lib/types";

const staticPagesMode = process.env.NEXT_PUBLIC_STATIC_PAGES_MODE === "1";

type Bundle = {
  applicant: ApplicantRecord;
  events: Array<Record<string, unknown>>;
  media: Array<Record<string, unknown>>;
  mockCalls: Array<Record<string, unknown>>;
  scenarios: Array<Record<string, unknown>>;
  notes: Array<Record<string, unknown>>;
};

export function AdminDashboard() {
  const [token, setToken] = useState("");
  const [applicants, setApplicants] = useState<ApplicantRecord[]>([]);
  const [selected, setSelected] = useState<Bundle | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("newest");
  const [note, setNote] = useState("");

  useEffect(() => {
    const saved = sessionStorage.getItem("sbp_admin_token") || "";
    setToken(saved);
    if (saved) loadApplicants(saved);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const list = applicants.filter((a) => {
      const haystack = [a.full_name, a.preferred_name, a.normalized_email, a.country, a.application_status, a.qualification_status].join(" ").toLowerCase();
      return (!q || haystack.includes(q)) && (!status || a.application_status === status || a.qualification_status === status);
    });
    list.sort((a, b) => {
      if (sort === "oldest") return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      if (sort === "pay") return Number(b.desired_hourly_pay || 0) - Number(a.desired_hourly_pay || 0);
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });
    return list;
  }, [applicants, search, status, sort]);

  async function loadApplicants(authToken = token) {
    sessionStorage.setItem("sbp_admin_token", authToken);
    try {
      const response = await fetch("/api/admin/applicants", { headers: { "x-admin-token": authToken } });
      if (response.ok) setApplicants((await response.json()).applicants || []);
    } catch {
      if (!staticPagesMode) return;
      const submissions = JSON.parse(localStorage.getItem("sbp_setter_static_submissions") || "[]") as Array<any>;
      setApplicants(
        submissions.map((submission) => ({
          id: submission.applicantId,
          full_name: submission.fields?.fullName || null,
          preferred_name: submission.fields?.preferredName || null,
          normalized_email: submission.fields?.email || "",
          country: submission.fields?.country || null,
          desired_hourly_pay: submission.fields?.desiredHourly || null,
          earliest_start_date: submission.fields?.earliestStartDate || null,
          availability_est: submission.fields?.availableStart ? { start: submission.fields.availableStart, end: submission.fields.availableEnd } : null,
          vocaroo_url: submission.fields?.vocarooUrl || null,
          crm_platforms: submission.fields?.crmPlatforms || null,
          appointment_setting_experience: submission.fields?.appointmentSettingExperience || null,
          industries: submission.fields?.industries || null,
          past_metrics: submission.fields?.pastMetrics || null,
          application_status: "application_completed",
          qualification_status: "manual_review",
          internal_score: null,
          current_step: submission.currentStep || 5,
          started_at: submission.submittedAt || new Date().toISOString(),
          submitted_at: submission.submittedAt || null,
          total_completion_seconds: null,
          interview_status: "not_scheduled",
          interview_scheduled_at: null,
          interview_details: null,
          hiring_stage_status: null,
          abandoned_at_step: null,
          hard_flags: null,
          reopened_at: null,
          created_at: submission.submittedAt || new Date().toISOString(),
          updated_at: submission.submittedAt || new Date().toISOString()
        }))
      );
    }
  }

  async function openApplicant(id: string) {
    try {
      const response = await fetch(`/api/admin/applicants/${id}`, { headers: { "x-admin-token": token } });
      if (response.ok) setSelected(await response.json());
    } catch {
      if (!staticPagesMode) return;
      const applicant = applicants.find((item) => item.id === id);
      if (!applicant) return;
      const submissions = JSON.parse(localStorage.getItem("sbp_setter_static_submissions") || "[]") as Array<any>;
      const raw = submissions.find((item) => item.applicantId === id);
      setSelected({
        applicant,
        events: [],
        media: [raw?.founderVideo, ...(raw?.callLibrary || [])].filter(Boolean),
        mockCalls: raw?.mockCalls || [],
        scenarios: raw?.scenarios || [],
        notes: []
      });
    }
  }

  async function updateStatus(patch: Record<string, unknown>) {
    if (!selected) return;
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
    await fetch(`/api/admin/applicants/${selected.applicant.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-token": token },
      body: JSON.stringify({ note })
    });
    setNote("");
    await openApplicant(selected.applicant.id);
  }

  return (
    <main className="admin-shell">
      <div className="container">
        <a className="brand" href="/"><span className="brand-mark">✓</span><span>SolidBooked Pro Admin</span></a>
        <p>Protected applicant review dashboard. Browser access is also guarded by basic auth in middleware.</p>
        {staticPagesMode && <p className="notice">GitHub Pages mode is active. This dashboard can only read submissions saved in this browser. The protected database dashboard requires the server deployment.</p>}
        <div className="admin-toolbar">
          <input className="control" placeholder="Admin API token" value={token} onChange={(event) => setToken(event.target.value)} />
          <button className="btn btn-primary" onClick={() => loadApplicants()}>Load applicants</button>
          <a className="btn btn-secondary" href={`/api/admin/export?format=csv`}>CSV export</a>
          <a className="btn btn-secondary" href={`/api/admin/export?format=json`}>JSON export</a>
        </div>
        <div className="admin-toolbar">
          <input className="control" placeholder="Search name, email, country, status" value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="control" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {["started", "step_1_complete", "step_2_complete", "step_3_complete", "mock_calls_in_progress", "application_completed", "qualified", "manual_review", "not_qualified", "interview_scheduled", "hired", "rejected", "withdrawn"].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="control" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="pay">Highest pay expectation</option>
          </select>
        </div>

        <div className="admin-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Preferred</th>
                <th>Email</th>
                <th>Country</th>
                <th>Desired pay</th>
                <th>Availability</th>
                <th>Start date</th>
                <th>Experience summary</th>
                <th>Application status</th>
                <th>Qualification</th>
                <th>Completion</th>
                <th>Mock calls</th>
                <th>Interview</th>
                <th>Started</th>
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id}>
                  <td>{a.full_name || ""}</td>
                  <td>{a.preferred_name || ""}</td>
                  <td>{a.normalized_email}</td>
                  <td>{a.country || ""}</td>
                  <td>{a.desired_hourly_pay ? `$${a.desired_hourly_pay}/hr` : ""}</td>
                  <td>{a.availability_est ? `${a.availability_est.start}-${a.availability_est.end} ET` : ""}</td>
                  <td>{a.earliest_start_date || ""}</td>
                  <td>{(a.appointment_setting_experience || "").slice(0, 90)}</td>
                  <td><span className="pill">{a.application_status}</span></td>
                  <td><span className="pill">{a.qualification_status || "pending"}</span></td>
                  <td>{a.total_completion_seconds ? `${a.total_completion_seconds}s` : ""}</td>
                  <td>Open detail</td>
                  <td>{a.interview_status}</td>
                  <td>{new Date(a.started_at).toLocaleString()}</td>
                  <td>{a.submitted_at ? new Date(a.submitted_at).toLocaleString() : ""}</td>
                  <td><button className="btn btn-secondary btn-small" onClick={() => openApplicant(a.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {selected && (
          <section className="section">
            <div className="application-card">
              <div className="form-shell">
                <div className="step-heading">
                  <div>
                    <h2>{selected.applicant.full_name || "Applicant detail"}</h2>
                    <p>{selected.applicant.normalized_email}</p>
                  </div>
                  <button className="btn btn-secondary btn-small" onClick={() => setSelected(null)}>Close</button>
                </div>
                <div className="admin-toolbar">
                  <button className="btn btn-secondary" onClick={() => updateStatus({ qualificationStatus: "qualified" })}>Manually qualify</button>
                  <button className="btn btn-secondary" onClick={() => updateStatus({ qualificationStatus: "not_qualified" })}>Disqualify</button>
                  <button className="btn btn-secondary" onClick={() => updateStatus({ reopen: true })}>Reopen application</button>
                  <button className="btn btn-primary" onClick={() => navigator.clipboard.writeText(window.location.origin)}>Copy interview link base</button>
                </div>
                <Detail title="Every application answer" value={selected.applicant} />
                <Detail title="Founder-video and call-library engagement" value={selected.media} />
                <Detail title="Mock-call recordings, transcripts, summaries, and structured outputs" value={selected.mockCalls} />
                <Detail title="Scenario answers" value={selected.scenarios} />
                <Detail title="Step timing, abandonment, qualification outcome, hard flags, internal score" value={{ events: selected.events, hardFlags: selected.applicant.hard_flags, internalScore: selected.applicant.internal_score, abandonmentPoint: selected.applicant.abandoned_at_step, qualificationOutcome: selected.applicant.qualification_status }} />
                <Detail title="Interview details and hiring-stage status" value={{ interview: selected.applicant.interview_details, interviewStatus: selected.applicant.interview_status, hiringStageStatus: selected.applicant.hiring_stage_status }} />
                <div className="field full">
                  <label htmlFor="note">Internal notes</label>
                  <textarea className="control" id="note" value={note} onChange={(event) => setNote(event.target.value)} />
                  <button className="btn btn-primary" onClick={addNote}>Add note</button>
                </div>
                <Detail title="Existing notes" value={selected.notes} />
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function Detail({ title, value }: { title: string; value: unknown }) {
  return (
    <details className="audio-card" open={false}>
      <summary><strong>{title}</strong></summary>
      <pre style={{ whiteSpace: "pre-wrap", overflowX: "auto" }}>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}
