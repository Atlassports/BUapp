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

const port = process.env.PORT ?? "3000";

const child = spawn("npx", ["next", "start", "-p", port], {
  stdio: "inherit",
  env: {
    ...process.env,
    NODE_ENV: "production",
    SIDEKICK_PREVIEW: "1",
    // Throwaway per run: real enough to sign cookies, useless as a deployment.
    SIDEKICK_SECRET: process.env.SIDEKICK_SECRET ?? randomBytes(32).toString("hex"),
  },
});

child.on("exit", (code) => process.exit(code ?? 0));
