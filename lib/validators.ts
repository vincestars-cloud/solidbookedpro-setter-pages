import { z } from "zod";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

export const timeSchema = z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM availability format.");

export const applicationFieldsSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(160),
  preferredName: z.string().trim().min(1, "Preferred name is required.").max(100),
  email: z.string().trim().email("Enter a valid email address.").transform(normalizeEmail),
  country: z.string().trim().max(100).optional().default(""),
  desiredHourly: z.coerce.number().positive("Desired pay must be a dollar amount.").max(250),
  earliestStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose your earliest start date."),
  availableStart: timeSchema,
  availableEnd: timeSchema,
  vocarooUrl: z.string().trim().url("Enter a valid Vocaroo URL.").refine(
    (value) => /^https?:\/\/(www\.)?(voca\.ro|vocaroo\.com)\//i.test(value),
    "Use a valid Vocaroo or voca.ro link."
  ),
  crmPlatforms: z.string().trim().min(1, "Enter the CRM or scheduling platforms you have used.").max(1200),
  appointmentSettingExperience: z.string().trim().min(1, "Appointment-setting experience is required.").max(4000),
  industries: z.string().trim().min(1, "Enter industries or offers you have worked with.").max(1600),
  pastMetrics: z.string().trim().min(1, "Past metrics or measurable results are required.").max(2500),
  resumeFileName: z.string().trim().max(240).optional().default(""),
  resumeFileSize: z.coerce.number().nonnegative().max(10_000_000).optional().default(0),
  salesProcessAcknowledged: z.boolean().optional().default(false),
  founderVideoAcknowledged: z.boolean().optional().default(false),
  recordingConsent: z.boolean().optional().default(false),
  accuracyConfirmation: z.boolean().optional().default(false)
});

export const scenarioResponseSchema = z.object({
  questionKey: z.string().trim().min(1).max(120),
  response: z.string().trim().min(1, "Answer is required.").max(3000)
});

export const autosaveSchema = z.object({
  applicantId: z.string().uuid(),
  currentStep: z.coerce.number().int().min(1).max(5),
  highestStep: z.coerce.number().int().min(1).max(5),
  fields: applicationFieldsSchema.partial(),
  founderVideo: z.any().optional(),
  callLibrary: z.array(z.any()).optional(),
  mockCalls: z.array(z.any()).optional(),
  scenarios: z.array(scenarioResponseSchema).optional(),
  stepDurationsMs: z.record(z.string(), z.number()).optional()
});

export const submitSchema = autosaveSchema.extend({
  fields: applicationFieldsSchema,
  scenarios: z.array(scenarioResponseSchema).min(2)
});

export const eventSchema = z.object({
  applicantId: z.string().uuid().optional(),
  eventType: z.string().trim().min(1).max(120),
  step: z.number().int().min(1).max(5).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const emailSchema = z.object({
  email: z.string().trim().email().transform(normalizeEmail)
});

export const interviewScheduledSchema = z.object({
  applicantId: z.string().uuid(),
  provider: z.string().trim().max(80).optional(),
  scheduledAt: z.string().trim().max(120).optional(),
  details: z.record(z.string(), z.unknown()).optional()
});

export type ApplicationFieldsInput = z.infer<typeof applicationFieldsSchema>;
