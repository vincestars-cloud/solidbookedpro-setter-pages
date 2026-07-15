"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { setterBridgeRequest, setterBridgeUrl } from "@/lib/clientBridge";
import type { ApplicationFields, ClientMockCallState, MediaEngagementInput, PublicConfig, QualificationStatus } from "@/lib/types";

type Props = { config: PublicConfig };
type CallState = ClientMockCallState & { error?: string; transcript?: Array<Record<string, unknown>> };
type ResultState = { status: QualificationStatus; message: string; calendar: PublicConfig["calendar"] | null } | null;
type ApplicantLocation = {
  city?: string;
  region?: string;
  country?: string;
  timezone?: string;
  source?: string;
};
const applicationSteps = [
  "Tell us about yourself",
  "Understand our sales process",
  "Listen to actual call and role play",
  "See what your first day looks like & schedule phone interview"
];
const stepTabs = ["Info", "Understand our sales process", "Listen to actual call and role play", "First day"];
const totalSteps = applicationSteps.length;
const mockCallSetups: Record<1 | 2 | 3, string> = {
  1: "Once you click start call, you’re going to hear a scenario from the prospect and your job is just to respond to how you would if you heard this on a call.",
  2: "You’re about to hear a different scenario that you will hear on calls and your job is just to respond to how you would if you heard this on a call.",
  3: "This was a prospect who told you to “Send more information” it’s been several days later and you’re following up with them, how do you now get them to agree to an appointment."
};

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
  resumeFileType: "",
  salesProcessAcknowledged: false,
  founderVideoAcknowledged: false,
  recordingConsent: false,
  accuracyConfirmation: false
};

const scenarioIntro =
  "You have not received our exact script, and we do not expect you to know company-specific answers. These role plays are designed to evaluate common appointment-setting skills such as communication, confidence, listening, judgment, objection handling, and asking for the next step.";
const staticPagesMode = process.env.NEXT_PUBLIC_STATIC_PAGES_MODE === "1";
const duplicateApplicationMessage =
  "An application has already been started or submitted using this email address. Please use the same device to continue, or contact us if you need assistance.";
const postScheduleVideoUrl = "/media/appt_setter_0_final.mp4";
const applicationAiScoreWebhook =
  process.env.NEXT_PUBLIC_SETTER_APPLICATION_AI_SCORE_WEBHOOK ||
  "https://n8n.americanlifeteam.com/webhook/solidbooked-setter-application-ai-score";
const initialPostScheduleVideo: MediaEngagementInput = {
  mediaType: "post_schedule_video",
  mediaKey: "appt_setter_0",
  started: false,
  secondsConsumed: 0,
  percentageConsumed: 0,
  completed: false,
  replayCount: 0,
  pauseCount: 0
};

