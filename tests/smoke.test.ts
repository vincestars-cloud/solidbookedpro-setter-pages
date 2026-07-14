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
    "I have set appointments for local service offers, handled objections, documented CRM notes, and followed up consistently.",
  industries: "Home services, agencies, B2B services",
  pastMetrics: "Made 110 calls per day, booked 28 appointments per month, and held a 44% show rate.",
  salesProcessAcknowledged: true,
  founderVideoAcknowledged: true,
  recordingConsent: true,
  accuracyConfirmation: true
});

assert.equal(fields.email, "test@example.com");

const result = evaluateQualification({
  fields,
  scenarios: [
    {
      questionKey: "below_target_three_days",
      response:
        "I would review activity, call quality, and follow-up speed, compare against the best previous day, ask for feedback, and make a specific adjustment plan."
    },
    {
      questionKey: "send_me_information",
      response:
        "I would acknowledge it, ask what information matters most, give a concise answer, and ask for the next step while the context is fresh."
    }
  ],
  mockCallsCompleted: 3,
  microphoneGranted: true,
  duplicateSubmission: false
});

assert.equal(result.status, "qualified");
assert.equal(result.hardFlags.length, 0);

const duplicate = evaluateQualification({
  fields,
  scenarios: [],
  mockCallsCompleted: 3,
  microphoneGranted: true,
  duplicateSubmission: true
});

assert.equal(duplicate.status, "not_qualified");
console.log("smoke tests passed");
