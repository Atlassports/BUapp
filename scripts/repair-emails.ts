/**
 * Repairs accounts created before the pending-cookie parsing fix, which
 * truncated addresses at their first dot and left people unable to sign in.
 *
 *   npm run db:repair                          # report and auto-fix what it can
 *   npm run db:repair -- mikec you@bu.edu      # set one account's address by hand
 */
import { all, get, run } from "../lib/db";

const DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "bu.edu";
const VALID = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/;

type Row = { id: string; email: string; handle: string; name: string };

function isBroken(email: string): boolean {
  if (!VALID.test(email)) return true;
  const domain = email.split("@")[1];
  return domain !== DOMAIN && !domain.endsWith(`.${DOMAIN}`);
}

/** The stored value is everything up to the first dot of the real address. */
function repairCandidate(email: string): string | null {
  if (!email.includes("@")) return null; // the local part held the dot; unrecoverable
  const [local, domainStart] = email.split("@");
  if (!local || !domainStart) return null;
  if (!DOMAIN.startsWith(domainStart)) return null;
  const rebuilt = `${local}@${DOMAIN}`;
  return VALID.test(rebuilt) ? rebuilt : null;
}

const [handleArg, emailArg] = process.argv.slice(2);

if (handleArg && emailArg) {
  const target = get<Row>(`SELECT id, email, handle, name FROM users WHERE handle = ?`, handleArg);
  if (!target) {
    console.error(`No account with handle "${handleArg}".`);
    process.exit(1);
  }
  const next = emailArg.trim().toLowerCase();
  if (!VALID.test(next)) {
    console.error(`"${next}" is not a valid email address.`);
    process.exit(1);
  }
  if (get(`SELECT 1 FROM users WHERE email = ? AND handle != ?`, next, handleArg)) {
    console.error(`Another account already uses ${next}.`);
    process.exit(1);
  }
  run(`UPDATE users SET email = ? WHERE id = ?`, next, target.id);
  console.log(`✓ ${target.name} (@${target.handle}): ${target.email} → ${next}`);
  console.log("  You can sign in with that address now.");
  process.exit(0);
}

const broken = all<Row>(`SELECT id, email, handle, name FROM users`).filter((u) => isBroken(u.email));

if (!broken.length) {
  console.log("No damaged accounts. Every address is well-formed.");
  process.exit(0);
}

console.log(`Found ${broken.length} account${broken.length === 1 ? "" : "s"} with a truncated address.\n`);

const stuck: Row[] = [];
for (const user of broken) {
  const fixed = repairCandidate(user.email);
  if (!fixed) {
    stuck.push(user);
    continue;
  }
  if (get(`SELECT 1 FROM users WHERE email = ? AND id != ?`, fixed, user.id)) {
    console.log(`!  @${user.handle}: ${user.email} → ${fixed} already belongs to another account; skipped.`);
    stuck.push(user);
    continue;
  }
  run(`UPDATE users SET email = ? WHERE id = ?`, fixed, user.id);
  console.log(`✓  @${user.handle} (${user.name}): ${user.email} → ${fixed}`);
}

if (stuck.length) {
  console.log(
    `\n${stuck.length} could not be repaired automatically — the address lost its local part,\n` +
      `so the original isn't recoverable from what was stored:\n`,
  );
  for (const u of stuck) console.log(`   @${u.handle} (${u.name})  stored as "${u.email}"`);
  console.log(`\nSet each one by hand:\n\n   npm run db:repair -- ${stuck[0].handle} ${stuck[0].handle}@${DOMAIN}\n`);
}
