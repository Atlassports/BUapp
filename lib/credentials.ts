/**
 * Pure credential logic: no cookies, no database, no server-only import.
 *
 * It lives apart from lib/auth.ts so it can be tested directly. The bug that
 * locked a real account out — an email truncated at its first dot — was in
 * exactly this kind of pure function, and it was untestable while it sat
 * behind a `server-only` boundary.
 */

export const DEV_SECRET = "dev-secret-change-me";

/**
 * Verification is the whole trust story, so the check is strict: a real
 * address at the allowed domain, not "pick your school from a dropdown".
 */
export function normalizeEmailFor(raw: string, domain: string): string | null {
  const email = raw.trim().toLowerCase();
  if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) return null;
  const host = email.split("@")[1];
  if (host !== domain && !host.endsWith(`.${domain}`)) return null;
  return email;
}

export type Pending = { email: string; exp: number };

/**
 * base64url-encoded JSON rather than delimiter-joined text. Email addresses
 * contain dots, so joining on one and splitting it back apart truncated the
 * address at its first dot — signing someone up as `mikec@bu`, or as bare
 * `first` for `first.last@bu.edu`, which made the real address unfindable and
 * locked them out permanently. The same split left the expiry as NaN, and
 * `NaN < Date.now()` is false, so the window silently never expired.
 * base64url contains no dots, so the signature separator stays unambiguous.
 */
export function encodePending(value: Pending): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodePending(payload: string): Pending | null {
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) return null;
    const { email, exp } = parsed as Partial<Pending>;
    if (typeof email !== "string" || typeof exp !== "number" || !Number.isFinite(exp)) return null;
    return { email, exp };
  } catch {
    return null;
  }
}

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
