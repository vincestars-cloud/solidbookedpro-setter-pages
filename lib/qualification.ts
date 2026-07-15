import { publicConfig } from "./config";
import type { ApplicationFieldsInput } from "./validators";
import type { QualificationStatus } from "./types";

type QualificationInput = {
  fields: ApplicationFieldsInput;
  mockCallsCompleted: number;
  microphoneGranted: boolean;
  duplicateSubmission: boolean;
  callLibrary?: Array<{ started?: boolean; secondsConsumed?: number; percentageConsumed?: number }>;
  mockAverageScore?: number | null;
  mockScoredCalls?: number;
};

export function evaluateQualification(input: QualificationInput): {
  status: QualificationStatus;
  internalScore: number;
  hardFlags: string[];
  scoreBreakdown: Record<string, unknown>;
} {
  const hardFlags: string[] = [];
  let score = 0;
  const { fields } = input;
  const overlap = availabilityOverlap(fields.availableStart, fields.availableEnd);

  if (input.duplicateSubmission) hardFlags.push("duplicate_submission");
  if (!fields.accuracyConfirmation) hardFlags.push("required_acknowledgment_missing");
  if (!input.microphoneGranted) hardFlags.push("microphone_not_confirmed");
  if (input.mockCallsCompleted < 3) hardFlags.push("mock_calls_incomplete");
  if (fields.desiredHourly > publicConfig.role.payMax) hardFlags.push("pay_expectation_above_range");
  if (!dateIsAcceptable(fields.earliestStartDate)) hardFlags.push("start_date_not_acceptable");
  if (overlap < publicConfig.role.minimumOverlapHours) {
    hardFlags.push("availability_outside_required_window");
  }

  const resumeUploaded = Boolean(fields.resumeFileName || fields.resumeFileSize);
  const resumeScore = resumeUploaded ? 10 : 0;
  const experienceScore = scoreExperience(fields.appointmentSettingExperience);
  const metricsScore = scoreMetrics(fields.pastMetrics);
  const crmScore = scoreCrm(fields.crmPlatforms);
  const industriesScore = scoreIndustries(fields.industries);
  const listening = summarizeCallListening(input.callLibrary || []);
  const sampleListeningScore = scoreCallListening(listening.opened, listening.averagePercent);
  const mockAverageScore = input.mockAverageScore || 0;
  const mockScoredCalls = input.mockScoredCalls || 0;
  const mockCallScore = scoreMockCalls(mockAverageScore, mockScoredCalls, input.mockCallsCompleted);

  score =
    resumeScore +
    experienceScore +
    metricsScore +
    crmScore +
    industriesScore +
    sampleListeningScore +
    mockCallScore;

  const scoreBreakdown = {
    resumeUploaded,
    resumeScore,
    experienceScore,
    metricsScore,
    crmScore,
    industriesScore,
    sampleListeningScore,
    callLibraryOpened: listening.opened,
    callLibraryAveragePercent: Math.round(listening.averagePercent),
    mockCallScore,
    mockAverageScore: Math.round(mockAverageScore),
    mockScoredCalls,
    completedMockCalls: input.mockCallsCompleted
  };

  const blockingFlags = new Set([
    "duplicate_submission",
    "required_acknowledgment_missing",
    "microphone_not_confirmed",
    "mock_calls_incomplete",
    "pay_expectation_above_range",
    "availability_outside_required_window",
    "start_date_not_acceptable"
  ]);

  if (hardFlags.some((flag) => blockingFlags.has(flag))) {
    return { status: "not_qualified", internalScore: score, hardFlags, scoreBreakdown };
  }
  if (score >= 75 && (mockScoredCalls === 0 || mockAverageScore >= 70)) {
    return { status: "qualified", internalScore: score, hardFlags, scoreBreakdown };
  }
  return { status: "manual_review", internalScore: score, hardFlags, scoreBreakdown };
}

export function availabilityOverlap(start: string, end: string) {
  const candidateStart = timeToMinutes(start);
  const candidateEnd = timeToMinutes(end);
  const officeStart = timeToMinutes(publicConfig.role.officeWindowStart);
  const officeEnd = timeToMinutes(publicConfig.role.officeWindowEnd);
  if ([candidateStart, candidateEnd, officeStart, officeEnd].some((value) => value === null)) return 0;
  return Math.max(0, Math.min(candidateEnd!, officeEnd!) - Math.max(candidateStart!, officeStart!)) / 60;
}

function timeToMinutes(time: string) {
  if (!/^\d{2}:\d{2}$/.test(time)) return null;
  const [hours, minutes] = time.split(":").map(Number);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function dateIsAcceptable(date: string) {
  const selected = new Date(`${date}T00:00:00`);
  if (Number.isNaN(selected.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected >= today;
}

function scoreExperience(value: string) {
  const text = value.trim();
  const lower = text.toLowerCase();
  let score = 0;
  if (text.length >= 300) score += 10;
  else if (text.length >= 120) score += 6;
  else if (text.length >= 60) score += 3;
  if (/(cold call|cold-call|appointment|setter|sales|objection|follow[ -]?up|dialer|prospect|crm|book|quota|show rate)/.test(lower)) {
    score += 10;
  }
  return Math.min(score, 20);
}

function scoreMetrics(value: string) {
  const lower = value.toLowerCase();
  let score = 0;
  if (/\d/.test(value)) score += 8;
  if (/%|[0-9].*[0-9]/.test(value)) score += 7;
  if (/(appointment|book|show rate|close rate|call|conversation|quota|demo|meeting|held|set|conversion|kpi)/.test(lower)) {
    score += 10;
  }
  return Math.min(score, 25);
}

function scoreCrm(value: string) {
  const lower = value.toLowerCase();
  let score = value.trim().length >= 8 ? 4 : 0;
  if (/(crm|gohighlevel|highlevel|hubspot|salesforce|pipedrive|close|dialer|calendly|apollo|salesloft|outreach)/.test(lower)) {
    score += 4;
  }
  return Math.min(score, 8);
}

function scoreIndustries(value: string) {
  const length = value.trim().length;
  if (length >= 12) return 7;
  if (length >= 5) return 4;
  return 0;
}

function summarizeCallListening(callLibrary: Array<{ started?: boolean; secondsConsumed?: number; percentageConsumed?: number }>) {
  const openedCalls = callLibrary.filter(
    (item) => item.started || Number(item.secondsConsumed || 0) > 0 || Number(item.percentageConsumed || 0) > 0
  );
  const averagePercent = openedCalls.length
    ? openedCalls.reduce((sum, item) => sum + Number(item.percentageConsumed || 0), 0) / openedCalls.length
    : 0;
  return { opened: openedCalls.length, averagePercent };
}

function scoreCallListening(opened: number, averagePercent: number) {
  if (averagePercent >= 75 || opened >= 3) return 10;
  if (averagePercent >= 40 || opened >= 2) return 6;
  if (opened >= 1) return 3;
  return 0;
}

function scoreMockCalls(averageScore: number, scoredCalls: number, completedCalls: number) {
  if (scoredCalls > 0) {
    if (averageScore >= 85) return 20;
    if (averageScore >= 75) return 16;
    if (averageScore >= 65) return 10;
    if (averageScore >= 55) return 5;
    return 0;
  }
  return completedCalls === 3 ? 5 : 0;
}
