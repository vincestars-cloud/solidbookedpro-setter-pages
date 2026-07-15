const defaultSupabaseUrl = "https://xxxmrbrwucsqeqbmwggd.supabase.co";
const defaultSupabaseAnonKey =
  "sb_publishable_bmDK1fkJqvGwACZdaa640g_T6yhzvaz";

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
