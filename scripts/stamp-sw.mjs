/**
 * Stamps the service worker with a per-build version (scripts/sw.template.js
 * → public/sw.js, gitignored). The cache name must change every deploy:
 * sw.js used to be byte-static, so the browser never re-installed it and an
 * offline cold start could serve a stale shell pointing at dead _next
 * hashes. Runs as the first step of `pnpm build`.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = (
  process.env.VERCEL_GIT_COMMIT_SHA ?? Date.now().toString(36)
).slice(0, 12);

const template = readFileSync(join(root, "scripts/sw.template.js"), "utf8");
if (!template.includes("__SW_VERSION__")) {
  throw new Error("sw.template.js is missing the __SW_VERSION__ token");
}
writeFileSync(
  join(root, "public/sw.js"),
  template.replace("__SW_VERSION__", version),
);
console.log(`sw.js stamped: surplus-shell-${version}`);
