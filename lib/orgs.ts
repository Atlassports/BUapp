import { all, get, id, run } from "./db";
import { publicUserById } from "./auth";
import type { PublicUser, Task } from "./types";
import { ORG_CATEGORIES } from "./org-constants";

/**
 * Student organizations.
 *
 * Clubs live in their own section rather than the main feed. Org work has a
 * different rhythm — a photographer for an event three weeks out — and mixing
 * it into the peer feed would bury the $15 package pickups that make the
 * marketplace feel alive. Same verification either way: whoever runs the org
 * is a BU student with a verified address.
 */

export type Org = {
  id: string;
  slug: string;
  name: string;
  blurb: string;
  emoji: string;
  avatar_hue: number;
  category: string;
  verified_at: number | null;
  created_by: string;
  created_at: number;
};

export type OrgMember = { org_id: string; user_id: string; role: "owner" | "admin" | "member" };

export { ORG_CATEGORIES } from "./org-constants";

function slugify(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 32) || "org";
  let slug = base;
  let n = 1;
  while (get(`SELECT 1 FROM orgs WHERE slug = ?`, slug)) slug = `${base}-${++n}`;
  return slug;
}

export function createOrg(input: {
  name: string;
  blurb: string;
  emoji: string;
  category: string;
  createdBy: string;
}): Org {
  const orgId = id("org");
  const now = Date.now();
  run(
    `INSERT INTO orgs (id, slug, name, blurb, emoji, avatar_hue, category, verified_at, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    orgId,
    slugify(input.name),
    input.name.trim().slice(0, 60),
    input.blurb.trim().slice(0, 300),
    input.emoji || "🎓",
    Math.floor(Math.random() * 360),
    input.category,
    // Created by a verified student, so the org inherits that verification.
    now,
    input.createdBy,
    now,
  );
  run(
    `INSERT INTO org_members (org_id, user_id, role, created_at) VALUES (?,?,'owner',?)`,
    orgId,
    input.createdBy,
    now,
  );
  return get<Org>(`SELECT * FROM orgs WHERE id = ?`, orgId)!;
}

export function listOrgs(): Array<Org & { member_count: number; open_tasks: number }> {
  return all<Org>(`SELECT * FROM orgs ORDER BY created_at DESC`).map((org) => ({
    ...org,
    member_count: get<{ c: number }>(`SELECT COUNT(*) AS c FROM org_members WHERE org_id = ?`, org.id)?.c ?? 0,
    open_tasks:
      get<{ c: number }>(`SELECT COUNT(*) AS c FROM tasks WHERE org_id = ? AND status = 'open'`, org.id)?.c ?? 0,
  }));
}

export function orgBySlug(slug: string): Org | undefined {
  return get<Org>(`SELECT * FROM orgs WHERE slug = ?`, slug);
}

export function orgById(orgId: string): Org | undefined {
  return get<Org>(`SELECT * FROM orgs WHERE id = ?`, orgId);
}

export function orgsForUser(userId: string): Array<Org & { role: string }> {
  return all<Org & { role: string }>(
    `SELECT o.*, m.role FROM orgs o JOIN org_members m ON m.org_id = o.id
     WHERE m.user_id = ? ORDER BY o.name`,
    userId,
  );
}

export function orgMembers(orgId: string): Array<{ user: PublicUser; role: string; created_at: number }> {
  const rows = all<{ user_id: string; role: string; created_at: number }>(
    `SELECT user_id, role, created_at FROM org_members WHERE org_id = ?
     ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, created_at`,
    orgId,
  );
  return rows
    .map((r) => ({ user: publicUserById(r.user_id), role: r.role, created_at: r.created_at }))
    .filter((r): r is { user: PublicUser; role: string; created_at: number } => r.user !== null);
}

export function roleInOrg(orgId: string, userId: string): string | null {
  return (
    get<{ role: string }>(`SELECT role FROM org_members WHERE org_id = ? AND user_id = ?`, orgId, userId)
      ?.role ?? null
  );
}

/** Anyone BU-verified can join; posting on the org's behalf needs owner or admin. */
export function joinOrg(orgId: string, userId: string): void {
  run(
    `INSERT OR IGNORE INTO org_members (org_id, user_id, role, created_at) VALUES (?,?,'member',?)`,
    orgId,
    userId,
    Date.now(),
  );
}

export function leaveOrg(orgId: string, userId: string): { ok: boolean; error?: string } {
  if (roleInOrg(orgId, userId) === "owner") {
    const owners = get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM org_members WHERE org_id = ? AND role = 'owner'`,
      orgId,
    )?.c ?? 0;
    if (owners <= 1) {
      return { ok: false, error: "Promote another owner before leaving — an org can't be ownerless." };
    }
  }
  run(`DELETE FROM org_members WHERE org_id = ? AND user_id = ?`, orgId, userId);
  return { ok: true };
}

export function setMemberRole(orgId: string, userId: string, role: "owner" | "admin" | "member"): void {
  run(`UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?`, role, orgId, userId);
}

export function canPostForOrg(orgId: string, userId: string): boolean {
  const role = roleInOrg(orgId, userId);
  return role === "owner" || role === "admin";
}

export function orgTasks(orgId: string): Task[] {
  return all<Task>(`SELECT * FROM tasks WHERE org_id = ? ORDER BY created_at DESC`, orgId);
}

export function updateOrg(orgId: string, patch: { name: string; blurb: string; emoji: string; category: string }) {
  run(
    `UPDATE orgs SET name = ?, blurb = ?, emoji = ?, category = ? WHERE id = ?`,
    patch.name.trim().slice(0, 60),
    patch.blurb.trim().slice(0, 300),
    patch.emoji || "🎓",
    patch.category,
    orgId,
  );
}
