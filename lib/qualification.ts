import { publicConfig } from "./config";
import type { ApplicationFieldsInput } from "./validators";
import type { QualificationStatus } from "./types";

type QualificationInput = {
  fields: ApplicationFieldsInput;
  scenarios: Array<{ questionKey: string; response: string }>;
  mockCallsCompleted: number;
  microphoneGranted: boolean;
  duplicateSubmission: boolean;
};

export function evaluateQualification(input: QualificationInput): {
  status: QualificationStatus;
  internalScore: number;
  hardFlags: string[];
} {
  const hardFlags: string[] = [];
  let score = 0;
  const { fields } = input;

  if (input.duplicateSubmission) hardFlags.push("duplicate_submission");
  if (!fields.accuracyConfirmation) hardFlags.push("required_acknowledgment_missing");
  if (!input.microphoneGranted) hardFlags.push("microphone_not_confirmed");
  if (input.mockCallsCompleted < 3) hardFlags.push("mock_calls_incomplete");
  if (fields.desiredHourly > publicConfig.role.payMax) hardFlags.push("pay_expectation_above_range");
  if (!dateIsAcceptable(fields.earliestStartDate)) hardFlags.push("start_date_not_acceptable");
  if (availabilityOverlap(fields.availableStart, fields.availableEnd) < publicConfig.role.minimumOverlapHours) {
    hardFlags.push("availability_outside_required_window");
  }

  if (fields.pastMetrics.match(/\d/)) score += 18;
  if (fields.appointmentSettingExperience.length >= 160) score += 18;
  if (fields.crmPlatforms.length >= 8) score += 8;
  if (fields.industries.length >= 6) score += 6;
  if (input.scenarios.every((scenario) => scenario.response.length >= 80)) score += 22;
  if (fields.desiredHourly <= publicConfig.role.payMax) score += 12;
  if (availabilityOverlap(fields.availableStart, fields.availableEnd) >= publicConfig.role.minimumOverlapHours) score += 10;
  if (input.mockCallsCompleted === 3) score += 6;

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
    return { status: "not_qualified", internalScore: score, hardFlags };
  }
  if (score >= 70) return { status: "qualified", internalScore: score, hardFlags };
  return { status: "manual_review", internalScore: score, hardFlags };
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