export function ApplicationFunnel({ config }: Props) {
  const [applicantId, setApplicantId] = useState("");
  const [started, setStarted] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [highestStep, setHighestStep] = useState(1);
  const [fields, setFields] = useState<Partial<ApplicationFields>>(emptyFields);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [duplicateMessage, setDuplicateMessage] = useState("");
  const [saveState, setSaveState] = useState("Not saved yet.");
  const [resumeUploadState, setResumeUploadState] = useState("");
  const [result, setResult] = useState<ResultState>(null);
  const [interviewScheduled, setInterviewScheduled] = useState(false);
  const [interviewScheduleState, setInterviewScheduleState] = useState("");
  const [postScheduleVideo, setPostScheduleVideo] = useState<MediaEngagementInput>(initialPostScheduleVideo);
  const [applicantLocation, setApplicantLocation] = useState<ApplicantLocation | null>(null);
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
  const callStartInProgress = useRef(false);
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
      if (parsed.location) setApplicantLocation(parsed.location);
      if (parsed.callLibrary) {
        const savedMedia = Array.isArray(parsed.callLibrary) ? parsed.callLibrary : [];
        const savedCalls = savedMedia.filter((item: MediaEngagementInput) => item.mediaType === "call_recording");
        const savedPostVideo = savedMedia.find((item: MediaEngagementInput) => item.mediaType === "post_schedule_video");
        if (savedCalls.length) setCallLibrary(savedCalls);
        if (savedPostVideo) setPostScheduleVideo({ ...initialPostScheduleVideo, ...savedPostVideo });
      }
      if (parsed.postScheduleVideo) setPostScheduleVideo({ ...initialPostScheduleVideo, ...parsed.postScheduleVideo });
      if (typeof parsed.interviewScheduled === "boolean") setInterviewScheduled(parsed.interviewScheduled);
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
    const cached = localStorage.getItem("sbp_setter_location");
    if (cached) {
      try {
        setApplicantLocation(JSON.parse(cached));
        return;
      } catch {
        localStorage.removeItem("sbp_setter_location");
      }
    }
    captureApproxLocation();
  }, []);

  useEffect(() => {
    scheduleSave();
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [fields, started, currentStep, highestStep, callLibrary, postScheduleVideo, interviewScheduled, mockCalls, scenarios, applicantLocation]);

  function updateField<K extends keyof ApplicationFields>(key: K, value: ApplicationFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  }

  function hydrateServerState(state: Record<string, any>) {
    const nextStep = Number(state.currentStep || 1);
    const nextHighestStep = Number(state.highestStep || state.currentStep || 1);
    if (state.fields) setFields((prev) => ({ ...prev, ...state.fields }));
    if (state.location) setApplicantLocation(state.location);
    if (Array.isArray(state.callLibrary)) {
      const savedCalls = state.callLibrary.filter((item: MediaEngagementInput) => item.mediaType === "call_recording");
      const savedPostVideo = state.callLibrary.find((item: MediaEngagementInput) => item.mediaType === "post_schedule_video");
      if (savedCalls.length) setCallLibrary(savedCalls);
      if (savedPostVideo) setPostScheduleVideo({ ...initialPostScheduleVideo, ...savedPostVideo });
    }
    if (Array.isArray(state.mockCalls) && state.mockCalls.length) setMockCalls(state.mockCalls);
    setCurrentStep(Math.min(totalSteps, Math.max(1, nextStep)));
    setHighestStep(Math.min(totalSteps, Math.max(1, nextHighestStep)));
    setStarted(true);
    localStorage.setItem("sbp_setter_next_state", JSON.stringify(state));
  }

  async function ensureSession(emailValue = fields.email) {
    const email = String(emailValue || "").trim().toLowerCase();
    if (!isValidEmail(email)) return null;
    if (applicantId) return applicantId;
    try {
      if (staticPagesMode && setterBridgeUrl) {
        const payload = await setterBridgeRequest<{ applicantId: string; duplicate?: boolean; resumed?: boolean; state?: Record<string, any>; message?: string }>("session", { email, location: applicantLocation });
        if (payload.duplicate) {
          setDuplicateMessage(payload.message || duplicateApplicationMessage);
          setErrors((prev) => ({ ...prev, email: payload.message || duplicateApplicationMessage }));
          return null;
        }
        setApplicantId(payload.applicantId);
        if (payload.state) hydrateServerState(payload.state);
        if (payload.resumed) {
          setDuplicateMessage("");
          setErrors((prev) => ({ ...prev, email: "" }));
          setSaveState("Restored from your email.");
        }
        track("valid_email_entered", { email, applicantId: payload.applicantId });
        return payload.applicantId;
      }
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
      if (staticPagesMode && setterBridgeUrl) {
        const message = "We could not create your application session. Please check your connection and try again.";
        setSaveState("Not saved.");
        setErrors((prev) => ({ ...prev, email: message }));
        return null;
      }
      if (!staticPagesMode) return null;
      const localId = crypto.randomUUID ? crypto.randomUUID() : `local_${Date.now()}`;
      setApplicantId(localId);
      setSaveState("Saved on this device.");
      return localId;
    }
  }

  async function checkDuplicate(currentApplicantId = applicantId) {
    const email = String(fields.email || "").trim().toLowerCase();
    if (!isValidEmail(email)) return false;
    try {
      if (staticPagesMode && setterBridgeUrl) {
        const payload = await setterBridgeRequest<{ exists: boolean; message?: string }>("check_email", { email, applicantId: currentApplicantId });
        setDuplicateMessage(payload.exists ? payload.message || duplicateApplicationMessage : "");
        if (payload.exists) setErrors((prev) => ({ ...prev, email: payload.message || duplicateApplicationMessage }));
        return Boolean(payload.exists);
      }
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
      setDuplicateMessage(exists ? duplicateApplicationMessage : "");
      if (exists) setErrors((prev) => ({ ...prev, email: duplicateApplicationMessage }));
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
      location: applicantLocation,
      callLibrary: [...callLibrary, postScheduleVideo],
      postScheduleVideo,
      interviewScheduled,
      mockCalls,
      scenarios: config.content.scenarioQuestions.map((q) => ({ questionKey: q.key, response: scenarios[q.key] || "" }))
    };
    localStorage.setItem("sbp_setter_next_state", JSON.stringify(state));
    if (!applicantId) return;
    if (staticPagesMode) {
      if (setterBridgeUrl) {
        await setterBridgeRequest("autosave", state)
          .then(() => setSaveState("Saved."))
          .catch(() => setSaveState("Saved on this device."));
        return;
      }
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
    const eventApplicantId = String(metadata.applicantId || applicantId || "");
    if (!eventApplicantId && eventType !== "application_started") return;
    if (staticPagesMode) {
      if (setterBridgeUrl) {
        await setterBridgeRequest("event", { applicantId: eventApplicantId || null, eventType, step: currentStep, metadata }).catch(() => null);
      }
      return;
    }
    await fetch("/api/applications/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantId: eventApplicantId, eventType, step: currentStep, metadata })
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
      location: applicantLocation,
      callLibrary: [...callLibrary, postScheduleVideo],
      postScheduleVideo,
      interviewScheduled,
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
    if (callStartInProgress.current || activeCallNumber.current) return;
    callStartInProgress.current = true;
    updateMock(mockCallNumber, { status: "connecting", error: "" });

    const assistantId = config.vapi.assistantIds[String(mockCallNumber) as "1" | "2" | "3"];
    if (!config.vapi.publicKey || !isUuid(assistantId)) {
      callStartInProgress.current = false;
      updateMock(mockCallNumber, { status: "failed", error: "This mock-call assistant is not configured correctly. Refresh and try again." });
      track("mock_call_failed", { mockCallNumber, error: "invalid_vapi_assistant_id", assistantId: assistantId || "" });
      return;
    }

    const granted = micGranted || await requestMicrophone();
    if (!granted) {
      callStartInProgress.current = false;
      updateMock(mockCallNumber, { status: "not_started" });
      return;
    }
    if (activeCallNumber.current) {
      callStartInProgress.current = false;
      return;
    }
    const sessionId = applicantId || await ensureSession(fields.email);
    if (!sessionId) {
      callStartInProgress.current = false;
      updateMock(mockCallNumber, {
        status: "failed",
        error: "We could not create your application session. Check that your email is valid and refresh before trying this call again."
      });
      setErrors((prev) => ({
        ...prev,
        submit: "We could not create your application session. Check your email and refresh before trying the mock calls again."
      }));
      return;
    }
    try {
      const { default: Vapi } = await import("@vapi-ai/web");
      activeCallNumber.current = mockCallNumber;
      callStartedAt.current = Date.now();
      track("mock_call_started", { mockCallNumber, assistantId, applicantId: sessionId });
      const vapi = new Vapi(config.vapi.publicKey);
      activeVapi.current = vapi;
      vapi.on("call-start", () => {
        callStartInProgress.current = false;
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
          application_id: sessionId,
          preferred_name: fields.preferredName || "",
          mock_call_number: String(mockCallNumber)
        },
        metadata: {
          application_id: sessionId,
          mock_call_number: mockCallNumber,
          source: "solidbooked-pro-setter-application"
        }
      });
      if ((call as any)?.id) updateMock(mockCallNumber, { vapiCallId: (call as any).id });
    } catch (error) {
      callStartInProgress.current = false;
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
    callStartInProgress.current = false;
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
    callStartInProgress.current = false;
    activeCallNumber.current = null;
    activeVapi.current = null;
    updateMock(mockCallNumber, { status: "failed", error });
    track("mock_call_failed", { mockCallNumber, error });
  }

  function updateMock(mockCallNumber: 1 | 2 | 3, patch: Partial<CallState>) {
    setMockCalls((prev) => prev.map((call) => (call.mockCallNumber === mockCallNumber ? { ...call, ...patch } : call)));
  }

  async function submit() {
    const sessionId = applicantId || await ensureSession(fields.email);
    const ok = await validateStep(4);
    if (!ok || !sessionId) {
      if (!sessionId) {
        setErrors((prev) => ({
          ...prev,
          submit: "We could not create your application session. Please refresh the page, confirm your email, and try again."
        }));
      }
      focusValidationSummary();
      return;
    }
    setSubmitting(true);
    const payload = {
      applicantId: sessionId,
      currentStep,
      highestStep,
      fields,
      callLibrary,
      mockCalls,
      scenarios: config.content.scenarioQuestions.map((q) => ({ questionKey: q.key, response: scenarios[q.key] || "" }))
    };
    try {
      if (staticPagesMode && setterBridgeUrl) {
        await setterBridgeRequest("autosave", {
          applicantId: sessionId,
          started,
          currentStep,
          highestStep,
          fields,
          location: applicantLocation,
          callLibrary: [...callLibrary, postScheduleVideo],
          postScheduleVideo,
          interviewScheduled,
          mockCalls,
          scenarios: payload.scenarios
        });
        await scoreApplicationWithAi(sessionId);
        await waitForMockCallScoring(sessionId);
        const body = await setterBridgeRequest<{ status: QualificationStatus; message: string; calendar: PublicConfig["calendar"] | null }>("submit", payload);
        setSubmitting(false);
        setResult({ status: body.status, message: body.message, calendar: body.calendar });
        localStorage.removeItem("sbp_setter_next_state");
        track("application_submitted", { status: body.status });
        return;
      }
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
    } catch (error) {
      setSubmitting(false);
      if (staticPagesMode && setterBridgeUrl) {
        setErrors({ submit: error instanceof Error ? error.message : "We could not complete the application review. Please check your connection and try again." });
        setSaveState("Not saved.");
        return;
      }
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

  async function scoreApplicationWithAi(currentApplicantId: string) {
    if (!applicationAiScoreWebhook) return;
    const response = await fetch(applicationAiScoreWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ applicantId: currentApplicantId })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || body?.ok === false) {
      throw new Error(body?.message || body?.error || "Application review could not be completed.");
    }
  }

  async function waitForMockCallScoring(currentApplicantId: string) {
    const completed = mockCalls.filter((call) => call.status === "completed").length;
    if (!setterBridgeUrl || completed < 3) return;
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      const status = await setterBridgeRequest<{ scoredCalls?: number; noApplicantSpeechCalls?: number[] }>("mock_call_status", { applicantId: currentApplicantId }).catch(() => null);
      const noApplicantSpeechCalls = Array.isArray(status?.noApplicantSpeechCalls) ? status.noApplicantSpeechCalls : [];
      if (noApplicantSpeechCalls.length) {
        const invalidNumbers = new Set(noApplicantSpeechCalls.map(Number));
        setMockCalls((prev) =>
          prev.map((call) =>
            invalidNumbers.has(call.mockCallNumber)
              ? {
                  ...call,
                  status: "failed",
                  error: "We could not capture your response on this call. Test your microphone, then retry this mock call."
                }
              : call
          )
        );
        throw new Error("One or more mock calls did not capture your response. Go back to the mock-call step, test your microphone, and retry the highlighted call.");
      }
      if (Number(status?.scoredCalls || 0) >= 3) return;
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
    }
  }

  async function confirmInterviewScheduled() {
    if (!applicantId) {
      setInterviewScheduleState("We could not find your application session. Refresh and try again.");
      return;
    }
    setInterviewScheduleState("Saving your interview status...");
    const details = {
      provider: result?.calendar?.provider || config.calendar.provider,
      calendarUrl: result?.calendar?.externalUrl || result?.calendar?.embedUrl || config.calendar.externalUrl,
      confirmedByApplicant: true,
      confirmedAt: new Date().toISOString()
    };
    try {
      if (staticPagesMode && setterBridgeUrl) {
        await setterBridgeRequest("interview_scheduled", { applicantId, details });
      } else {
        const response = await fetch("/api/applications/interview-scheduled", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ applicantId, provider: details.provider, details })
        });
        if (!response.ok) throw new Error("Interview scheduling could not be saved.");
      }
      setInterviewScheduled(true);
      setInterviewScheduleState("Interview marked as scheduled. Watch the video below before your call.");
      track("interview_booked", details);
    } catch {
      setInterviewScheduleState("We could not save that yet. Please try again after booking your interview.");
    }
  }

  async function captureApproxLocation() {
    try {
      const response = await fetch("https://ipapi.co/json/", { cache: "no-store" });
      if (!response.ok) return;
      const body = await response.json();
      const location = {
        city: String(body.city || ""),
        region: String(body.region || body.region_code || ""),
        country: String(body.country_name || body.country || ""),
        timezone: String(body.timezone || ""),
        source: "ipapi"
      };
      if (!location.city && !location.region && !location.country) return;
      setApplicantLocation(location);
      localStorage.setItem("sbp_setter_location", JSON.stringify(location));
    } catch {
      // Location is a convenience signal for admins; never block the applicant flow.
    }
  }

  async function uploadResume(file: File | null) {
    if (!file) {
      updateField("resumeFileName", "" as any);
      updateField("resumeFileSize", 0 as any);
      updateField("resumeFileType", "" as any);
      setResumeUploadState("");
      return;
    }
    const allowed = new Set([
      "application/pdf",
      "image/png",
      "image/jpeg",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]);
    if (!allowed.has(file.type)) {
      setErrors((prev) => ({ ...prev, resumeFileName: "Upload a PDF, DOC, DOCX, PNG, or JPG resume." }));
      return;
    }
    if (file.size > 5_000_000) {
      setErrors((prev) => ({ ...prev, resumeFileName: "Resume must be 5 MB or smaller." }));
      return;
    }
    const sessionId = await ensureSession();
    if (!sessionId) {
      setErrors((prev) => ({ ...prev, resumeFileName: "Enter a valid email before uploading your resume." }));
      return;
    }
    setResumeUploadState("Uploading resume...");
    setErrors((prev) => ({ ...prev, resumeFileName: "" }));
    try {
      const [fileBase64, resumeText] = await Promise.all([fileToBase64(file), extractResumeText(file)]);
      if (setterBridgeUrl) {
        await setterBridgeRequest("resume_upload", {
          applicantId: sessionId,
          fileName: file.name,
          fileType: file.type,
          fileSize: file.size,
          fileBase64,
          resumeText
        });
        setResumeUploadState("Resume uploaded.");
      } else {
        setResumeUploadState("Resume selected. File storage is unavailable in this mode.");
      }
      updateField("resumeFileName", file.name as any);
      updateField("resumeFileSize", file.size as any);
      updateField("resumeFileType", file.type as any);
      track("resume_uploaded", { fileName: file.name, fileType: file.type, fileSize: file.size, applicantId: sessionId });
    } catch (error) {
      setResumeUploadState("");
      setErrors((prev) => ({
        ...prev,
        resumeFileName: error instanceof Error ? error.message : "Resume upload failed."
      }));
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
                      <p>We build them a website and get them ranked online. Our model is show first then sell. So we build and prepare everything first, send it to them and if they are interested we book an appointment with them for them to pay.</p>
                    </article>
                    <article>
                      <span>High Ticket</span>
                      <p>We run ad campaigns and send them qualified customers. Our guarantee to the business owners is, if the customer/lead does not show up, they do not pay for the lead.</p>
                    </article>
                  </div>
                  <article className="what-you-do">
                    <p className="kicker">What you will do</p>
                    <p>We have both warm and cold business owners that need to be contacted and scheduled on the calendar.</p>
                    <ul className="clean-list">
                      <li><strong>Warm prospect (40%):</strong> They received something from us and raised their hand that they are considering our service.</li>
                      <li><strong>Cold prospect (60%):</strong> We identified they need our service, like a business with a website that is not working or a business that is not getting enough customers, but they have not opted in yet.</li>
                    </ul>
                  </article>
                </div>

                <div className="fit-grid">
                  <article className="cover-panel succeeds-panel">
                    <p className="kicker">Who succeeds here</p>
                    <ul className="check-list">
                      <li>Comfortable speaking with cold and warm prospects all day.</li>
                      <li>Reliable, coachable and consistent with follow-up.</li>
                      <li>Can build rapport and is ok going off script.</li>
                      <li>Has previous experience in a similar role.</li>
                    </ul>
                  </article>
                  <article className="cover-panel not-fit">
                    <p className="kicker">This is not for you if</p>
                    <ul className="clean-list">
                      <li>You dislike phone conversations or avoid follow-up.</li>
                      <li>You have no rapport or sales training.</li>
                    </ul>
                  </article>
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
                    <p>You will be using our CRM and dialer. We use Hubstaff for time tracking and pay. Hubstaff supports paying you via Wise, PayPal, Payoneer and several other payment providers.</p>
                  </details>
                  <details>
                    <summary>How will I be paid?</summary>
                    <p>We use Hubstaff for time tracking and pay. Hubstaff supports paying you via Wise, PayPal, Payoneer and several other payment providers you can choose from.</p>
                  </details>
                  <details>
                    <summary>Do I work weekends?</summary>
                    <p>Normal work days are Monday to Friday. Weekends are optional if you choose to work those days as well.</p>
                  </details>
                  <details>
                    <summary>What are the working hours?</summary>
                    <p>The role operates during U.S. Eastern Time. Enter your exact availability in the application so we can verify that it overlaps with the required calling window.</p>
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
                        <Field id="email" label="Email address" type="email" value={fields.email} onBlur={() => ensureSession().then((id) => checkDuplicate(id || applicantId))} onChange={(v) => updateField("email", v)} error={renderError("email")} />
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
                        <ResumeUpload fileName={fields.resumeFileName || ""} fileSize={fields.resumeFileSize || 0} status={resumeUploadState} error={renderError("resumeFileName")} onChange={uploadResume} />
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
                                pay: "$5-8hr + $20 per Qualified Appointment",
                                earning: "Minimum Earning: $2,100 USD per month"
                              },
                              {
                                role: "Lead Service Setter",
                                note: "",
                                pay: "$5-10hr + $100 per Qualified Appointment",
                                earning: "Minimum Earning: $6,600 USD per month"
                              },
                              {
                                role: "Lead Service Closer",
                                note: "",
                                pay: "$10-16hr + $250 per Sale",
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
                      <div className="step-heading"><div><h2>Listen to actual call and role play.</h2><p>Review the examples if you want, then complete the three browser-based role plays.</p></div></div>
                      <div className="media-grid">
                        {config.content.callRecordings.map((call, index) => (
                          <article className="audio-card" key={call.key}>
                            <h3>{call.title}</h3>
                            <p>{call.description}</p>
                            <span className="media-meta">Call Duration: {call.durationLabel}</span>
                            {call.url ? (
                              <CallRecordingPlayer
                                title={call.title}
                                src={call.url}
                                engagement={callLibrary[index]}
                                onEngagement={(patch) => updateLibrary(index, patch)}
                              />
                            ) : (
                              <div className="notice">Audio player slot ready. Add URL in configuration.</div>
                            )}
                          </article>
                        ))}
                      </div>
                      <div className="mock-intro"><strong>Before the mock calls</strong><p>{scenarioIntro}</p></div>
                      <div className="mic-panel">
                        <strong>Microphone test</strong>
                        <p>{micStatus}</p>
                        <p className="retry-warning">Make sure you tested your microphone and it is working. Once you start the call, it <strong><u>won’t let you retry it</u></strong>.</p>
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
                              <p>{mockCallSetups[call.mockCallNumber]}</p>
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
                      <div className="step-heading"><div><h2>See what your first day looks like & schedule phone interview.</h2></div></div>
                      <section className="first-day-card" aria-label="What your first day looks like">
                        <p className="kicker">What your first day looks like</p>
                        <p>Your first day is a paid training and evaluation day. Here&apos;s the schedule:</p>
                        <ol className="first-day-list">
                          <li><strong>Practice Round (30 min)</strong><span>We&apos;ll do live role play together so you get comfortable with common scenarios.</span></li>
                          <li><strong>Live Calls (45 min)</strong><span>You&apos;ll make real calls using our script.</span></li>
                          <li><strong>Coaching (15 min)</strong><span>We&apos;ll review your calls and give you feedback.</span></li>
                          <li><strong>Live Calls Again (30 min)</strong><span>You&apos;ll make more calls and show us how you use the feedback.</span></li>
                          <li><strong>Decision</strong><span>At the end of the day, we&apos;ll decide together if this is a good fit.</span></li>
                        </ol>
                        <p className="first-day-pay">You get paid the same day for all 2 hours of work, even if we decide not to move forward.</p>
                        <p>If it&apos;s a good fit, we&apos;ll talk about next steps right away.</p>
                      </section>
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
                  <div className="post-schedule-confirm">
                    <div>
                      <strong>After you schedule your interview</strong>
                      <p>Confirm your interview is booked, then watch the short prep video before your call.</p>
                    </div>
                    <button className="btn btn-success" type="button" onClick={confirmInterviewScheduled} disabled={interviewScheduled}>
                      {interviewScheduled ? "Interview scheduled" : "I scheduled my interview"}
                    </button>
                  </div>
                  {interviewScheduleState && <p className="status-line post-schedule-status">{interviewScheduleState}</p>}
                  {interviewScheduled && (
                    <PostScheduleVideoPlayer
                      src={postScheduleVideoUrl}
                      engagement={postScheduleVideo}
                      onEngagement={(patch) => setPostScheduleVideo((prev) => ({ ...prev, ...patch }))}
                    />
                  )}
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

function PostScheduleVideoPlayer({
  src,
  engagement,
  onEngagement
}: {
  src: string;
  engagement: MediaEngagementInput;
  onEngagement: (patch: Partial<MediaEngagementInput>) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTrackedSecond = useRef(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState("");

  function trackProgress(time: number, total: number) {
    if (!total || !Number.isFinite(total)) return;
    const roundedSecond = Math.round(time);
    if (roundedSecond - lastTrackedSecond.current < 5 && roundedSecond !== Math.round(total)) return;
    lastTrackedSecond.current = roundedSecond;
    onEngagement({
      secondsConsumed: Math.max(engagement.secondsConsumed, roundedSecond),
      percentageConsumed: Math.max(engagement.percentageConsumed, Math.round((time / total) * 100))
    });
  }

  return (
    <section className="post-schedule-video" aria-label="Interview preparation video">
      <div className="post-schedule-video-copy">
        <span className="kicker">Before your interview</span>
        <h3>Watch this prep video.</h3>
        <p>This will help you understand what to expect before the phone interview.</p>
      </div>
      <div className="video-frame post-video-frame">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          src={src}
          onLoadedMetadata={(event) => {
            setDuration(event.currentTarget.duration || 0);
            setLoadError("");
          }}
          onPlay={(event) => {
            const isReplay = engagement.started && event.currentTarget.currentTime < 1;
            onEngagement({ started: true, replayCount: isReplay ? engagement.replayCount + 1 : engagement.replayCount });
          }}
          onPause={(event) => {
            if (!event.currentTarget.ended) {
              onEngagement({ pauseCount: (engagement.pauseCount || 0) + 1 });
            }
            trackProgress(event.currentTarget.currentTime, event.currentTarget.duration);
          }}
          onTimeUpdate={(event) => trackProgress(event.currentTarget.currentTime, event.currentTarget.duration)}
          onEnded={() => onEngagement({ completed: true, percentageConsumed: 100, secondsConsumed: Math.round(duration), replayCount: engagement.replayCount })}
          onError={() => setLoadError("The video is having trouble loading. Try refreshing the page or opening it in a new tab.")}
        />
      </div>
      <div className="post-video-meta" aria-live="polite">
        <span>{engagement.percentageConsumed || 0}% watched</span>
        <span>{formatDuration(engagement.secondsConsumed || 0)} watched</span>
      </div>
      {loadError && <p className="player-error">{loadError} <a href={src} target="_blank" rel="noreferrer">Open video</a></p>}
    </section>
  );
}

function CallRecordingPlayer({
  title,
  src,
  engagement,
  onEngagement
}: {
  title: string;
  src: string;
  engagement: MediaEngagementInput;
  onEngagement: (patch: Partial<MediaEngagementInput>) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastTrackedSecond = useRef(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loadError, setLoadError] = useState("");

  function togglePlayback() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      audio.play().catch(() => setLoadError("The recording could not start. Open it in a new tab and try again."));
      return;
    }
    audio.pause();
  }

  function trackProgress(time: number, total: number) {
    if (!total || !Number.isFinite(total)) return;
    const roundedSecond = Math.round(time);
    if (roundedSecond - lastTrackedSecond.current < 4 && roundedSecond !== Math.round(total)) return;
    lastTrackedSecond.current = roundedSecond;
    onEngagement({
      secondsConsumed: Math.max(engagement.secondsConsumed, roundedSecond),
      percentageConsumed: Math.max(engagement.percentageConsumed, Math.round((time / total) * 100))
    });
  }

  return (
    <div className="call-player">
      <audio
        ref={audioRef}
        preload="metadata"
        src={src}
        onLoadedMetadata={(event) => {
          setDuration(event.currentTarget.duration || 0);
          setLoadError("");
        }}
        onPlay={() => {
          setIsPlaying(true);
          onEngagement({ started: true, replayCount: engagement.started ? engagement.replayCount + 1 : engagement.replayCount });
        }}
        onPause={() => {
          const audio = audioRef.current;
          setIsPlaying(false);
          if (audio) trackProgress(audio.currentTime, audio.duration);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setCurrentTime(audio.currentTime);
          trackProgress(audio.currentTime, audio.duration);
        }}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(duration);
          onEngagement({ completed: true, percentageConsumed: 100, secondsConsumed: Math.round(duration) });
        }}
        onError={() => setLoadError("The recording is having trouble loading. Open it in a new tab and try again.")}
      />
      <div className="call-player-main">
        <button className="player-button" type="button" onClick={togglePlayback} aria-label={`${isPlaying ? "Pause" : "Play"} ${title}`}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <div className="player-track">
          <input
            aria-label={`${title} playback progress`}
            type="range"
            min="0"
            max={duration || 0}
            value={Math.min(currentTime, duration || currentTime)}
            step="0.1"
            onChange={(event) => {
              const audio = audioRef.current;
              const nextTime = Number(event.target.value);
              setCurrentTime(nextTime);
              if (audio) audio.currentTime = nextTime;
            }}
          />
          <div className="player-time">
            <span>{formatDuration(Math.round(currentTime))}</span>
            <span>{duration ? formatDuration(Math.round(duration)) : "--:--"}</span>
          </div>
        </div>
      </div>
      {loadError && (
        <p className="player-error">
          {loadError} <a href={src} target="_blank" rel="noreferrer">Open recording</a>
        </p>
      )}
    </div>
  );
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

function ResumeUpload({ fileName, fileSize, status, error, onChange }: {
  fileName: string;
  fileSize: number;
  status: string;
  error: React.ReactNode;
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
          accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(event) => onChange(event.target.files?.[0] || null)}
        />
      </label>
      {fileName ? (
        <span className="resume-file">{fileName} {fileSize ? `(${formatFileSize(fileSize)})` : ""}</span>
      ) : (
        <span className="field-help">PDF, DOC, DOCX, PNG, or JPG. 5 MB max.</span>
      )}
      {status && <span className="field-help">{status}</span>}
      {error}
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

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Resume could not be read."));
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.includes(",") ? result.split(",").pop() || "" : result);
    };
    reader.readAsDataURL(file);
  });
}

