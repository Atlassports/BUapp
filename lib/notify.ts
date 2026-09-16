import { all, get, id, run } from "./db";
import { sendApns } from "./apns";
import { sendPush } from "./push";

/**
 * One place that decides a person should hear about something.
 *
 * Every notification lands in the in-app activity feed, which always works.
 * On top of that it fans out to whichever transports are configured: APNs for
 * the App Store build, Web Push for browsers and installed PWAs. Someone on
 * both gets one alert per device they actually use, and someone on neither
 * still sees everything in the feed.
 */

export type NotificationKind =
  | "offer_received"
  | "offer_accepted"
  | "offer_declined"
  | "message"
  | "task_completed"
  | "review_received"
  | "task_cancelled"
  | "org_invite";

export type Notification = {
  id: string;
  user_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  link: string;
  actor_id: string | null;
  read_at: number | null;
  created_at: number;
};

/** Per-kind opt-outs, so the settings screen means something. */
function allowed(userId: string, kind: NotificationKind): boolean {
  const prefs = get<{ notify_offers: number; notify_messages: number }>(
    `SELECT notify_offers, notify_messages FROM users WHERE id = ?`,
    userId,
  );
  if (!prefs) return false;
  if (kind === "message") return prefs.notify_messages === 1;
  if (kind === "offer_received" || kind === "offer_accepted" || kind === "offer_declined") {
    return prefs.notify_offers === 1;
  }
  return true;
}

export async function notify(input: {
  userId: string;
  kind: NotificationKind;
  title: string;
  body?: string;
  link?: string;
  actorId?: string | null;
}): Promise<void> {
  if (!allowed(input.userId, input.kind)) return;

  const link = input.link ?? "/feed";
  run(
    `INSERT INTO notifications (id, user_id, kind, title, body, link, actor_id, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    id("ntf"),
    input.userId,
    input.kind,
    input.title,
    input.body ?? "",
    link,
    input.actorId ?? null,
    Date.now(),
  );

  // Never let a push provider outage break the thing that triggered it.
  const payload = { title: input.title, body: input.body ?? "", link };
  const results = await Promise.allSettled([
    sendApns(input.userId, { ...payload, collapseId: input.kind }),
    sendPush(input.userId, { ...payload, tag: input.kind }),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error("notification delivery failed", result.reason);
  }
}

export function notificationsFor(userId: string, limit = 60): Notification[] {
  return all<Notification>(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    userId,
    limit,
  );
}

export function unreadNotificationCount(userId: string): number {
  return (
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      userId,
    )?.c ?? 0
  );
}

export function markNotificationsRead(userId: string): void {
  run(`UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL`, Date.now(), userId);
}
