import type { PublicConfig } from "./types";

const numberFromEnv = (key: string, fallback: number) => {
  const value = process.env[key];
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const publicConfig: PublicConfig = {
  role: {
    payMin: numberFromEnv("ROLE_PAY_MIN", 5),
    payMax: numberFromEnv("ROLE_PAY_MAX", 8),
    bonusPerClosedSale: numberFromEnv("ROLE_BONUS_PER_CLOSED_SALE", 20),
    payScheduleText:
      process.env.NEXT_PUBLIC_ROLE_PAY_SCHEDULE_TEXT ||
      "Pay schedule is explained in the founder video and confirmed before training.",
    officeWindowStart: process.env.ROLE_OFFICE_WINDOW_START || "09:00",
    officeWindowEnd: process.env.ROLE_OFFICE_WINDOW_END || "17:00",
    minimumOverlapHours: numberFromEnv("ROLE_MINIMUM_OVERLAP_HOURS", 5)
  },
  content: {
    founderVideoUrl: process.env.NEXT_PUBLIC_FOUNDER_VIDEO_URL || "/media/appt_setter_96843.mp4",
    founderVideoPosterUrl: process.env.NEXT_PUBLIC_FOUNDER_VIDEO_POSTER_URL || "",
    founderVideoMinimumWatchPercent: numberFromEnv("FOUNDER_VIDEO_MINIMUM_WATCH_PERCENT", 70),
    callRecordings: [
      {
        key: "successful-call-1",
        title: process.env.NEXT_PUBLIC_CALL_1_TITLE || "Call 1 - No Resistance from the Prospect",
        description: process.env.NEXT_PUBLIC_CALL_1_DESCRIPTION || "A real successful appointment-setting call with low resistance.",
        url: process.env.NEXT_PUBLIC_CALL_1_URL || "/media/call-1-no-resistance.m4a",
        embedUrl: process.env.NEXT_PUBLIC_CALL_1_EMBED_URL || "",
        durationLabel: process.env.NEXT_PUBLIC_CALL_1_DURATION || "1:52"
      },
      {
        key: "successful-call-2",
        title: process.env.NEXT_PUBLIC_CALL_2_TITLE || "Call 2 - Resistance from the Prospect",
        description: process.env.NEXT_PUBLIC_CALL_2_DESCRIPTION || "A real appointment-setting call with prospect resistance.",
        url: process.env.NEXT_PUBLIC_CALL_2_URL || "/media/call-2-resistance.m4a",
        embedUrl: process.env.NEXT_PUBLIC_CALL_2_EMBED_URL || "",
        durationLabel: process.env.NEXT_PUBLIC_CALL_2_DURATION || "2:28"
      },
      {
        key: "successful-call-3",
        title: process.env.NEXT_PUBLIC_CALL_3_TITLE || "Call 3 - Resistance from the Prospect (used to Referrals)",
        description: process.env.NEXT_PUBLIC_CALL_3_DESCRIPTION || "A real appointment-setting call with resistance from a prospect used to referrals.",
        url: process.env.NEXT_PUBLIC_CALL_3_URL || "/media/call-3-referrals.m4a",
        embedUrl: process.env.NEXT_PUBLIC_CALL_3_EMBED_URL || "",
        durationLabel: process.env.NEXT_PUBLIC_CALL_3_DURATION || "4:43"
      }
    ],
    scenarioQuestions: [
      {
        key: "below_target_three_days",
        prompt: "Your booking numbers have been below target for three consecutive days. What would you do?"
      },
      {
        key: "send_me_information",
        prompt: "A prospect says, “Just send me the information.” How would you respond?"
      }
    ]
  },
  vapi: {
    publicKey: process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY || "",
    assistantIds: {
      "1": process.env.NEXT_PUBLIC_VAPI_MOCK_CALL_1_ASSISTANT_ID || "",
      "2": process.env.NEXT_PUBLIC_VAPI_MOCK_CALL_2_ASSISTANT_ID || "",
      "3": process.env.NEXT_PUBLIC_VAPI_MOCK_CALL_3_ASSISTANT_ID || ""
    }
  },
  calendar: {
    provider: process.env.CALENDAR_PROVIDER || "calendly",
    embedUrl: process.env.NEXT_PUBLIC_INTERVIEW_CALENDAR_EMBED_URL || "",
    externalUrl: process.env.NEXT_PUBLIC_INTERVIEW_CALENDAR_EXTERNAL_URL || ""
  }
};

export const privateConfig = {
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "",
  adminToken: process.env.ADMIN_API_TOKEN || "",
  vapiWebhookSecret: process.env.VAPI_WEBHOOK_SECRET || "",
  botTrapField: "company_website_confirm"
};
