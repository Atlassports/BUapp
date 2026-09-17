/**
 * Empties the database and leaves it empty — no demo students, no invented
 * listings. This is what launch day actually looks like: a sign-in screen and
 * a feed with nothing in it.
 *
 *   npm run db:fresh
 */
import { db } from "../lib/db";

if (process.env.NODE_ENV === "production" || process.env.FLY_APP_NAME) {
  console.error("\nRefusing to wipe what looks like a production database.\n");
  process.exit(1);
}

const tables = [
  "reviews", "messages", "offers", "payments", "stripe_events", "photos",
  "saved_tasks", "notifications", "push_subscriptions", "device_tokens",
  "tasks", "org_members", "orgs", "blocks", "reports", "sessions",
  "verification_codes", "users",
];

for (const table of tables) {
  try {
    db.exec(`DELETE FROM ${table}`);
  } catch {
    // A table from a newer migration that this database predates.
  }
}

console.log("Database emptied. No accounts, no tasks — exactly what a new deploy starts with.");
console.log("Sign up with any @bu.edu address; the code prints to the server console.");
