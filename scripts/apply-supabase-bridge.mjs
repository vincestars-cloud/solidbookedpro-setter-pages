import fs from "node:fs";

const projectRef = "xxxmrbrwucsqeqbmwggd";
const root = new URL("..", import.meta.url);
const tokenMemory = fs.readFileSync("/Users/vincentohasiligwo/claude-memory-sync/reference_supabase_mgmt_token.md", "utf8");
const token = tokenMemory.match(/Token: `([^`]+)`/)?.[1];
const query = fs.readFileSync(new URL("db/supabase_bridge.sql", root), "utf8");

if (!token) {
  throw new Error("Supabase management token was not found.");
}

const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${token}`,
    "content-type": "application/json"
  },
  body: JSON.stringify({ query })
});

const text = await response.text();
let body = {};
try {
  body = JSON.parse(text);
} catch {
  body = { message: text.slice(0, 500) };
}

console.log(
  JSON.stringify(
    {
      status: response.status,
      ok: response.ok,
      error: body.error || body.message || null
    },
    null,
    2
  )
);

if (!response.ok) {
  process.exit(1);
}
