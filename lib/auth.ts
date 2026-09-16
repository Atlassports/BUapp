import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { all, get, id, run } from "./db";
import type { PublicUser, User } from "./types";
import type { TransportId } from "./taxonomy";
import {
  DEV_SECRET,
  decodePending,
  encodePending,
  normalizeEmailFor,
  trustScore as computeTrustScore,
} from "./credentials";

const SESSION_COOKIE = "sk_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CODE_TTL_MS = 1000 * 60 * 10;
const MAX_CODE_ATTEMPTS = 5;

export const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "bu.edu";

/**
 * The secret signs verification codes and the pending-signup cookie. Running
 * production on the checked-in default would let anyone forge that cookie and
 * register any @bu.edu address without ever receiving a code, so it's a hard
 * failure rather than a warning.
 */
function secret(): string {
  const value = process.env.SIDEKICK_SECRET;
  if (value && value !== DEV_SECRET) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SIDEKICK_SECRET is unset or still the development default. Generate one with `openssl rand -hex 32` before running in production.",
    );
  }
  return DEV_SECRET;
}

export function normalizeEmail(raw: string): string | null {
  return normalizeEmailFor(raw, ALLOWED_DOMAIN);
}

function hashCode(email: string, code: string): string {
  return createHash("sha256").update(`${secret()}:${email}:${code}`).digest("hex");
}

export function issueCode(email: string): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const now = Date.now();
  // Supersede anything outstanding for this address.
  run(`UPDATE verification_codes SET consumed_at = ? WHERE email = ? AND consumed_at IS NULL`, now, email);
  run(
    `INSERT INTO verification_codes (email, code_hash, expires_at, created_at)
     VALUES (?, ?, ?, ?)`,
    email,
    hashCode(email, code),
    now + CODE_TTL_MS,
    now,
  );
  return code;
}

export type CodeCheck = { ok: true } | { ok: false; reason: string };

export function checkCode(email: string, code: string): CodeCheck {
  const row = get<{ rowid: number; code_hash: string; expires_at: number; attempts: number }>(
    `SELECT rowid, code_hash, expires_at, attempts FROM verification_codes
     WHERE email = ? AND consumed_at IS NULL
     ORDER BY created_at DESC LIMIT 1`,
    email,
  );
  if (!row) return { ok: false, reason: "Request a new code." };
  if (row.expires_at < Date.now()) return { ok: false, reason: "That code expired. Request a new one." };
  if (row.attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false, reason: "Too many attempts. Request a new code." };
  }

  const expected = Buffer.from(row.code_hash, "hex");
  const actual = Buffer.from(hashCode(email, code.trim()), "hex");
  const match = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!match) {
    run(`UPDATE verification_codes SET attempts = attempts + 1 WHERE rowid = ?`, row.rowid);
    return { ok: false, reason: "That code doesn't match." };
  }
  run(`UPDATE verification_codes SET consumed_at = ? WHERE rowid = ?`, Date.now(), row.rowid);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export async function startSession(userId: string) {
  const token = id("sess");
  const now = Date.now();
  run(
    `INSERT INTO sessions (token, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
    token,
    userId,
    now + SESSION_TTL_MS,
    now,
  );
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run(`DELETE FROM sessions WHERE token = ?`, token);
  jar.delete(SESSION_COOKIE);
}

export async function currentUser(): Promise<User | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const row = get<User>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > ?`,
    token,
    Date.now(),
  );
  return row ?? null;
}

/**
 * For pages: a missing or expired session sends the visitor to sign-in rather
 * than surfacing an error screen.
 */
export async function requireUser(): Promise<User> {
  const user = await currentUser();
  if (!user) redirect("/welcome");
  return user;
}

/* ------------------------------------------------------------------ */
/* Account creation                                                    */
/* ------------------------------------------------------------------ */

export function findUserByEmail(email: string): User | undefined {
  return get<User>(`SELECT * FROM users WHERE email = ?`, email);
}

/** Derives a unique @handle from the BU email local part. */
export function deriveHandle(email: string): string {
  const base = email.split("@")[0].replace(/[^a-z0-9]/g, "").slice(0, 16) || "terrier";
  let handle = base;
  let n = 1;
  while (get(`SELECT 1 FROM users WHERE handle = ?`, handle)) handle = `${base}${++n}`;
  return handle;
}

