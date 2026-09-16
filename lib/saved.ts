import { all, get, run } from "./db";

/** Bookmarks. Cheap to add, and the thing people reach for on a task they
 *  want but can't take this minute. */

export function saveTask(userId: string, taskId: string): void {
  run(
    `INSERT OR IGNORE INTO saved_tasks (user_id, task_id, created_at) VALUES (?,?,?)`,
    userId,
    taskId,
    Date.now(),
  );
}

export function unsaveTask(userId: string, taskId: string): void {
  run(`DELETE FROM saved_tasks WHERE user_id = ? AND task_id = ?`, userId, taskId);
}

export function isSaved(userId: string, taskId: string): boolean {
  return Boolean(get(`SELECT 1 FROM saved_tasks WHERE user_id = ? AND task_id = ?`, userId, taskId));
}

export function savedTaskIds(userId: string): string[] {
  return all<{ task_id: string }>(
    `SELECT task_id FROM saved_tasks WHERE user_id = ? ORDER BY created_at DESC`,
    userId,
  ).map((r) => r.task_id);
}

export function savedCount(userId: string): number {
  return get<{ c: number }>(`SELECT COUNT(*) AS c FROM saved_tasks WHERE user_id = ?`, userId)?.c ?? 0;
}
