/**
 * Runs the production build locally, so you can feel real performance.
 *
 *   npm run preview
 *
 * Development mode recompiles every route on demand and ships unminified code
 * with source maps — it is built for editing, not for speed, and it is not what
 * anyone using the app would experience. This is.
 */
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const port = process.env.PORT ?? "3000";

/**
 * The secret signs verification codes, so regenerating it on every run made any
 * code issued before a restart unverifiable — you'd request a code, restart,
 * and be told it didn't match. Kept in a gitignored file instead: stable across
 * runs, still local-only, still useless as a deployment secret.
 */
const SECRET_FILE = ".data/preview-secret";
function previewSecret() {
  if (process.env.SIDEKICK_SECRET) return process.env.SIDEKICK_SECRET;
  if (existsSync(SECRET_FILE)) return readFileSync(SECRET_FILE, "utf8").trim();
  const secret = randomBytes(32).toString("hex");
  mkdirSync(dirname(SECRET_FILE), { recursive: true });
  writeFileSync(SECRET_FILE, secret);
  return secret;
}

const child = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    SIDEKICK_PREVIEW: "1",
    SIDEKICK_SECRET: previewSecret(),
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
