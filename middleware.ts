import { NextRequest, NextResponse } from "next/server";
import { privateConfig } from "./lib/config";

export function middleware(request: NextRequest) {
  if (!request.nextUrl.pathname.startsWith("/admin")) return NextResponse.next();
  if (!privateConfig.adminPassword) {
    return new NextResponse("Admin is not configured. Set ADMIN_PASSWORD.", { status: 503 });
  }
  const auth = request.headers.get("authorization") || "";
  const [scheme, encoded] = auth.split(" ");
  if (scheme === "Basic" && encoded) {
    const [username, password] = atob(encoded).split(":");
    if (username === privateConfig.adminUsername && password === privateConfig.adminPassword) {
      return NextResponse.next();
    }
  }
  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SolidBooked Pro Admin"' }
  });
}

export const config = {
  matcher: ["/admin/:path*"]
};
