"use client";

import { useEffect, useMemo, useState } from "react";
import { setterBridgeRequest, setterBridgeUrl } from "@/lib/clientBridge";
import type { ApplicantRecord, MediaEngagementInput } from "@/lib/types";

const staticPagesMode = process.env.NEXT_PUBLIC_STATIC_PAGES_MODE === "1";
const bridgeMode = staticPagesMode && Boolean(setterBridgeUrl);
const adminTokenStorageKey = "sbp_admin_token";
const fitStatuses = [
  { value: "", label: "No fit status" },
  { value: "a_player", label: "A-Player" },
  { value: "b_player", label: "B-Player" },
  { value: "good_fit", label: "Good Fit" },
  { value: "maybe", label: "Maybe" },
  { value: "bad_fit", label: "Bad Fit" },
  { value: "do_not_contact", label: "Do Not Contact" }
];
const applicationStatuses = ["started", "step_1_complete", "step_2_complete", "step_3_complete", "mock_calls_in_progress", "application_completed", "interview_scheduled", "interview_completed", "paid_trial", "hired", "rejected", "withdrawn"];
const qualificationStatuses = ["qualified", "manual_review", "not_qualified"];
const interviewStatuses = ["not_scheduled", "scheduled", "completed"];

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

type ResumePayload = {
  fileName: string;
  fileType: string;
  fileSize: number;
  fileBase64: string;
  uploadedAt?: string;
};

type MockCallRecord = Record<string, any> & {
  mock_call_number?: number;
  mockCallNumber?: number;
  status?: string;
  duration_seconds?: number;
  durationSeconds?: number;
  backend_score?: number;
  backendScore?: number;
  transcript?: string;
  recording_url?: string;
  recordingUrl?: string;
  summary?: string;
  structured_output?: Record<string, any> | null;
  structuredOutput?: Record<string, any> | null;
};

