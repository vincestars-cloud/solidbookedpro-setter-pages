export type QualificationStatus = "qualified" | "manual_review" | "not_qualified";

export type ApplicationStatus =
  | "started"
  | "step_1_complete"
  | "step_2_complete"
  | "step_3_complete"
  | "mock_calls_in_progress"
  | "application_completed"
  | "interview_scheduled"
  | "interview_completed"
  | "paid_trial"
  | "hired"
  | "rejected"
  | "withdrawn";

export type InterviewStatus = "not_scheduled" | "scheduled" | "completed";

export type MockCallStatus = "not_started" | "connecting" | "live" | "ending" | "completed" | "failed";

export type ApplicantRecord = {
  id: string;
  full_name: string | null;
  preferred_name: string | null;
  normalized_email: string;
  country: string | null;
  desired_hourly_pay: number | null;
  earliest_start_date: string | null;
  availability_est: { start: string; end: string } | null;
  vocaroo_url: string | null;
  crm_platforms: string | null;
  appointment_setting_experience: string | null;
  industries: string | null;
  past_metrics: string | null;
  application_status: ApplicationStatus;
  qualification_status: QualificationStatus | null;
  internal_score: number | null;
  current_step: number;
  started_at: string;
  submitted_at: string | null;
  total_completion_seconds: number | null;
  interview_status: InterviewStatus;
  interview_scheduled_at: string | null;
  interview_details: Record<string, unknown> | null;
  hiring_stage_status: string | null;
  abandoned_at_step: number | null;
  hard_flags: string[] | null;
  reopened_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationFields = {
  fullName: string;
  preferredName: string;
  email: string;
  country: string;
  desiredHourly: number;
  earliestStartDate: string;
  availableStart: string;
  availableEnd: string;
  vocarooUrl: string;
  crmPlatforms: string;
  appointmentSettingExperience: string;
  industries: string;
  pastMetrics: string;
  resumeFileName: string;
  resumeFileSize: number;
  salesProcessAcknowledged: boolean;
  founderVideoAcknowledged: boolean;
  recordingConsent: boolean;
  accuracyConfirmation: boolean;
};

export type ScenarioResponseInput = {
  questionKey: string;
  response: string;
};

export type ClientApplicationState = {
  applicantId: string;
  currentStep: number;
  highestStep: number;
  fields: Partial<ApplicationFields>;
  founderVideo?: MediaEngagementInput;
  callLibrary?: MediaEngagementInput[];
  mockCalls?: ClientMockCallState[];
  scenarios?: ScenarioResponseInput[];
};

export type MediaEngagementInput = {
  mediaType: "founder_video" | "call_recording";
  mediaKey: string;
  started: boolean;
  secondsConsumed: number;
  percentageConsumed: number;
  completed: boolean;
  replayCount: number;
  pauseCount?: number;
};

export type ClientMockCallState = {
  mockCallNumber: 1 | 2 | 3;
  vapiCallId?: string | null;
  status: MockCallStatus;
  startedAt?: string | null;
  endedAt?: string | null;
  durationSeconds?: number | null;
  endedReason?: string | null;
};

export type PublicConfig = {
  role: {
    payMin: number;
    payMax: number;
    bonusPerClosedSale: number;
    payScheduleText: string;
    officeWindowStart: string;
    officeWindowEnd: string;
    minimumOverlapHours: number;
  };
  content: {
    founderVideoUrl: string;
    founderVideoPosterUrl: string;
    founderVideoMinimumWatchPercent: number;
    callRecordings: Array<{ key: string; title: string; description: string; url: string; embedUrl?: string; durationLabel: string }>;
    scenarioQuestions: Array<{ key: string; prompt: string }>;
  };
  vapi: {
    publicKey: string;
    assistantIds: Record<"1" | "2" | "3", string>;
  };
  calendar: {
    provider: string;
    embedUrl: string;
    externalUrl: string;
  };
};
