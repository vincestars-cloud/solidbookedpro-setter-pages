"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ApplicationFields, ClientMockCallState, MediaEngagementInput, PublicConfig, QualificationStatus } from "@/lib/types";

type Props = { config: PublicConfig };
type CallState = ClientMockCallState & { error?: string; transcript?: Array<Record<string, unknown>> };
type ResultState = { status: QualificationStatus; message: string; calendar: PublicConfig["calendar"] | null } | null;
const applicationSteps = [
  "Tell us about yourself",
  "Understand our sales process",
  "Listen to call and role play",
  "Final questions and schedule interview"
];
const stepTabs = ["Info", "Understand our sales process", "Listen to call and role play", "Final"];
const totalSteps = applicationSteps.length;

const emptyFields: Partial<ApplicationFields> = {
  fullName: "",
  preferredName: "",
  email: "",
  country: "",
  desiredHourly: undefined,
  earliestStartDate: "",
  availableStart: "",
  availableEnd: "",
  vocarooUrl: "",
  crmPlatforms: "",
  appointmentSettingExperience: "",
  industries: "",
  pastMetrics: "",
  resumeFileName: "",
  resumeFileSize: 0,
  salesProcessAcknowledged: false,
  founderVideoAcknowledged: false,
  recordingConsent: false,
  accuracyConfirmation: false
};

const scenarioIntro =
  "You have not received our exact script, and we do not expect you to know company-specific answers. These role plays are designed to evaluate common appointment-setting skills such as communication, confidence, listening, judgment, objection handling, and asking for the next step.";
const staticPagesMode = process.env.NEXT_PUBLIC_STATIC_PAGES_MODE === "1";

