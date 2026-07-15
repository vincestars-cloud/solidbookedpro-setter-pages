import assert from "node:assert/strict";
import { evaluateQualification } from "../lib/qualification";
import { applicationFieldsSchema } from "../lib/validators";

const fields = applicationFieldsSchema.parse({
  fullName: "Test Applicant",
  preferredName: "Test",
  email: "TEST@EXAMPLE.COM ",
  country: "United States",
  desiredHourly: 8,
  earliestStartDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
  availableStart: "09:00",
  availableEnd: "17:00",
  vocarooUrl: "https://voca.ro/123456789",
  crmPlatforms: "GoHighLevel, Calendly, HubSpot",
  appointmentSettingExperience:
    "I have set appointments for local service offers, handled objections, documented CRM notes, and followed up consistently. Most of my work has been cold calling, appointment setting, objection handling, follow-up, and booking prospects into qualified sales conversations while keeping clean pipeline notes.",
  industries: "Home services, agencies, B2B services",
  pastMetrics: "Made 110 calls per day, booked 28 appointments per month, and held a 44% show rate.",
  resumeFileName: "resume.pdf",
  resumeFileSize: 12345,
  resumeFileType: "application/pdf",
  salesProcessAcknowledged: true,
  founderVideoAcknowledged: true,
  recordingConsent: true,
  accuracyConfirmation: true
});

assert.equal(fields.email, "test@example.com");

const result = evaluateQualification({
  fields,
  mockCallsCompleted: 3,
  microphoneGranted: true,
  callLibrary: [
    { started: true, secondsConsumed: 112, percentageConsumed: 100 },
    { started: true, secondsConsumed: 148, percentageConsumed: 100 },
    { started: true, secondsConsumed: 283, percentageConsumed: 100 }
  ],
  duplicateSubmission: false
});

assert.equal(result.status, "qualified");
assert.equal(result.hardFlags.length, 0);

const duplicate = evaluateQualification({
  fields,
  mockCallsCompleted: 3,
  microphoneGranted: true,
  callLibrary: [],
  duplicateSubmission: true
});

assert.equal(duplicate.status, "not_qualified");
console.log("smoke tests passed");
