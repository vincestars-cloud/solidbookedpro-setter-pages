import { NextRequest } from "next/server";
import { listApplicants } from "@/lib/db";
import { json, requireAdmin } from "@/lib/security";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const applicants = await listApplicants();
  return json({ applicants });
}
