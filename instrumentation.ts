/**
 * Runs once when the server starts, before it accepts any traffic.
 *
 * Every check here guards a failure that would otherwise stay invisible until
 * a real student hit it — a deploy that serves a perfectly healthy-looking
 * sign-in page and then breaks the moment someone types their email. Better to
 * refuse to start.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  // A local production build for measuring speed, not a deployment. It gets a
  // throwaway secret and console codes, so it is useless as one.
  if (process.env.SIDEKICK_PREVIEW === "1") {
    console.log(
      "\n  Preview mode: production build, local only.\n" +
        "  Verification codes print here. Sessions end when this process does.\n" +
        "  Never set SIDEKICK_PREVIEW on a real deployment.\n",
    );
    return;
  }

  const problems: string[] = [];

  const secret = process.env.SIDEKICK_SECRET;
  if (!secret || secret === "dev-secret-change-me") {
    problems.push(
      "SIDEKICK_SECRET is unset or still the development default.\n" +
        "    It signs the pending-signup cookie — on the default, anyone could forge\n" +
        "    that cookie and register any address without receiving a code.\n" +
        "    Fix: set it to the output of `openssl rand -hex 32`.",
    );
  } else if (secret.length < 32) {
    problems.push(
      "SIDEKICK_SECRET is shorter than 32 characters.\n" +
        "    Fix: use the output of `openssl rand -hex 32`.",
    );
  }

  if (!process.env.RESEND_API_KEY) {
    problems.push(
      "RESEND_API_KEY is not set, so no student can receive a verification code.\n" +
        "    Fix: create a key at https://resend.com/api-keys, verify a domain at\n" +
        "    https://resend.com/domains, and set MAIL_FROM to an address on it.",
    );
  } else if (!process.env.MAIL_FROM) {
    problems.push(
      "MAIL_FROM is not set, so mail would be sent from Resend's shared test\n" +
        "    sender, which only delivers to your own address.\n" +
        "    Fix: set MAIL_FROM to an address on a domain you verified with Resend.",
    );
  }

  const dbPath = process.env.SIDEKICK_DB ?? ".data/sidekick.db";
  if (!dbPath.startsWith("/")) {
    problems.push(
      `SIDEKICK_DB is a relative path (${dbPath}), which on most hosts lives inside\n` +
        "    the container and is erased on every restart, taking every account with it.\n" +
        "    Fix: point it at a mounted volume, e.g. /data/sidekick.db.",
    );
  }

  if (problems.length) {
    throw new Error(
      `\n\nSidekick refused to start — ${problems.length} configuration ${
        problems.length === 1 ? "problem" : "problems"
      }:\n\n` +
        problems.map((p, i) => `  ${i + 1}. ${p}`).join("\n\n") +
        "\n\nSee .env.example for the full list.\n",
    );
  }

  console.log("Sidekick: configuration checks passed.");
}