async function extractResumeText(file: File) {
  try {
    if (file.type.startsWith("image/")) return "";
    if (file.type === "text/plain") return cleanResumeText(await file.text());
    const buffer = await file.arrayBuffer();
    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfJsText = await extractPdfTextWithPdfJs(buffer).catch(() => "");
      if (pdfJsText.trim().length >= 50) return cleanResumeText(pdfJsText);
      const decoded = new TextDecoder("latin1").decode(buffer);
      return cleanResumeText(extractPdfLiteralText(decoded));
    }
    const decoded = new TextDecoder("latin1").decode(buffer);
    return cleanResumeText(decoded);
  } catch {
    return "";
  }
}

type PdfJsModule = {
  GlobalWorkerOptions?: { workerSrc?: string };
  getDocument: (options: { data: Uint8Array; useWorkerFetch?: boolean; isEvalSupported?: boolean }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNumber: number) => Promise<{
        getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
      }>;
    }>;
  };
};

async function extractPdfTextWithPdfJs(buffer: ArrayBuffer) {
  const version = "5.6.205";
  const importRemote = new Function("url", "return import(url)") as (url: string) => Promise<PdfJsModule>;
  const pdfjs = await importRemote(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.mjs`);
  if (pdfjs.GlobalWorkerOptions) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.mjs`;
  }
  const pdf = await pdfjs
    .getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false })
    .promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }
  return pages.join("\n");
}

function extractPdfLiteralText(raw: string) {
  const pieces: string[] = [];
  const literalMatches = raw.matchAll(/\((?:\\.|[^\\)]){2,}\)\s*Tj/g);
  for (const match of literalMatches) pieces.push(decodePdfLiteral(match[0].replace(/\)\s*Tj$/, "").slice(1)));
  const arrayMatches = raw.matchAll(/\[((?:\s*\((?:\\.|[^\\)]){1,}\)\s*){2,})\]\s*TJ/g);
  for (const match of arrayMatches) {
    for (const inner of match[1].matchAll(/\((?:\\.|[^\\)]){1,}\)/g)) {
      pieces.push(decodePdfLiteral(inner[0].slice(1, -1)));
    }
  }
  return pieces.join(" ");
}

function decodePdfLiteral(value: string) {
  return value
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\");
}

function cleanResumeText(value: string) {
  return value
    .replace(/[^\x09\x0A\x0D\x20-\x7E]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 16000);
}

function isUuid(value: unknown) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
