import webpush from "web-push";
import { all, id, run } from "./db";

/**
 * Web Push.
 *
 * This is how a web app reaches a phone's notification centre. On iOS it works
 * only once the site is installed to the Home Screen — Apple routes it through
 * APNs from there — which is why the install prompt is part of onboarding
 * rather than a nicety.
 *
 * Without VAPID keys configured, every send is a no-op and the in-app activity
 * feed carries the whole load. Generate a pair with: npm run push:keys
 */

export type PushSubscription = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: number;
};

export function pushIsConfigured(): boolean {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

let configured = false;
function ensureConfigured() {
  if (configured || !pushIsConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:hello@example.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  configured = true;
}

export function saveSubscription(userId: string, sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  run(
    `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
     VALUES (?,?,?,?,?,?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id,
       p256dh = excluded.p256dh, auth = excluded.auth`,
    id("sub"),
    userId,
    sub.endpoint,
    sub.keys.p256dh,
    sub.keys.auth,
    Date.now(),
  );
}

export function removeSubscription(endpoint: string) {
  run(`DELETE FROM push_subscriptions WHERE endpoint = ?`, endpoint);
}

export function subscriptionsFor(userId: string): PushSubscription[] {
  return all<PushSubscription>(`SELECT * FROM push_subscriptions WHERE user_id = ?`, userId);
}

/** Fire-and-forget: a failed push must never fail the action that caused it. */
export async function sendPush(
  userId: string,
  payload: { title: string; body: string; link: string; tag?: string },
): Promise<void> {
  if (!pushIsConfigured()) return;
  ensureConfigured();

  const subs = subscriptionsFor(userId);
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // 404/410 mean the browser threw the subscription away; stop retrying it.
        if (status === 404 || status === 410) removeSubscription(sub.endpoint);
        else console.error("push failed", status, err);
      }
    }),
  );
}