export function ApplicationFunnel({ config }: Props) {
  const [applicantId, setApplicantId] = useState("");
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [fields, setFields] = useState<Partial<ApplicationFields>>(emptyFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [saveState, setSaveState] = useState("Not saved yet.");
  const [result, setResult] = useState<ResultState>(null);
  const [submitting, setSubmitting] = useState(false);
  const [micGranted, setMicGranted] = useState(false);
  const [micStatus, setMicStatus] = useState("Test your microphone before starting.");
  const [micLevel, setMicLevel] = useState(0);
  const [callLibrary, setCallLibrary] = useState<MediaEngagementInput[]>(
    config.content.callRecordings.map((call) => ({
      mediaType: "call_recording",
      mediaKey: call.key,
      started: false,
      secondsConsumed: 0,
      percentageConsumed: 0,
      completed: false,
      replayCount: 0,
      pauseCount: 0
    }))
  );
  const [mockCalls, setMockCalls] = useState<CallState[]>([
    { mockCallNumber: 1, status: "not_started" },
    { mockCallNumber: 2, status: "not_started" },
    { mockCallNumber: 3, status: "not_started" }
  ]);
  const [scenarios, setScenarios] = useState<Record<string, string>>({});

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const validationSummaryRef = useRef<HTMLDivElement | null>(null);
  const activeVapi = useRef<any>(null);
  const activeCallNumber = useRef<1 | 2 | 3 | null>(null);
  const callStartedAt = useRef<number>(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const progressPercent = Math.round((currentStep / totalSteps) * 100);
  const tomorrow = useMemo(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split("T")[0];
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("sbp_setter_next_state");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      if (parsed.applicantId) setApplicantId(parsed.applicantId);
      if (parsed.currentStep) {
        setCurrentStep(Math.min(totalSteps, Math.max(1, parsed.currentStep)));
      }
      if (typeof parsed.started === "boolean") setStarted(parsed.started);
      else if (parsed.currentStep) setStarted(true);
      if (parsed.highestStep) setHighestStep(Math.min(totalSteps, Math.max(1, parsed.highestStep)));
      if (parsed.fields) setFields({ ...emptyFields, ...parsed.fields });
      if (parsed.callLibrary) setCallLibrary(parsed.callLibrary);
      if (parsed.mockCalls) setMockCalls(parsed.mockCalls);
      if (Array.isArray(parsed.scenarios)) {
        setScenarios(Object.fromEntries(parsed.scenarios.map((item: { questionKey: string; response: string }) => [item.questionKey, item.response])));
      } else if (parsed.scenarios) {
        setScenarios(parsed.scenarios);
      }
      setSaveState("Restored from this device.");
    } catch {
      localStorage.removeItem("sbp_setter_next_state");
    }
  }, []);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [fields, started, currentStep, highestStep, callLibrary, mockCalls, scenarios]);

  function updateField<K extends keyof ApplicationFields>(key: K, value: ApplicationFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  async function ensureSession(emailValue = fields.email) {
    const email = String(emailValue || "").trim().toLowerCase();
    if (!isValidEmail(email)) return null;
    if (applicantId) return applicantId;
    try {
      const response = await fetch("/api/applications/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json();
      if (response.status === 409) {
        setDuplicateMessage(payload.message);
        setErrors((prev) => ({ ...prev, email: payload.message }));
        return null;
      }
      if (!response.ok) throw new Error("Session API unavailable.");
      setApplicantId(payload.applicantId);
      track("valid_email_entered", { email });
      return payload.applicantId;
    } catch {
      if (!staticPagesMode) return null;
      const localId = crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`;
      setApplicantId(localId);
      return localId;
    }
  }

  async function checkDuplicate() {
    const email = String(fields.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return false;
    try {
      const response = await fetch("/api/applications/check-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const payload = await response.json();
      setDuplicateMessage(payload.exists ? payload.message : "");
      if (payload.exists) setErrors((prev) => ({ ...prev, email: payload.message }));
      return Boolean(payload.exists);
    } catch {
      if (!staticPagesMode) return false;
      const emails = JSON.parse(localStorage.getItem("sbp_setter_static_emails") || "[]") as string[];
      const exists = emails.includes(email);
      const message =
        "An application has already been started or submitted using this email address. Please use the same device to continue, or contact us if you need assistance.";
      setDuplicateMessage(exists ? message : "");
      if (exists) setErrors((prev) => ({ ...prev, email: message }));
      return exists;
    }
  }

  function scheduleSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => autosave(), 350);
  }

  async function autosave() {
    const state = {
      applicantId,
      started,
      currentStep,
      highestStep,
      fields,
      callLibrary,
      mockCalls,
      scenarios: config.content.scenarioQuestions.map((q) => ({ questionKey: q.key, response: scenarios[q.key] || "" }))
    };
    localStorage.setItem("sbp_setter_next_state", JSON.stringify(state));
    if (!applicantId) return;
    if (staticPagesMode) {
      setSaveState("Saved on this device.");
      return;
    }
    await fetch("/api/applications/autosave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state)
    }).catch(() => null);
    setSaveState("Saved just now.");
  }

  async function track(eventType: string, metadata: Record<string, unknown> = {}) {
    if (!applicantId && eventType !== "application_started") return;
    if (staticPagesMode) return;
    await fetch("/api/applications/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantId, eventType, step: currentStep, metadata })
    }).catch(() => null);
  }

  async function goToStep(step: number) {
    const ok = await validateStep(currentStep);
    if (!ok) {
      focusValidationSummary();
      return;
    }
    setCurrentStep(step);
    setHighestStep((prev) => Math.max(prev, step));
    track("step_completed", { step: currentStep, nextStep: step });
    track("step_opened", { step });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function beginApplication() {
    setStarted(true);
    setCurrentStep((step) => Math.max(1, step));
    setHighestStep((step) => Math.max(1, step));
    track("application_started");
  }

  function returnToCover() {
    const state = {
      applicantId,
      started: false,
      currentStep,
      highestStep,
      fields,
      callLibrary,
      mockCalls,
      scenarios: config.content.scenarioQuestions.map((q) => ({ questionKey: q.key, response: scenarios[q.key] || "" }))
    };
    localStorage.setItem("sbp_setter_next_state", JSON.stringify(state));
    setStarted(false);
    setResult(null);
    setSaveState("Saved on this device.");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function validateStep(step: number) {
    const nextErrors: Record<string, string> = {};
    if (step === 1) {
      const required: Array<keyof ApplicationFields> = [
        "fullName",
        "preferredName",
        "email",
        "desiredHourly",
        "earliestStartDate",
        "availableStart",
        "availableEnd",
        "vocarooUrl",
        "crmPlatforms",
        "appointmentSettingExperience",
        "industries",
        "pastMetrics"
      ];
      required.forEach((field) => {
        if (!String(fields[field] ?? "").trim()) nextErrors[field] = "Required.";
      });
      if (fields.email && !isValidEmail(String(fields.email))) nextErrors.email = "Enter a valid email address.";
      if (fields.vocarooUrl && !/^https?:\/\/(www\.)?(voca\.ro|vocaroo\.com)\//i.test(String(fields.vocarooUrl))) {
        nextErrors.vocarooUrl = "Use a valid Vocaroo or voca.ro URL.";
      }
      if (fields.earliestStartDate && fields.earliestStartDate < tomorrow) nextErrors.earliestStartDate = "Choose today or a future date.";
      if (!Number.isFinite(Number(fields.desiredHourly)) || Number(fields.desiredHourly) <= 0) {
        nextErrors.desiredHourly = "Desired pay must be a dollar amount.";
      }
      if (!validAvailability(String(fields.availableStart || ""), String(fields.availableEnd || ""))) {
        nextErrors.availableEnd = "Choose a valid start and end time.";
      }
      const duplicate = await checkDuplicate();
      if (duplicate) nextErrors.email = duplicateMessage || "This email has already been used.";
      if (!applicantId) await ensureSession();
    }
    if (step === 2 && !fields.salesProcessAcknowledged) nextErrors.salesProcessAcknowledged = "Confirm where the setter fits.";
    if (step === 3 && mockCalls.some((call) => call.status !== "completed")) nextErrors.mockCalls = "Complete all three mock calls.";
    if (step === 4) {
      config.content.scenarioQuestions.forEach((question) => {
        if (!String(scenarios[question.key] || "").trim()) nextErrors[question.key] = "Required.";
      });
      if (!fields.accuracyConfirmation) nextErrors.accuracyConfirmation = "Accuracy confirmation is required.";
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  }

  async function requestMicrophone() {
    try {
      setMicStatus("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicGranted(true);
      setMicStatus("Microphone permission granted.");
      track("microphone_permission_granted");
      const context = new AudioContext();
      const analyser = context.createAnalyser();
      const source = context.createMediaStreamSource(stream);
      const data = new Uint8Array(analyser.frequencyBinCount);
      source.connect(analyser);
      const started = Date.now();
      const loop = () => {
        analyser.getByteFrequencyData(data);
        setMicLevel(Math.min(100, (data.reduce((a, b) => a + b, 0) / data.length) * 2.5));
        if (Date.now() - started < 3500) requestAnimationFrame(loop);
        else {
          stream.getTracks().forEach((track) => track.stop());
          context.close();
          setMicLevel(0);
        }
      };
      loop();
      return true;
    } catch (error) {
      setMicGranted(false);
      setMicStatus("Microphone access was blocked. Allow access in your browser settings, then test again.");
      track("microphone_permission_rejected", { message: error instanceof Error ? error.message : String(error) });
      return false;
    }
  }

  async function startMockCall(mockCallNumber: 1 | 2 | 3) {
    const granted = micGranted || await requestMicrophone();
    if (!granted) return;
    if (activeCallNumber.current) return;
    const assistantId = config.vapi.assistantIds[String(mockCallNumber) as "1" | "2" | "3"];
    if (!config.vapi.publicKey || !assistantId) {
      if (staticPagesMode) {
        activeCallNumber.current = mockCallNumber;
        callStartedAt.current = Date.now();
        updateMock(mockCallNumber, { status: "live", error: "", startedAt: new Date().toISOString(), vapiCallId: `static_mock_${mockCallNumber}_${Date.now()}` });
        startTimer(mockCallNumber);
        window.setTimeout(() => completeCall(mockCallNumber, "static_pages_simulated_call"), 5000);
        return;
      }
      updateMock(mockCallNumber, { status: "failed", error: "Vapi is not configured yet." });
      return;
    }
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      activeCallNumber.current = mockCallNumber;
      callStartedAt.current = Date.now();
      updateMock(mockCallNumber, { status: "connecting", error: "" });
      track("mock_call_started", { mockCallNumber });
      const vapi = new Vapi(config.vapi.publicKey);
      activeVapi.current = vapi;
      vapi.on("call-start", () => {
        updateMock(mockCallNumber, { status: "live", startedAt: new Date().toISOString() });
        startTimer(mockCallNumber);
      });
      vapi.on("message", (message: any) => {
        if (message?.type === "transcript") {
          setMockCalls((prev) =>
            prev.map((call) =>
              call.mockCallNumber === mockCallNumber
                ? { ...call, transcript: [...(call.transcript || []), message] }
                : call
            )
          );
        }
      });
      vapi.on("call-end", () => completeCall(mockCallNumber, "vapi_call_end"));
      vapi.on("error", (error: Error) => failCall(mockCallNumber, error.message));
      const call = await vapi.start(assistantId, {
        variableValues: {
          application_id: applicantId,
          preferred_name: fields.preferredName || "",
          mock_call_number: String(mockCallNumber)
        },
        metadata: {
          application_id: applicantId,
          mock_call_number: mockCallNumber,
          source: "solidbooked-pro-setter-application"
        }
      });
      if ((call as any)?.id) updateMock(mockCallNumber, { vapiCallId: (call as any).id });
    } catch (error) {
      failCall(mockCallNumber, error instanceof Error ? error.message : "The call could not start.");
    }
  }

  async function endMockCall(mockCallNumber: 1 | 2 | 3) {
    if (activeCallNumber.current !== mockCallNumber) return;
    updateMock(mockCallNumber, { status: "ending" });
    try {
      await activeVapi.current?.stop();
    } catch {
      completeCall(mockCallNumber, "manual_end_fallback");
    }
  }

  function startTimer(mockCallNumber: 1 | 2 | 3) {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      updateMock(mockCallNumber, { durationSeconds: Math.round((Date.now() - callStartedAt.current) / 1000) });
    }, 500);
  }

  function completeCall(mockCallNumber: 1 | 2 | 3, endedReason: string) {
    if (timer.current) clearInterval(timer.current);
    activeCallNumber.current = null;
    activeVapi.current = null;
    updateMock(mockCallNumber, {
      status: "completed",
      endedAt: new Date().toISOString(),
      endedReason,
      durationSeconds: Math.round((Date.now() - callStartedAt.current) / 1000)
    });
    track("mock_call_completed", { mockCallNumber, endedReason });
  }

  function failCall(mockCallNumber: 1 | 2 | 3, error: string) {
    if (timer.current) clearInterval(timer.current);
    activeCallNumber.current = null;
    activeVapi.current = null;
    updateMock(mockCallNumber, { status: "failed", error });
    track("mock_call_failed", { mockCallNumber, error });
  }

  function updateMock(mockCallNumber: 1 | 2 | 3, patch: Partial<CallState>) {
    setMockCalls((prev) => prev.map((call) => (call.mockCallNumber === mockCallNumber ? { ...call, ...patch } : call)));
  }

  async function submit() {
    const ok = await validateStep(4);
    if (!ok || !applicantId) {
      focusValidationSummary();
      return;
    }
    setSubmitting(true);
    const payload = {
      applicantId,
      currentStep,
      highestStep,
      fields,
      callLibrary,
      mockCalls,
      scenarios: config.content.scenarioQuestions.map((q) => ({ questionKey: q.key, response: scenarios[q.key] || "" }))
    };
    try {
      const response = await fetch("/api/applications/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const body = await response.json();
      setSubmitting(false);
      if (!response.ok) {
        setErrors({ submit: body.message || body.error || "Submission failed." });
        return;
      }
      setResult({ status: body.status, message: body.message, calendar: body.calendar });
      localStorage.removeItem("sbp_setter_next_state");
      track("application_submitted", { status: body.status });
    } catch {
      setSubmitting(false);
      if (!staticPagesMode) {
        setErrors({ submit: "Submission failed." });
        return;
      }
      const email = String(fields.email || "").trim().toLowerCase();
      const emails = JSON.parse(localStorage.getItem("sbp_setter_static_emails") || "[]") as string[];
      if (!emails.includes(email)) localStorage.setItem("sbp_setter_static_emails", JSON.stringify([...emails, email]));
      const submissions = JSON.parse(localStorage.getItem("sbp_setter_static_submissions") || "[]") as unknown[];
      localStorage.setItem("sbp_setter_static_submissions", JSON.stringify([...submissions, { ...payload, submittedAt: new Date().toISOString() }]));
      setResult({
        status: "manual_review",
        message: "Thank you for completing your application. We will review your submission and contact you if we decide to move forward.",
        calendar: null
      });
      localStorage.removeItem("sbp_setter_next_state");
    }
  }

  function renderError(key: string) {
    return errors[key] ? <span className="error-text inline-error" role="alert">{errors[key]}</span> : <span className="error-text" />;
  }

  function focusValidationSummary() {
    window.setTimeout(() => {
      validationSummaryRef.current?.focus();
      validationSummaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 0);
  }

  return (
    <div>
      <header className="topbar">
        <div className="container topbar-inner">
          <button className="brand brand-button" type="button" onClick={returnToCover}>
            <span className="brand-mark">✓</span>
            <span>SolidBooked Pro</span>
          </button>
          <span className="topbar-meta">Appointment Setter Application</span>
        </div>
      </header>

      <main>
        {!started && !result ? (
          <section className="cover">
            <div className="container cover-stack">
              <header className="cover-headline">
                <span className="eyebrow"><span className="dot" /> Remote opportunity</span>
                <h1>Apply for Appointment Setter role.</h1>
                <div className="role-tags" aria-label="Role details">
                  <span className="role-tag">Remote</span>
                  <span className="role-tag">Eastern Time hours</span>
                  <span className="role-tag">Paid training</span>
                  <span className="role-tag">Advancement path</span>
                </div>
              </header>

              <nav className="application-nav" aria-label="Application navigation">
                <ol>
                  {applicationSteps.map((item, index) => (
                    <li key={item}>
                      <span className="num">{index + 1}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ol>
                <div className="application-nav-footer">
                  <span>Set aside about 10 minutes and use a device with a working microphone.</span>
                  <button className="btn btn-primary" onClick={beginApplication}>Begin application</button>
                </div>
              </nav>

              <section className="copy-block" aria-label="Role overview">
                <div className="cover-panel lead-panel">
                  <p className="kicker">What we do</p>
                  <h2>We help business owners get more customers and clients.</h2>
                  <div className="path-grid">
                    <article>
                      <span>Low Ticket</span>
                      <p>We build them a website and get them ranked online.</p>
                    </article>
                    <article>
                      <span>High Ticket</span>
                      <p>We send them qualified customers. Our main guarantee is if the customer does not show up, they do not pay for the lead.</p>
                    </article>
                  </div>
                </div>

                <div className="cover-columns">
                  <article className="cover-panel">
                    <p className="kicker">What you will do</p>
                    <p>We have both warm and cold business owners that need to be contacted and scheduled on the calendar.</p>
                    <ul className="clean-list">
                      <li><strong>Warm prospect (40%):</strong> They received something from us and raised their hand that they are considering our service.</li>
                      <li><strong>Cold prospect (60%):</strong> We identified they need our service, like a business with a website that is not working or a business that is not getting enough customers, but they have not opted in yet.</li>
                    </ul>
                  </article>
                  <article className="cover-panel">
                    <p className="kicker">Who succeeds here</p>
                    <ul className="check-list">
                      <li>Comfortable speaking with cold and warm prospects all day.</li>
                      <li>Reliable, coachable and consistent with follow-up.</li>
                      <li>Can build rapport and is ok going off script.</li>
                      <li>Has previous experience in a similar role.</li>
                    </ul>
                  </article>
                </div>

                <div className="cover-panel not-fit">
                  <p className="kicker">This is not for you if</p>
                  <ul className="clean-list two-up">
                    <li>You dislike phone conversations or avoid follow-up.</li>
                    <li>You have no rapport or sales training.</li>
                  </ul>
                </div>
              </section>

              <section className="faq-block" aria-label="Frequently asked questions">
                <h2>FAQ</h2>
                <div className="faq-list">
                  <details>
                    <summary>What will I be doing day to day?</summary>
                    <p>You will contact warm and cold business owners, build rapport, answer general questions, update the CRM, and book qualified appointments for the owner or closer.</p>
                  </details>
                  <details>
                    <summary>Is this cold calling?</summary>
                    <p>About 40% are warm prospects who already raised their hand. About 60% are cold prospects we identified as likely needing help getting more customers.</p>
                  </details>
                  <details>
                    <summary>What kind of prospects will I call?</summary>
                    <p>You will speak with business owners who have received a message from us. Some conversations begin from expressed interest; others may require you to create interest and explain why you are calling.</p>
                  </details>
                  <details>
                    <summary>What does training look like?</summary>
                    <p>Training includes a paid role-play session, live-call coaching, and hands-on use of the CRM, dialer, and time-tracking tools.</p>
                  </details>
                  <details>
                    <summary>What tools will I use?</summary>
                    <p>You should expect to use a CRM, a browser-based dialer, and Hubstaff. The exact setup and login process are covered during onboarding.</p>
                  </details>
                  <details>
                    <summary>Do I work weekends?</summary>
                    <p>The standard schedule and any optional weekend needs will be confirmed during the interview.</p>
                  </details>
                  <details>
                    <summary>Do I close the sale or collect payment?</summary>
                    <p>No. Your job is to build rapport, answer approved general questions, send the correct details, and book a qualified presentation. The owner handles the complete presentation and payment.</p>
                  </details>
                  <details>
                    <summary>What should I have ready before starting?</summary>
                    <p>Use a quiet device with a working microphone and have your resume, experience, availability, desired hourly pay, Vocaroo link, and past metrics ready.</p>
                  </details>
                </div>
              </section>
            </div>
          </section>
        ) : (
          <section className="section application-stage" id="application">
            <div className="container">
              {!result && (
              <div className="application-card">
                <div className="progress-panel" aria-live="polite">
                  <div className="progress-head"><span>Step {currentStep} of {totalSteps}</span><span>{progressPercent}% complete · {saveState}</span></div>
                  <div className="progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}><div className="progress-fill" style={{ width: `${progressPercent}%` }} /></div>
                  <div className="step-tabs">
                    {applicationSteps.map((_, index) => {
                      const step = index + 1;
                      return <button key={step} className={`step-tab ${step === currentStep ? "active" : ""}`} type="button" disabled={step > highestStep} onClick={() => step <= highestStep && setCurrentStep(step)}> {step} <span>{stepTabs[index]}</span></button>;
                    })}
                  </div>
                </div>

                <div className="form-shell">
                  {Object.values(errors).filter(Boolean).length > 0 && (
                    <div className="validation-summary" ref={validationSummaryRef} tabIndex={-1} role="alert" aria-live="assertive">
                      <strong>Please fix the highlighted items before continuing.</strong>
                      <ul>
                        {Object.entries(errors).filter(([, message]) => Boolean(message)).map(([key, message]) => (
                          <li key={key}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {currentStep === 1 && (
                    <section className="form-step active">
                      <div className="step-heading"><div><h2>Tell us about yourself.</h2><p>Your answers save as you go. Your email creates the application session and is checked for duplicates early.</p></div></div>
                      <div className="grid compact-form">
                        <Field id="fullName" label="Full name" value={fields.fullName} onChange={(v) => updateField("fullName", v)} error={renderError("fullName")} />
                        <Field id="preferredName" label="Preferred name" value={fields.preferredName} onChange={(v) => updateField("preferredName", v)} error={renderError("preferredName")} />
                        <Field id="email" label="Email address" type="email" value={fields.email} onBlur={() => ensureSession().then(checkDuplicate)} onChange={(v) => updateField("email", v)} error={renderError("email")} />
                        <Field id="desiredHourly" label="Desired hourly pay in USD" type="number" value={fields.desiredHourly} onChange={(v) => updateField("desiredHourly", Number(v) as any)} error={renderError("desiredHourly")} compact />
                        <Field id="earliestStartDate" label="Earliest start date" type="date" min={tomorrow} value={fields.earliestStartDate} onChange={(v) => updateField("earliestStartDate", v)} error={renderError("earliestStartDate")} compact />
                        <div className={`field availability-field ${errors.availableEnd ? "has-error" : ""}`}>
                          <span className="legend-label">Exact availability in Eastern Time</span>
                          <div className="availability-row">
                            <select className="control" aria-label="Available start time" value={fields.availableStart || ""} onChange={(e) => updateField("availableStart", e.target.value)}>
                              <TimeOptions />
                            </select>
                            <span>to</span>
                            <select className="control" aria-label="Available end time" value={fields.availableEnd || ""} onChange={(e) => updateField("availableEnd", e.target.value)}>
                              <TimeOptions />
                            </select>
                          </div>
                          <span className="field-help">Enter the time window you can consistently work, already converted to U.S. Eastern Time.</span>
                          {renderError("availableEnd")}
                        </div>
                        <Field id="vocarooUrl" label="Vocaroo recording URL" type="url" value={fields.vocarooUrl} onChange={(v) => updateField("vocarooUrl", v)} error={renderError("vocarooUrl")} helper="Paste your voice-recording link." />
                        <Textarea id="crmPlatforms" label="What CRM or scheduling platforms have you used?" value={fields.crmPlatforms} onChange={(v) => updateField("crmPlatforms", v)} error={renderError("crmPlatforms")} full={false} compact />
                        <Textarea id="appointmentSettingExperience" label="What appointment-setting or cold-calling experience have you had?" value={fields.appointmentSettingExperience} onChange={(v) => updateField("appointmentSettingExperience", v)} error={renderError("appointmentSettingExperience")} full={false} compact />
                        <Textarea id="industries" label="What industries or offers have you worked with?" value={fields.industries} onChange={(v) => updateField("industries", v)} error={renderError("industries")} full={false} compact />
                        <Textarea id="pastMetrics" label="What are some of the past metrics that you had?" value={fields.pastMetrics} onChange={(v) => updateField("pastMetrics", v)} error={renderError("pastMetrics")} helper="Include specific numbers when possible, such as calls made, conversations, appointments booked, show rate, close rate, or quota performance." />
                        <ResumeUpload fileName={fields.resumeFileName || ""} fileSize={fields.resumeFileSize || 0} onChange={(file) => {
                          updateField("resumeFileName", (file?.name || "") as any);
                          updateField("resumeFileSize", (file?.size || 0) as any);
                        }} />
                      </div>
                      {duplicateMessage && <p className="notice" role="alert">{duplicateMessage}</p>}
                      <div className="actions"><span /><button className="btn btn-primary" onClick={() => goToStep(2)}>Continue</button></div>
                    </section>
                  )}

                  {currentStep === 2 && (
                    <section className="form-step active">
                      <div className="step-heading"><div><h2>Understand our sales process.</h2><p>Here is the lead roadmap and where the setter fits into the process.</p></div></div>
                      <div className="roadmap">
                        <ol className="roadmap-list">
                          {[
                            "We find businesses that need our services.",
                            "We create the solution and send it to the business.",
                            "The business owner responds back with a message signaling interest.",
                            "You call, build rapport, and answer general questions.",
                            "You update their details in the CRM and it will send information about us automatically.",
                            "You book a time that they will be able to review the site with us and make any changes they need.",
                            "The owner or closer presents the offer and collects payment."
                          ].map((item, index) => {
                            const setterStep = item.startsWith("You ");
                            return (
                              <li className={setterStep ? "setter-step" : ""} key={item}>
                                <span className="num">{index + 1}</span>
                                <span>{setterStep && <em className="setter-badge">Your role</em>}{item}</span>
                              </li>
                            );
                          })}
                        </ol>
                      </div>
                      <div className="metrics-comp">
                        <div className="metrics-grid">
                          <article>
                            <span>Metric</span>
                            <strong># of Appointments Booked per Hour Worked</strong>
                            <p>You should be able to book a minimum of 2 qualified appointments every hour you work.</p>
                          </article>
                          <article>
                            <span>Metric</span>
                            <strong>Appointment Show Rate %</strong>
                            <p>You should maintain an appointment show rate of 65%.</p>
                          </article>
                        </div>
                        <div className="career-path-card">
                          <div className="career-path-heading">
                            <span>Career progression path</span>
                            <strong>From Website Setter to Lead Service Closer</strong>
                            <p>We want you to be able to move from our low ticket Website Setter to our high ticket Lead Service Closer.</p>
                          </div>
                          <div className="comp-path" aria-label="Career progression path">
                            {[
                              {
                                role: "Website Appt Setter",
                                note: "Where you start",
                                pay: "Hourly + $20 per Qualified Appointment",
                                earning: "Minimum Earning: $2,100 USD per month"
                              },
                              {
                                role: "Lead Service Setter",
                                note: "",
                                pay: "Hourly + $100 per Qualified Appointment",
                                earning: "Minimum Earning: $6,600 USD per month"
                              },
                              {
                                role: "Lead Service Closer",
                                note: "",
                                pay: "Hourly + $250 per Sale",
                                earning: "Minimum Earning: $12,800 USD per month"
                              }
                            ].map((item, index) => (
                              <div className="comp-step" key={item.role}>
                                <span>{index + 1}</span>
                                <strong className="comp-role">{item.role}</strong>
                                {item.note && <em className="comp-note">{item.note}</em>}
                                <p className="comp-pay">{item.pay}</p>
                                <p className="comp-earning">{item.earning}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                      <Checkbox id="salesProcessAcknowledged" checked={Boolean(fields.salesProcessAcknowledged)} onChange={(v) => updateField("salesProcessAcknowledged", v as any)} label="I understand where the appointment setter fits into the process." error={errors.salesProcessAcknowledged} />
                      <StepActions back={() => setCurrentStep(1)} next={() => goToStep(3)} />
                    </section>
                  )}

                  {currentStep === 3 && (
                    <section className="form-step active">
                      <div className="step-heading"><div><h2>Listen to call and role play.</h2><p>Review the examples if you want, then complete the three browser-based role plays.</p></div></div>
                      <div className="media-grid">
                        {config.content.callRecordings.map((call, index) => (
                          <article className="audio-card" key={call.key}>
                            <h3>{call.title}</h3>
                            <p>{call.description}</p>
                            <span className="media-meta">Call Duration: {call.durationLabel}</span>
                            {call.url ? <audio controls src={call.url} onPlay={() => updateLibrary(index, { started: true, replayCount: callLibrary[index].started ? callLibrary[index].replayCount + 1 : 0 })} onTimeUpdate={(event) => {
                              const audio = event.currentTarget;
                              updateLibrary(index, { secondsConsumed: Math.round(audio.currentTime), percentageConsumed: audio.duration ? Math.max(callLibrary[index].percentageConsumed, Math.round((audio.currentTime / audio.duration) * 100)) : 0 });
                            }} onEnded={() => updateLibrary(index, { completed: true, percentageConsumed: 100 })} /> : <div className="notice">Audio player slot ready. Add URL in configuration.</div>}
                          </article>
                        ))}
                      </div>
                      <div className="mock-intro"><strong>Before the mock calls</strong><p>{scenarioIntro}</p></div>
                      <div className="mic-panel">
                        <strong>Microphone test</strong>
                        <p>{micStatus}</p>
                        <div className="meter"><span style={{ width: `${micLevel}%` }} /></div>
                        <button className="btn btn-secondary btn-small" type="button" onClick={requestMicrophone}>Test microphone</button>
                      </div>
                      <div className="mock-grid">
                        {mockCalls.map((call, index) => {
                          const locked = index > 0 && mockCalls[index - 1].status !== "completed";
                          const live = call.status === "live" || call.status === "connecting" || call.status === "ending";
                          return (
                            <article className={`mock-card ${locked ? "locked" : ""} ${live ? "live" : ""}`} key={call.mockCallNumber}>
                              <h3>Mock Call {call.mockCallNumber}</h3>
                              <p>You have introduced yourself and explained why you are calling. Continue the conversation from here.</p>
                              <p className="status-line">Status: {call.status.replaceAll("_", " ")}</p>
                              <div className="timer">{formatDuration(call.durationSeconds || 0)}</div>
                              {call.error && <p className="error-text" style={{ display: "block" }}>{call.error}</p>}
                              <div className="actions">
                                <button className="btn btn-success btn-small" disabled={locked || live || call.status === "completed"} onClick={() => startMockCall(call.mockCallNumber)}>Start call</button>
                                <button className="btn btn-secondary btn-small" disabled={!live} onClick={() => endMockCall(call.mockCallNumber)}>End call</button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      {errors.mockCalls && <p className="notice" role="alert">{errors.mockCalls}</p>}
                      <StepActions back={() => setCurrentStep(2)} next={() => goToStep(4)} />
                    </section>
                  )}

                  {currentStep === 4 && (
                    <section className="form-step active">
                      <div className="step-heading"><div><h2>Final questions and schedule interview.</h2><p>Answer in your own words.</p></div></div>
                      <div className="grid">
                        {config.content.scenarioQuestions.map((question) => (
                          <Textarea key={question.key} id={question.key} label={question.prompt} value={scenarios[question.key] || ""} onChange={(value) => setScenarios((prev) => ({ ...prev, [question.key]: value }))} error={renderError(question.key)} />
                        ))}
                      </div>
                      <Checkbox id="accuracyConfirmation" checked={Boolean(fields.accuracyConfirmation)} onChange={(v) => updateField("accuracyConfirmation", v as any)} label="I confirm that the information and results I provided are accurate." error={errors.accuracyConfirmation} />
                      {errors.submit && <p className="notice" role="alert">{errors.submit}</p>}
                      <div className="actions"><button className="btn btn-secondary" onClick={() => setCurrentStep(3)}>Back</button><button className="btn btn-primary" disabled={submitting} onClick={submit}>{submitting ? "Submitting..." : "Submit application"}</button></div>
                    </section>
                  )}
                </div>
              </div>
            )}

            <section className={`result-card ${result ? "show" : ""}`}>
              {result?.status === "qualified" ? (
                <>
                  <h2>Congratulations — based on your application, you seem to be a strong potential fit for the role.</h2>
                  {result.calendar?.embedUrl ? <iframe className="calendar-frame" title="Schedule your interview" src={result.calendar.embedUrl} onLoad={() => track("calendar_viewed")} /> : <div className="notice">Interview calendar is ready to connect. Add the provider embed URL in configuration.</div>}
                  {result.calendar?.externalUrl && <a className="btn btn-primary" href={result.calendar.externalUrl} target="_blank" rel="noreferrer">Open interview calendar</a>}
                </>
              ) : (
                <>
                  <h2>Thank you for completing your application.</h2>
                  <p>We will review your submission and contact you if we decide to move forward.</p>
                </>
              )}
            </section>

            </div>
          </section>
        )}
      </main>
    </div>
  );

  function updateLibrary(index: number, patch: Partial<MediaEngagementInput>) {
    setCallLibrary((prev) => prev.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)));
  }
}

function Field({ id, label, value, onChange, error, type = "text", full = false, helper, min, onBlur, compact = false }: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: any) => void;
  error: React.ReactNode;
  type?: string;
  full?: boolean;
  helper?: string;
  min?: string;
  onBlur?: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`field ${full ? "full" : ""} ${compact ? "compact-field" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input className="control" id={id} name={id} type={type} min={min} value={String(value ?? "")} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} aria-describedby={`${id}-help ${id}-error`} />
      {helper && <span className="field-help" id={`${id}-help`}>{helper}</span>}
      <span id={`${id}-error`}>{error}</span>
    </div>
  );
}

function Textarea({ id, label, value, onChange, error, helper, full = true, compact = false }: {
  id: string;
  label: string;
  value: unknown;
  onChange: (value: string) => void;
  error: React.ReactNode;
  helper?: string;
  full?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={`field ${full ? "full" : ""} ${compact ? "compact-textarea" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <textarea className="control" id={id} name={id} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} aria-describedby={`${id}-help ${id}-error`} />
      {helper && <span className="field-help" id={`${id}-help`}>{helper}</span>}
      <span id={`${id}-error`}>{error}</span>
    </div>
  );
}

function ResumeUpload({ fileName, fileSize, onChange }: {
  fileName: string;
  fileSize: number;
  onChange: (file: File | null) => void;
}) {
  return (
    <div className="field compact-field resume-field">
      <label htmlFor="resumeUpload">Resume</label>
      <label className="resume-upload" htmlFor="resumeUpload">
        <span>{fileName ? "Replace resume" : "Upload resume"}</span>
        <input
          id="resumeUpload"
          name="resumeUpload"
          type="file"
          accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
        />
      </label>
      {fileName ? (
        <span className="resume-file">{fileName} {fileSize ? `(${formatFileSize(fileSize)})` : ""}</span>
      ) : (
        <span className="field-help">PDF, DOC, or DOCX preferred.</span>
      )}
    </div>
  );
}

function Checkbox({ id, checked, onChange, label, error }: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  error?: string;
}) {
  return (
    <div className="field full">
      <div className="checkbox-card">
        <input id={id} type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <label htmlFor={id}>{label}</label>
      </div>
      {error && <span className="error-text" style={{ display: "block" }}>{error}</span>}
    </div>
  );
}

function StepActions({ back, next }: { back: () => void; next: () => void }) {
  return <div className="actions"><button className="btn btn-secondary" onClick={back}>Back</button><button className="btn btn-primary" onClick={next}>Continue</button></div>;
}

function TimeOptions() {
  const options = [];
  for (let minutes = 6 * 60; minutes <= 22 * 60; minutes += 30) {
    const h24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const suffix = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    const value = `${String(h24).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
    options.push(<option value={value} key={value}>{h12}:{String(mins).padStart(2, "0")} {suffix} ET</option>);
  }
  return <><option value="">Select time</option>{options}</>;
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validAvailability(start: string, end: string) {
  if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) return false;
  return start < end;
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 KB";
  const units = ["bytes", "KB", "MB"];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}