type ObjectionMoment = {
  objection: string;
  candidateResponse: string;
  judgment: string;
  label?: string;
  score?: number | string;
  timestamp?: string;
  recommendedMove?: string;
  advisorLens?: string;
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
  const [resumeMessage, setResumeMessage] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem(adminTokenStorageKey) || sessionStorage.getItem(adminTokenStorageKey) || "";
    setToken(saved);
    if (saved) loadApplicants(saved);
    else if (bridgeMode) setLoadMessage("Enter the admin password once. This browser will remember it for future dashboard visits.");
    else if (staticPagesMode) loadStaticApplicants();
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
        a.hiring_stage_status,
        a.crm_platforms,
        a.appointment_setting_experience,
        a.industries,
        a.past_metrics
      ]
        .join(" ")
        .toLowerCase();
      return (!q || haystack.includes(q)) && (!status || a.application_status === status || a.qualification_status === status || a.interview_status === status || a.hiring_stage_status === status);
    });
    list.sort((a, b) => {
      if (sort === "oldest") return new Date(a.started_at).getTime() - new Date(b.started_at).getTime();
      if (sort === "pay") return Number(b.desired_hourly_pay || 0) - Number(a.desired_hourly_pay || 0);
      if (sort === "score") return getApplicantScore(b) - getApplicantScore(a);
      if (sort === "qualified") return String(a.qualification_status).localeCompare(String(b.qualification_status));
      return new Date(b.started_at).getTime() - new Date(a.started_at).getTime();
    });
    return list;
  }, [applicants, search, status, sort]);

  const stats = useMemo(() => {
    const completed = applicants.filter((a) => a.application_status === "application_completed").length;
    const qualified = applicants.filter((a) => a.qualification_status === "qualified").length;
    const review = applicants.filter((a) => a.qualification_status === "manual_review").length;
    const calls = bridgeMode
      ? applicants.reduce((sum, item) => sum + Number((item as any).mock_calls_completed || 0), 0)
      : getStaticSubmissions().reduce((sum, item) => sum + (item.mockCalls || []).filter((call) => call.status === "completed").length, 0);
    return { total: applicants.length, completed, qualified, review, calls };
  }, [applicants]);

  async function loadApplicants(authToken = token) {
    if (bridgeMode) {
      try {
        const body = await setterBridgeRequest<{ applicants: ApplicantRecord[] }>("admin_list", { token: authToken });
        if (authToken) {
          localStorage.setItem(adminTokenStorageKey, authToken);
          sessionStorage.setItem(adminTokenStorageKey, authToken);
        }
        setApplicants(body.applicants || []);
        setLoadMessage("Showing Supabase submissions through the SolidBooked Pro bridge.");
        if (selected && !body.applicants?.some((applicant) => applicant.id === selected.applicant.id)) setSelected(null);
        return;
      } catch (error) {
        setApplicants([]);
        setSelected(null);
        if (authToken) localStorage.removeItem(adminTokenStorageKey);
        setLoadMessage(error instanceof Error ? error.message : "Admin bridge is unavailable.");
        return;
      }
    }
    if (staticPagesMode) {
      loadStaticApplicants();
      return;
    }
    try {
      const response = await fetch("/api/admin/applicants", { headers: { "x-admin-token": authToken } });
      if (!response.ok) throw new Error("Admin API unavailable.");
      if (authToken) {
        localStorage.setItem(adminTokenStorageKey, authToken);
        sessionStorage.setItem(adminTokenStorageKey, authToken);
      }
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
    if (bridgeMode) {
      try {
        const body = await setterBridgeRequest<Bundle>("admin_detail", { token, id });
        setSelected(body);
        return;
      } catch (error) {
        setLoadMessage(error instanceof Error ? error.message : "Admin detail bridge is unavailable.");
        return;
      }
    }
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
    if (bridgeMode) {
      const updated = await setterBridgeRequest("admin_status", { token, id: selected.applicant.id, patch }).then(() => true).catch((error) => {
        setLoadMessage(error instanceof Error ? error.message : "Status update failed.");
        return false;
      });
      if (!updated) return;
      await loadApplicants();
      await openApplicant(selected.applicant.id);
      return;
    }
    if (staticPagesMode) {
      const submissions = getStaticSubmissions().map((item) => {
        if (item.applicantId !== selected.applicant.id) return item;
        const statusOverride = { ...(item.statusOverride || {}) };
        if (patch.qualificationStatus) statusOverride.qualification_status = patch.qualificationStatus as any;
        if (patch.applicationStatus) statusOverride.application_status = patch.applicationStatus as any;
        if (patch.interviewStatus) statusOverride.interview_status = patch.interviewStatus as any;
        if (patch.hiringStageStatus !== undefined) statusOverride.hiring_stage_status = patch.hiringStageStatus as any;
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
    if (bridgeMode) {
      const saved = await setterBridgeRequest("admin_note", { token, id: selected.applicant.id, note: note.trim() }).then(() => true).catch((error) => {
        setLoadMessage(error instanceof Error ? error.message : "Note could not be saved.");
        return false;
      });
      if (!saved) return;
      setNote("");
      await openApplicant(selected.applicant.id);
      return;
    }
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

  async function openResume(mode: "preview" | "download") {
    if (!selected) return;
    setResumeMessage("Preparing resume...");
    try {
      if (!bridgeMode) {
        setResumeMessage("Resume file content is only available for Supabase-backed submissions.");
        return;
      }
      const body = await setterBridgeRequest<{ resume: ResumePayload }>("admin_resume", { token, id: selected.applicant.id });
      const resume = body.resume;
      const blob = base64ToBlob(resume.fileBase64, resume.fileType);
      const url = URL.createObjectURL(blob);
      if (mode === "preview" && (resume.fileType === "application/pdf" || resume.fileType.startsWith("image/"))) {
        window.open(url, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setResumeMessage("Opened resume preview.");
        return;
      }
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = resume.fileName || "resume";
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setResumeMessage(mode === "preview" ? "This file type downloads instead of previewing." : "Resume download started.");
    } catch (error) {
      setResumeMessage(error instanceof Error ? error.message : "Resume could not be opened.");
    }
  }

  function exportStatic(format: "csv" | "json") {
    const submissions = bridgeMode ? [] : getStaticSubmissions();
    const fileBody =
      format === "json"
        ? JSON.stringify(bridgeMode ? applicants : submissions, null, 2)
        : toCsv(bridgeMode ? applicants : submissions.map(staticSubmissionToApplicant));
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
            {(!staticPagesMode || bridgeMode) && <input className="control" type="password" placeholder={token ? "Admin password saved" : "Admin password"} value={token} onChange={(event) => setToken(event.target.value)} />}
            <button className="btn btn-primary" onClick={() => loadApplicants()}>Refresh applicants</button>
            {token && <button className="btn btn-secondary" onClick={() => {
              localStorage.removeItem(adminTokenStorageKey);
              sessionStorage.removeItem(adminTokenStorageKey);
              setToken("");
              setApplicants([]);
              setSelected(null);
              setLoadMessage("Admin password cleared from this browser.");
            }}>Forget login</button>}
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
            {[...applicationStatuses, ...qualificationStatuses, ...interviewStatuses, ...fitStatuses.map((item) => item.value).filter(Boolean)].map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
          </select>
          <select className="control" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="score">Highest AI score</option>
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
                <th>Fit status</th>
                <th>AI score</th>
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
                  <td><span className={`pill ${applicant.hiring_stage_status ? "fit-pill" : ""}`}>{formatStatusLabel(applicant.hiring_stage_status || "none")}</span></td>
                  <td>{formatScore(getApplicantScore(applicant))}</td>
                  <td>{getMockCallsCompleted(applicant.id, applicants)}/3</td>
                  <td>{applicant.interview_status}</td>
                  <td>{applicant.submitted_at ? new Date(applicant.submitted_at).toLocaleString() : ""}</td>
                  <td><button className="btn btn-secondary btn-small" onClick={() => openApplicant(applicant.id)}>Review</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && <div className="admin-table-empty">No applicants found yet. Enter the admin password, refresh, or complete a test submission from the application.</div>}
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
                <section className="admin-status-panel" aria-label="Applicant status controls">
                  <label>
                    <span>Fit status</span>
                    <select className="control" value={selected.applicant.hiring_stage_status || ""} onChange={(event) => updateStatus({ hiringStageStatus: event.target.value || null })}>
                      {fitStatuses.map((item) => <option key={item.value || "none"} value={item.value}>{item.label}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Application status</span>
                    <select className="control" value={selected.applicant.application_status || "started"} onChange={(event) => updateStatus({ applicationStatus: event.target.value })}>
                      {applicationStatuses.map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Qualification</span>
                    <select className="control" value={selected.applicant.qualification_status || "manual_review"} onChange={(event) => updateStatus({ qualificationStatus: event.target.value })}>
                      {qualificationStatuses.map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
                    </select>
                  </label>
                  <label>
                    <span>Interview</span>
                    <select className="control" value={selected.applicant.interview_status || "not_scheduled"} onChange={(event) => updateStatus({ interviewStatus: event.target.value })}>
                      {interviewStatuses.map((item) => <option key={item} value={item}>{formatStatusLabel(item)}</option>)}
                    </select>
                  </label>
                </section>
                <div className="admin-answer-grid">
                  <Answer label="Preferred name" value={selected.applicant.preferred_name} />
                  <Answer label="Desired pay" value={selected.applicant.desired_hourly_pay ? `$${selected.applicant.desired_hourly_pay}/hr` : ""} />
                  <Answer label="Availability" value={selected.applicant.availability_est ? `${selected.applicant.availability_est.start}-${selected.applicant.availability_est.end} ET` : ""} />
                  <Answer label="Earliest start" value={selected.applicant.earliest_start_date} />
                  <Answer label="Vocaroo" value={selected.applicant.vocaroo_url} />
                  <ResumeAnswer
                    fileName={selected.applicant.resume_file_name || selected.raw?.fields?.resumeFileName || ""}
                    fileSize={selected.applicant.resume_file_size || selected.raw?.fields?.resumeFileSize || 0}
                    fileType={selected.applicant.resume_file_type || ""}
                    message={resumeMessage}
                    onPreview={() => openResume("preview")}
                    onDownload={() => openResume("download")}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="note">Internal notes</label>
                  <textarea className="control" id="note" value={note} onChange={(event) => setNote(event.target.value)} />
                  <button className="btn btn-primary" onClick={addNote}>Add note</button>
                </div>
                <NoteList notes={selected.notes} />
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
                <MockCallReviews calls={selected.mockCalls as MockCallRecord[]} />
                <Detail title="Raw mock-call records" value={selected.mockCalls} />
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

function MockCallReviews({ calls }: { calls: MockCallRecord[] }) {
  if (!calls.length) {
    return (
      <section className="mock-review-panel">
        <div className="mock-review-head">
          <div>
            <h3>AI objection review</h3>
            <p>No mock calls have been saved yet.</p>
          </div>
        </div>
      </section>
    );
  }

  const sortedCalls = [...calls].sort((a, b) => Number(a.mock_call_number || a.mockCallNumber || 0) - Number(b.mock_call_number || b.mockCallNumber || 0));
  const scoredCalls = sortedCalls.filter((call) => getCallScore(call) > 0);
  const averageScore = scoredCalls.length ? Math.round(scoredCalls.reduce((sum, call) => sum + getCallScore(call), 0) / scoredCalls.length) : 0;

  return (
    <section className="mock-review-panel">
      <div className="mock-review-head">
        <div>
          <h3>AI objection review</h3>
          <p>Prospect objection, applicant response, and the judging note from the scorer.</p>
        </div>
        <span className="score-chip">{averageScore ? `${averageScore}/100 avg` : "Awaiting AI score"}</span>
      </div>

      <div className="mock-review-list">
        {sortedCalls.map((call) => {
          const number = call.mock_call_number || call.mockCallNumber || "?";
          const score = getCallScore(call);
          const structured = getStructuredOutput(call);
          const moments = extractObjectionMoments(structured);
          const transcript = String(call.transcript || "");
          const recordingUrl = String(call.recording_url || call.recordingUrl || "");
          return (
            <article className="mock-review-card" key={`${number}-${call.vapi_call_id || call.vapiCallId || "call"}`}>
              <div className="mock-review-card-head">
                <div>
                  <h4>Mock Call {number}</h4>
                  <p>{[call.status, formatDuration(call.duration_seconds || call.durationSeconds)].filter(Boolean).join(" · ")}</p>
                </div>
                <span className="score-chip score-chip-dark">{score ? `${score}/100` : "No score"}</span>
              </div>

              {call.summary && <p className="call-summary">{String(call.summary)}</p>}

              <div className="review-actions">
                {recordingUrl && <a className="btn btn-secondary btn-small" href={recordingUrl} target="_blank" rel="noreferrer">Open recording</a>}
                {call.vapi_call_id && <span className="media-meta">Vapi call: {String(call.vapi_call_id)}</span>}
              </div>

              <div className="objection-list">
                {moments.length ? (
                  moments.map((moment, index) => (
                    <div className="objection-card" key={`${number}-moment-${index}`}>
                      <div className="objection-card-top">
                        <span>{moment.label || "Objection moment"}</span>
                        {moment.score !== undefined && <strong>{moment.score}/100</strong>}
                      </div>
                      {moment.timestamp && <small>{moment.timestamp}</small>}
                      <QuoteBlock label="Prospect said" value={moment.objection} />
                      <QuoteBlock label="Applicant replied" value={moment.candidateResponse} highlight />
                      <QuoteBlock label="AI judge note" value={moment.judgment} />
                      {moment.recommendedMove && <QuoteBlock label="Better move" value={moment.recommendedMove} />}
                      {moment.advisorLens && <small className="advisor-lens">{moment.advisorLens}</small>}
                    </div>
                  ))
                ) : (
                  <div className="empty-review">
                    No objection-response review has been saved for this call yet. Once the Vapi/n8n scorer writes <code>objection_moments</code> to the call output, the applicant&apos;s exact responses will appear here.
                  </div>
                )}
              </div>

              {transcript && (
                <details className="transcript-block">
                  <summary>Transcript</summary>
                  <p>{transcript}</p>
                </details>
              )}

              {structured && (
                <details className="transcript-block">
                  <summary>Raw AI scorecard</summary>
                  <pre>{JSON.stringify(structured, null, 2)}</pre>
                </details>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function QuoteBlock({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  if (!value) return null;
  return (
    <div className={`quote-block ${highlight ? "quote-highlight" : ""}`}>
      <span>{label}</span>
      <p>{value}</p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="admin-stat"><span>{label}</span><strong>{value}</strong></div>;
}

function Answer({ label, value }: { label: string; value: unknown }) {
  return <div className="answer-card"><span>{label}</span><p>{String(value || "")}</p></div>;
}

function ResumeAnswer({
  fileName,
  fileSize,
  fileType,
  message,
  onPreview,
  onDownload
}: {
  fileName: string;
  fileSize: number;
  fileType: string;
  message: string;
  onPreview: () => void;
  onDownload: () => void;
}) {
  return (
    <div className="answer-card resume-admin-card">
      <span>Resume</span>
      <p>{fileName || "No resume uploaded"}</p>
      {fileName && <small>{[formatFileSize(fileSize), fileType].filter(Boolean).join(" · ")}</small>}
      {fileName && (
        <div className="resume-admin-actions">
          <button className="btn btn-secondary btn-small" type="button" onClick={onPreview}>Preview</button>
          <button className="btn btn-primary btn-small" type="button" onClick={onDownload}>Download</button>
        </div>
      )}
      {message && <small>{message}</small>}
    </div>
  );
}

function NoteList({ notes }: { notes: Array<Record<string, unknown>> }) {
  if (!notes.length) {
    return <div className="notes-panel empty-notes">No internal notes yet.</div>;
  }
  return (
    <section className="notes-panel" aria-label="Saved internal notes">
      <h3>Saved notes</h3>
      <div className="notes-list">
        {notes.map((item, index) => (
          <article className="note-card" key={String(item.id || index)}>
            <p>{String(item.note || "")}</p>
            <span>{item.created_at ? new Date(String(item.created_at)).toLocaleString() : item.createdAt ? new Date(String(item.createdAt)).toLocaleString() : ""}</span>
          </article>
        ))}
      </div>
    </section>
  );
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
    resume_file_name: fields.resumeFileName || null,
    resume_file_size: fields.resumeFileSize || null,
    resume_file_type: fields.resumeFileType || null,
    resume_uploaded_at: null,
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

function getMockCallsCompleted(applicantId: string, applicants: ApplicantRecord[] = []) {
  const applicant = applicants.find((item) => item.id === applicantId) as (ApplicantRecord & { mock_calls_completed?: number }) | undefined;
  if (applicant?.mock_calls_completed !== undefined) return Number(applicant.mock_calls_completed || 0);
  const submission = getStaticSubmissions().find((item) => item.applicantId === applicantId);
  return (submission?.mockCalls || []).filter((call) => call.status === "completed").length;
}

function getApplicantScore(applicant: ApplicantRecord) {
  const withAggregates = applicant as ApplicantRecord & { mock_average_score?: number; mockAverageScore?: number };
  return Number(withAggregates.mock_average_score || withAggregates.mockAverageScore || applicant.internal_score || 0);
}

function getCallScore(call: MockCallRecord) {
  const structured = getStructuredOutput(call);
  return Number(
    call.backend_score ||
      call.backendScore ||
      structured?.overall_score ||
      structured?.overallScore ||
      structured?.score ||
      structured?.scorecard?.overall_score ||
      structured?.scorecard?.overallScore ||
      0
  );
}

function getStructuredOutput(call: MockCallRecord) {
  const raw = call.structured_output || call.structuredOutput || null;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return { raw };
    }
  }
  return raw;
}

function extractObjectionMoments(structured: Record<string, any> | null): ObjectionMoment[] {
  if (!structured) return [];
  const candidates = [
    structured.objection_moments,
    structured.objectionMoments,
    structured.candidate_objection_responses,
    structured.candidateObjectionResponses,
    structured.response_review,
    structured.responseReview,
    structured.moments,
    structured.scorecard?.objection_moments,
    structured.scorecard?.objectionMoments,
    structured.scorecard?.moments,
    structured.analysis?.objection_moments,
    structured.analysis?.objectionMoments,
    structured.call_review?.objection_moments,
    structured.callReview?.objectionMoments
  ];
  const rawMoments = candidates.find((value) => Array.isArray(value));
  if (!Array.isArray(rawMoments)) return [];
  return rawMoments.map((item) => ({
    objection: pickString(item, ["objection", "prospect_objection", "prospectObjection", "prospect_line", "prospectLine", "owner_line", "ownerLine", "trigger", "quote"]),
    candidateResponse: pickString(item, ["candidate_response", "candidateResponse", "applicant_response", "applicantResponse", "setter_response", "setterResponse", "response", "reply"]),
    judgment: pickString(item, ["judgment", "judge_note", "judgeNote", "analysis", "feedback", "coaching_note", "coachingNote", "why_it_matters", "whyItMatters"]),
    label: pickString(item, ["label", "category", "objection_type", "objectionType", "skill_label", "skillLabel", "flag"]),
    score: item.score ?? item.response_score ?? item.responseScore ?? item.moment_score ?? item.momentScore,
    timestamp: pickString(item, ["timestamp", "time", "at", "offset"]),
    recommendedMove: pickString(item, ["recommended_move", "recommendedMove", "better_move", "betterMove", "ideal_response", "idealResponse"]),
    advisorLens: pickString(item, ["advisor_lens", "advisorLens", "framework", "sales_lens", "salesLens"])
  }));
}

function pickString(source: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function truncate(value: string, length: number) {
  return value.length > length ? `${value.slice(0, length - 1)}...` : value;
}

function base64ToBlob(base64: string, type: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: type || "application/octet-stream" });
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  const units = ["bytes", "KB", "MB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(seconds?: number) {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  const remaining = Math.round(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

function formatScore(score: number) {
  return score ? `${Math.round(score)}/100` : "";
}

function formatStatusLabel(value: string) {
  if (!value || value === "none") return "None";
  return value
    .split("_")
    .map((part) => (part.length === 1 ? part.toUpperCase() : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join(" ")
    .replace("A Player", "A-Player")
    .replace("B Player", "B-Player");
}

function toCsv(applicants: ApplicantRecord[]) {
  const headers = ["Name", "Preferred name", "Email", "Desired pay", "Availability", "Start date", "Experience", "Status", "Qualification", "Fit status", "Interview", "Submitted"];
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
    formatStatusLabel(a.hiring_stage_status || ""),
    a.interview_status,
    a.submitted_at || ""
  ]);
  return [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}
