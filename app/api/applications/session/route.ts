import { NextRequest } from "next/server";
import { createApplicant } from "@/lib/db";
import { getClientIp, json } from "@/lib/security";
import { emailSchema } from "@/lib/validators";

export async function POST(request: NextRequest) {
  const parsed = emailSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return json({ error: "Enter a valid email address." }, { status: 400 });
  const { applicant, duplicate } = await createApplicant(parsed.data.email, getClientIp(request));
  if (duplicate) {
    return json(
      {
        duplicate: true,
        applicantId: applicant.id,
        message:
          "An application has already been started or submitted using this email address. Please use the same device to continue, or contact us if you need assistance."
      },
      { status: 409 }
    );
  }
  return json({ duplicate: false, applicantId: applicant.id, applicant });
}
