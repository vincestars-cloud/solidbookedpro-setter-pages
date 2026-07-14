import { NextRequest } from "next/server";
import { listApplicants } from "@/lib/db";
import { requireAdmin } from "@/lib/security";

export async function GET(request: NextRequest) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  const applicants = await listApplicants();
  const format = request.nextUrl.searchParams.get("format") || "json";
  if (format === "csv") {
    const header = [
      "Name",
      "Preferred name",
      "Email",
      "Country",
      "Desired pay",
      "Availability",
      "Start date",
      "Application status",
      "Qualification status",
      "Mock calls completed",
      "Interview status",
      "Date started",
      "Date submitted"
    ];
    const rows = applicants.map((a) => [
      a.full_name,
      a.preferred_name,
      a.normalized_email,
      a.country,
      a.desired_hourly_pay,
      a.availability_est ? `${a.availability_est.start}-${a.availability_est.end}` : "",
      a.earliest_start_date,
      a.application_status,
      a.qualification_status,
      "",
      a.interview_status,
      a.started_at,
      a.submitted_at
    ]);
    const csv = [header, ...rows].map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv;charset=utf-8",
        "Content-Disposition": `attachment; filename="solidbooked-setter-applicants.csv"`
      }
    });
  }
  return Response.json({ applicants }, { headers: { "Cache-Control": "no-store" } });
}
