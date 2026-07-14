import { NextRequest, NextResponse } from "next/server";
import { privateConfig } from "./config";

const textEncoder = new TextEncoder();

export function json(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...(init?.headers || {})
    }
  });
}

export function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function requireAdmin(request: NextRequest) {
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const headerToken = request.headers.get("x-admin-token");
  const token = bearer || headerToken;
  if (privateConfig.adminToken && token === privateConfig.adminToken) return null;
  return json({ error: "Unauthorized" }, { status: 401 });
}

export async function verifyVapiSignature(request: NextRequest, rawBody: string) {
  if (!privateConfig.vapiWebhookSecret) return true;
  const signature = request.headers.get("x-vapi-signature") || request.headers.get("x-signature");
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(privateConfig.vapiWebhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const digest = await crypto.subtle.sign("HMAC", key, textEncoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(signature.replace(/^sha256=/, ""), expected);
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}
