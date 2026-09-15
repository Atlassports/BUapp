/**
 * Sends a real verification email so you can confirm delivery works before
 * handing the app to an actual student.
 *
 *   npm run mail:test you@bu.edu
 */
import { MailError, mailFrom, mailIsConfigured, sendVerificationCode } from "../lib/mail";

async function main() {
  const to = process.argv[2];

  if (!to) {
    console.error("Usage: npm run mail:test -- you@bu.edu");
    process.exit(1);
  }

  if (!mailIsConfigured()) {
    console.error(
      "\nRESEND_API_KEY is not set.\n\n" +
        "  1. Create a key at https://resend.com/api-keys\n" +
        "  2. Add it to .env as RESEND_API_KEY=re_...\n" +
        "  3. Run this again.\n",
    );
    process.exit(1);
  }

  console.log(`Sending a test code from ${mailFrom()} to ${to}…`);

  try {
    const result = await sendVerificationCode(to, "123456");
    console.log(`\n✓ Accepted by Resend${result.id ? ` (id ${result.id})` : ""}.`);
    console.log("  Check the inbox — and the spam folder, where a new sending domain usually lands first.");
  } catch (err) {
    if (err instanceof MailError) {
      console.error(`\n✗ ${err.message}`);
      if (err.remedy) console.error(`\n  ${err.remedy}`);
    } else {
      console.error("\n✗ Unexpected failure:", err);
    }
    process.exit(1);
  }
}

void main();
