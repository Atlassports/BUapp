import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomInt, timingSafeEqual } from "node:crypto";
import { all, get, id, run } from "./db";
import type { PublicUser, User } from "./types";
import type { TransportId } from "./taxonomy";

const SESSION_COOKIE = "sk_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const CODE_TTL_MS = 1000 * 60 * 10;
const MAX_CODE_ATTEMPTS = 5;

export const ALLOWED_DOMAIN = process.env.ALLOWED_EMAIL_DOMAIN ?? "bu.edu";

/**
 * Verification is the whole trust story, so the check is strict: a real
 * @bu.edu address, not "pick your school from a dropdown".
 */
export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  const domain = email.split("@")[1];
  if (domain !== ALLOWED_DOMAIN && !domain.endsWith(`.${ALLOWED_DOMAIN}`)) return null;
  return email;
}

function hashCode(email: string, code: string): string {
  const secret = process.env.SIDEKICK_SECRET ?? "dev-secret-change-me";
  return createHash("sha256").update(`${secret}:${email}:${code}`).digest("hex");
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

/**
 * Campus Trust Score. Deliberately separate from the public star rating:
 * stars are how good you are, trust is how safe you are to transact with.
 */
export function trustScore(u: {
  verified: boolean;
  rating: number | null;
  review_count: number;
  completed_count: number;
  created_at: number;
}): number {
  let score = u.verified ? 55 : 20;
  score += Math.min(20, u.completed_count * 2);
  if (u.rating !== null) score += Math.round((u.rating - 3) * 7);
  score += Math.min(8, Math.floor((Date.now() - u.created_at) / (1000 * 60 * 60 * 24 * 30)) * 2);
  score += Math.min(5, u.review_count);
  return Math.max(0, Math.min(99, score));
}

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
  const secret = process.env.SIDEKICK_SECRET ?? "dev-secret-change-me";
  return createHash("sha256").update(`${secret}:${payload}`).digest("hex").slice(0, 32);
}

/**
 * Bridges "this address proved it owns a bu.edu inbox" and "this person
 * finished a profile", without trusting the email the client posts back.
 */
export async function setPendingEmail(email: string) {
  const expires = Date.now() + PENDING_TTL_MS;
  const payload = `${email}.${expires}`;
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
  if (sign(payload) !== raw.slice(idx + 1)) return null;
  const [email, expires] = payload.split(".");
  if (!email || Number(expires) < Date.now()) return null;
  return email;
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
