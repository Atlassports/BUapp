import { connect, constants, type ClientHttp2Session } from "node:http2";
import { createSign } from "node:crypto";
import { all, get, id, run } from "./db";

/**
 * Apple Push Notification service, for the App Store build.
 *
 * Implemented directly against the APNs HTTP/2 API rather than through a
 * client library: it is a signed JWT and a POST, and this keeps the dependency
 * surface of a payments-adjacent app small.
 *
 * Needs, from developer.apple.com → Keys:
 *   APNS_KEY_ID       the 10-character Key ID
 *   APNS_TEAM_ID      your 10-character Team ID
 *   APNS_PRIVATE_KEY  contents of the .p8 file (newlines as \n)
 *   APNS_BUNDLE_ID    e.g. com.sidekick.bu
 *   APNS_ENVIRONMENT  sandbox during development, production once shipped
 *
 * Without these, every send is a no-op and the in-app activity feed carries it.
 */

const HOSTS = {
  production: "https://api.push.apple.com",
  sandbox: "https://api.sandbox.push.apple.com",
} as const;

export type DeviceToken = {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  environment: string;
};

export function apnsIsConfigured(): boolean {
  return Boolean(
    process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_PRIVATE_KEY &&
      process.env.APNS_BUNDLE_ID,
  );
}

function environment(): keyof typeof HOSTS {
  return process.env.APNS_ENVIRONMENT === "sandbox" ? "sandbox" : "production";
}

/* ------------------------------------------------------------------ */
/* Provider token                                                      */
/* ------------------------------------------------------------------ */

let cached: { token: string; madeAt: number } | null = null;

/**
 * APNs provider tokens are ES256 JWTs. Apple rejects tokens older than an hour
 * and rate-limits regeneration, so it is refreshed on a 50-minute cycle.
 */
function providerToken(): string {
  if (cached && Date.now() - cached.madeAt < 50 * 60_000) return cached.token;

  const header = { alg: "ES256", kid: process.env.APNS_KEY_ID };
  const claims = { iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) };
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");

  const unsigned = `${encode(header)}.${encode(claims)}`;
  const key = (process.env.APNS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

  const signer = createSign("SHA256");
  signer.update(unsigned);
  const signature = signer.sign({ key, dsaEncoding: "ieee-p1363" }).toString("base64url");

  const token = `${unsigned}.${signature}`;
  cached = { token, madeAt: Date.now() };
  return token;
}

/* ------------------------------------------------------------------ */
/* Token storage                                                       */
/* ------------------------------------------------------------------ */

export function registerDeviceToken(userId: string, token: string, platform = "ios") {
  const now = Date.now();
  run(
    `INSERT INTO device_tokens (id, user_id, token, platform, environment, created_at, last_seen)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(token) DO UPDATE SET user_id = excluded.user_id, last_seen = excluded.last_seen`,
    id("dev"),
    userId,
    token,
    platform,
    environment(),
    now,
    now,
  );
}

export function removeDeviceToken(token: string) {
  run(`DELETE FROM device_tokens WHERE token = ?`, token);
}

export function deviceTokensFor(userId: string): DeviceToken[] {
  return all<DeviceToken>(`SELECT * FROM device_tokens WHERE user_id = ?`, userId);
}

export function badgeCountFor(userId: string): number {
  return (
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND read_at IS NULL`,
      userId,
    )?.c ?? 0
  );
}

/* ------------------------------------------------------------------ */
/* Sending                                                             */
/* ------------------------------------------------------------------ */

export type ApnsPayload = {
  title: string;
  body: string;
  link: string;
  badge?: number;
  collapseId?: string;
};

/** One HTTP/2 session serves every send in a burst, then closes. */
async function withSession<T>(fn: (session: ClientHttp2Session) => Promise<T>): Promise<T> {
  const session = connect(HOSTS[environment()]);
  try {
    return await fn(session);
  } finally {
    session.close();
  }
}

export async function sendApns(userId: string, payload: ApnsPayload): Promise<void> {
  if (!apnsIsConfigured()) return;
  const tokens = deviceTokensFor(userId);
  if (!tokens.length) return;

  const body = JSON.stringify({
    aps: {
      alert: { title: payload.title, body: payload.body },
      sound: "default",
      badge: payload.badge ?? badgeCountFor(userId),
      "thread-id": payload.collapseId,
    },
    link: payload.link,
  });

  await withSession(async (session) => {
    await Promise.all(
      tokens.map(
        (device) =>
          new Promise<void>((resolve) => {
            const request = session.request({
              [constants.HTTP2_HEADER_METHOD]: "POST",
              [constants.HTTP2_HEADER_PATH]: `/3/device/${device.token}`,
              authorization: `bearer ${providerToken()}`,
              "apns-topic": process.env.APNS_BUNDLE_ID!,
              "apns-push-type": "alert",
              "apns-priority": "10",
              ...(payload.collapseId ? { "apns-collapse-id": payload.collapseId.slice(0, 64) } : {}),
            });

            let status = 0;
            let response = "";
            request.on("response", (headers) => {
              status = Number(headers[constants.HTTP2_HEADER_STATUS]) || 0;
            });
            request.setEncoding("utf8");
            request.on("data", (chunk) => (response += chunk));
            request.on("end", () => {
              // Apple reports a dead token here; stop sending to it.
              if (status === 410 || /BadDeviceToken|Unregistered/.test(response)) {
                removeDeviceToken(device.token);
              } else if (status >= 400) {
                console.error(`APNs ${status} for device: ${response}`);
              }
              resolve();
            });
            request.on("error", (err) => {
              console.error("APNs request failed", err);
              resolve();
            });
            request.end(body);
          }),
      ),
    );
  });
}
