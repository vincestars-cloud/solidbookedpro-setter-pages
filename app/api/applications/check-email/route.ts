import { NextRequest } from "next/server";
import { findApplicantByEmail } from "@/lib/db";
import { json } from "@/lib/security";
import { emailSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const parsed = emailSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Invalid email." }, { status: 400 });
  const applicant = await findApplicantByEmail(parsed.data.email);
  return json({
    exists: Boolean(applicant && !applicant.reopened_at),
    message: applicant
      ? "An application has already been started or submitted using this email address. Please use the same device to continue, or contact us if you need assistance."
      : ""
  });
}
