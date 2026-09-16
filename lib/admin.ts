import { all, get, run } from "./db";
import { publicUserById } from "./auth";
import type { PublicUser, Task, User } from "./types";

/**
 * Moderation.
 *
 * Connecting students for in-person work without a way to act on a report is
 * not something to launch. Access is by email allowlist in the environment,
 * not a database flag, so revoking an admin never depends on the database
 * being reachable or uncorrupted.
 */

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdmin(user: Pick<User, "email"> | null): boolean {
  if (!user) return false;
  return adminEmails().includes(user.email.toLowerCase());
}

export type ReportRow = {
  id: string;
  reporter_id: string;
  target_type: "user" | "task";
  target_id: string;
  reason: string;
  detail: string;
  status: string;
  resolution: string;
  resolved_at: number | null;
  created_at: number;
};

export type ReportView = ReportRow & {
  reporter: PublicUser | null;
  target_user: PublicUser | null;
  target_task: Task | null;
};

export function listReports(status: "open" | "resolved" | "all" = "open"): ReportView[] {
  const where = status === "all" ? "" : `WHERE status = '${status === "open" ? "open" : "resolved"}'`;
  return all<ReportRow>(`SELECT * FROM reports ${where} ORDER BY created_at DESC LIMIT 200`).map((r) => ({
    ...r,
    reporter: publicUserById(r.reporter_id),
    target_user: r.target_type === "user" ? publicUserById(r.target_id) : null,
    target_task: r.target_type === "task" ? get<Task>(`SELECT * FROM tasks WHERE id = ?`, r.target_id) ?? null : null,
  }));
}

export function resolveReport(reportId: string, resolution: string): void {
  run(
    `UPDATE reports SET status = 'resolved', resolved_at = ?, resolution = ? WHERE id = ?`,
    Date.now(),
    resolution.slice(0, 300),
    reportId,
  );
}

export function suspendUser(userId: string, reason: string): void {
  run(`UPDATE users SET suspended_at = ?, suspended_reason = ? WHERE id = ?`, Date.now(), reason.slice(0, 200), userId);
  // A suspended account must not keep an active session.
  run(`DELETE FROM sessions WHERE user_id = ?`, userId);
  // Their open tasks come down with them.
  run(`UPDATE tasks SET status = 'cancelled' WHERE poster_id = ? AND status = 'open'`, userId);
}

export function unsuspendUser(userId: string): void {
  run(`UPDATE users SET suspended_at = NULL, suspended_reason = '' WHERE id = ?`, userId);
}

export function removeTask(taskId: string): void {
  run(`UPDATE tasks SET status = 'cancelled' WHERE id = ?`, taskId);
}

export type AdminStats = {
  users: number;
  verified: number;
  suspended: number;
  tasks_open: number;
  tasks_completed: number;
  gmv_cents: number;
  fees_cents: number;
  offers: number;
  messages: number;
  orgs: number;
  reports_open: number;
  signups_7d: number;
  tasks_7d: number;
};

export function adminStats(): AdminStats {
  const week = Date.now() - 7 * 24 * 3600_000;
  const count = (sql: string, ...p: (string | number)[]) =>
    get<{ c: number }>(sql, ...p)?.c ?? 0;

  const completed = all<{ agreed_cents: number | null }>(
    `SELECT agreed_cents FROM tasks WHERE status = 'completed'`,
  );
  const gmv = completed.reduce((sum, t) => sum + (t.agreed_cents ?? 0), 0);
  // Mirrors lib/pricing: 5% on the first $20, 10% above it.
  const fees = completed.reduce((sum, t) => {
    const cents = t.agreed_cents ?? 0;
    return sum + Math.round(Math.min(cents, 2000) * 0.05 + Math.max(0, cents - 2000) * 0.1);
  }, 0);

  return {
    users: count(`SELECT COUNT(*) AS c FROM users`),
    verified: count(`SELECT COUNT(*) AS c FROM users WHERE verified_at IS NOT NULL`),
    suspended: count(`SELECT COUNT(*) AS c FROM users WHERE suspended_at IS NOT NULL`),
    tasks_open: count(`SELECT COUNT(*) AS c FROM tasks WHERE status = 'open'`),
    tasks_completed: completed.length,
    gmv_cents: gmv,
    fees_cents: fees,
    offers: count(`SELECT COUNT(*) AS c FROM offers`),
    messages: count(`SELECT COUNT(*) AS c FROM messages`),
    orgs: count(`SELECT COUNT(*) AS c FROM orgs`),
    reports_open: count(`SELECT COUNT(*) AS c FROM reports WHERE status = 'open'`),
    signups_7d: count(`SELECT COUNT(*) AS c FROM users WHERE created_at > ?`, week),
    tasks_7d: count(`SELECT COUNT(*) AS c FROM tasks WHERE created_at > ?`, week),
  };
}

export function recentUsers(limit = 50): Array<PublicUser & { email: string; suspended_at: number | null }> {
  return all<User>(`SELECT * FROM users ORDER BY created_at DESC LIMIT ?`, limit).map((u) => ({
    ...publicUserById(u.id)!,
    email: u.email,
    suspended_at: (u as User & { suspended_at: number | null }).suspended_at ?? null,
  }));
}
