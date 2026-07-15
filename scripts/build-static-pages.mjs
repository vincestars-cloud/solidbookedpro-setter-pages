import fs from "node:fs";
import { spawnSync } from "node:child_process";

const apiDir = new URL("../app/api", import.meta.url);
const hiddenApiDir = new URL("../.api-static-build-disabled", import.meta.url);

function moveIfExists(from, to) {
  if (fs.existsSync(from)) fs.renameSync(from, to);
}

let moved = false;
try {
  if (fs.existsSync(hiddenApiDir)) {
    throw new Error("Refusing to build: hidden API directory already exists from a previous interrupted build.");
  }
  if (fs.existsSync(apiDir)) {
    moveIfExists(apiDir, hiddenApiDir);
    moved = true;
  }
  const result = spawnSync("next", ["build"], {
    stdio: "inherit",
    shell: true,
    env: {
      ...process.env,
      GITHUB_PAGES: "1",
      NEXT_PUBLIC_STATIC_PAGES_MODE: "1"
    }
  });
  if (result.status !== 0) process.exit(result.status || 1);
} finally {
  if (moved) moveIfExists(hiddenApiDir, apiDir);
}