export function createUser(input: {
  email: string;
  name: string;
  classYear: string;
  homeArea: string;
  homeLat: number;
  homeLng: number;
  transport: TransportId[];
  skills: string[];
  bio: string;
}): User {
  const now = Date.now();
  const userId = id("usr");
  run(
    `INSERT INTO users
      (id, email, handle, name, avatar_hue, bio, class_year, home_area, home_lat, home_lng,
       transport, skills, verified_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    userId,
    input.email,
    deriveHandle(input.email),
    input.name.trim().slice(0, 60),
    Math.floor(Math.random() * 360),
    input.bio.trim().slice(0, 240),
    input.classYear,
    input.homeArea,
    input.homeLat,
    input.homeLng,
    input.transport.join(","),
    input.skills.join(","),
    now,
    now,
  );
  return get<User>(`SELECT * FROM users WHERE id = ?`, userId)!;
}

/* ------------------------------------------------------------------ */
/* Reputation                                                          */
/* ------------------------------------------------------------------ */

export const trustScore = computeTrustScore;

export function toPublicUser(u: User): PublicUser {
  const agg = get<{ avg: number | null; count: number }>(
    `SELECT AVG(stars) AS avg, COUNT(*) AS count FROM reviews WHERE subject_id = ?`,
    u.id,
  );
  const done = get<{ count: number }>(
    `SELECT COUNT(*) AS count FROM tasks WHERE assignee_id = ? AND status = 'completed'`,
    u.id,
  );
  const rating = agg?.avg ?? null;
  const review_count = agg?.count ?? 0;
  const completed_count = done?.count ?? 0;
  const verified = u.verified_at !== null;
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    avatar_hue: u.avatar_hue,
    bio: u.bio,
    class_year: u.class_year,
    home_area: u.home_area,
    transport: (u.transport ? u.transport.split(",") : []) as TransportId[],
    skills: u.skills ? u.skills.split(",").filter(Boolean) : [],
    verified,
    rating: rating === null ? null : Math.round(rating * 10) / 10,
    review_count,
    completed_count,
    trust_score: trustScore({ verified, rating, review_count, completed_count, created_at: u.created_at }),
    available_until: u.available_until,
    created_at: u.created_at,
  };
}

export function publicUserById(userId: string): PublicUser | null {
  const u = get<User>(`SELECT * FROM users WHERE id = ?`, userId);
  return u ? toPublicUser(u) : null;
}

export function allUsers(): User[] {
  return all<User>(`SELECT * FROM users ORDER BY created_at DESC`);
}

/* ------------------------------------------------------------------ */
/* Pending verification                                                */
/* ------------------------------------------------------------------ */

const PENDING_COOKIE = "sk_pending";
const PENDING_TTL_MS = 1000 * 60 * 30;

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("hex").slice(0, 32);
}

/**
 * Bridges "this address proved it owns a bu.edu inbox" and "this person
 * finished a profile", without trusting the email the client posts back.
 *
 * The payload is base64url-encoded JSON rather than delimiter-joined text.
 * Email addresses contain dots, so joining on one and splitting it back apart
 * truncated the address at its first dot — signing someone up as `mikec@bu`,
 * or as bare `first` for `first.last@bu.edu`, which then made the real address
 * unfindable and locked them out of their own account permanently. The same
 * split also left the expiry as NaN, and `NaN < Date.now()` is false, so the
 * 30-minute window silently never expired. base64url contains no dots, so the
 * signature separator stays unambiguous.
 */
export async function setPendingEmail(email: string) {
  const payload = encodePending({ email, exp: Date.now() + PENDING_TTL_MS });
  const jar = await cookies();
  jar.set(PENDING_COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_TTL_MS / 1000,
  });
}

export async function readPendingEmail(): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(PENDING_COOKIE)?.value;
  if (!raw) return null;

  const idx = raw.lastIndexOf(".");
  if (idx < 0) return null;

  const payload = raw.slice(0, idx);
  const expected = Buffer.from(sign(payload));
  const actual = Buffer.from(raw.slice(idx + 1));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

  const pending = decodePending(payload);
  if (!pending) return null;
  if (pending.exp < Date.now()) return null;

  // The address is re-validated on the way out, so a token minted before the
  // allowed domain changed can't be used to slip past the current rule.
  return normalizeEmail(pending.email);
}

export async function clearPendingEmail() {
  (await cookies()).delete(PENDING_COOKIE);
}

/** Crude per-address throttle so the code endpoint can't be used to spam inboxes. */
export function recentCodeCount(email: string, windowMs = 1000 * 60 * 15): number {
  return (
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM verification_codes WHERE email = ? AND created_at > ?`,
      email,
      Date.now() - windowMs,
    )?.c ?? 0
  );
}
