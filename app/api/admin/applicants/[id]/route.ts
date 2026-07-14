import { NextRequest } from "next/server";
import { getApplicantBundle } from "@/lib/db";
import { json, requireAdmin } from "@/lib/security";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const { id } = await params;
  const bundle = await getApplicantBundle(id);
  if (!bundle.applicant) return json({ error: "Applicant not found." }, { status: 404 });
  return json(bundle);
}
