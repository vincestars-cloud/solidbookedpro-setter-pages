const defaultSupabaseUrl = "https://xxxmrbrwucsqeqbmwggd.supabase.co";
const defaultSupabaseAnonKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4eG1yYnJ3dWNzcWVxYm13Z2dkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDExMTMsImV4cCI6MjA5NjgxNzExM30.sC-3VPR6x9DKwqxnsocUqa3N24A8Dc3yrCFM0bwH9ms";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || defaultSupabaseUrl;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || defaultSupabaseAnonKey;

export const setterBridgeUrl =
  process.env.NEXT_PUBLIC_SETTER_BRIDGE_URL || `${supabaseUrl.replace(/\/$/, "")}/rest/v1/rpc/sbp_setter_bridge`;

export async function setterBridgeRequest<T = any>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  if (!setterBridgeUrl) throw new Error("Setter bridge URL is not configured.");
  const isSupabaseRpc = setterBridgeUrl.includes("/rest/v1/rpc/");
  const response = await fetch(setterBridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(isSupabaseRpc
        ? {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${supabaseAnonKey}`
          }
        : {})
    },
    body: JSON.stringify(isSupabaseRpc ? { req: { action, payload } } : { action, payload })
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body?.ok === false) {
    throw new Error(body?.message || body?.error || `Setter bridge failed with ${response.status}.`);
  }
  return body as T;
}
