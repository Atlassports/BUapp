import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

/**
 * SQLite via Node's built-in driver. Everything below is plain SQL against a
 * normalized schema, so the move to Postgres is a driver swap and a handful of
 * dialect edits — not a rewrite.
 */

const DB_PATH = process.env.SIDEKICK_DB ?? ".data/sidekick.db";

const SCHEMA = `

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  handle        TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  avatar_hue    INTEGER NOT NULL DEFAULT 0,
  bio           TEXT NOT NULL DEFAULT '',
  class_year    TEXT NOT NULL DEFAULT '',
  home_area     TEXT NOT NULL DEFAULT 'Central Campus',
  home_lat      REAL NOT NULL DEFAULT 42.3505,
  home_lng      REAL NOT NULL DEFAULT -71.1054,
  transport     TEXT NOT NULL DEFAULT 'walk',   -- csv of TransportId
  skills        TEXT NOT NULL DEFAULT '',       -- csv
  verified_at   INTEGER,
  available_until INTEGER,                      -- epoch ms; powers "Available Now"
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification_codes (
  email       TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  expires_at  INTEGER NOT NULL,
  consumed_at INTEGER,
  attempts    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_codes_email ON verification_codes(email);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id             TEXT PRIMARY KEY,
  poster_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT NOT NULL,
  body           TEXT NOT NULL DEFAULT '',
  category       TEXT NOT NULL,
  tags           TEXT NOT NULL DEFAULT '',      -- csv
  price_type     TEXT NOT NULL DEFAULT 'fixed', -- fixed | range | open
  price_min      INTEGER NOT NULL DEFAULT 0,    -- cents
  price_max      INTEGER NOT NULL DEFAULT 0,    -- cents
  place_id       TEXT NOT NULL DEFAULT 'remote',
  place_label    TEXT NOT NULL DEFAULT 'Remote',
  lat            REAL,
  lng            REAL,
  is_remote      INTEGER NOT NULL DEFAULT 0,
  transport_req  TEXT,                          -- TransportId or NULL
  est_minutes    INTEGER NOT NULL DEFAULT 30,
  due_at         INTEGER,                       -- epoch ms
  starts_at      INTEGER,
  status         TEXT NOT NULL DEFAULT 'open',  -- open | assigned | completed | cancelled
  assignee_id    TEXT REFERENCES users(id) ON DELETE SET NULL,
  agreed_cents   INTEGER,
  created_at     INTEGER NOT NULL,
  assigned_at    INTEGER,
  completed_at   INTEGER
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_poster ON tasks(poster_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee_id);

CREATE TABLE IF NOT EXISTS offers (
  id          TEXT PRIMARY KEY,
  task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  note        TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | declined | withdrawn
  created_at  INTEGER NOT NULL,
  UNIQUE(task_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_offers_task ON offers(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_offers_user ON offers(user_id);

-- One thread per offer. Messaging never exists without an offer behind it,
-- which is what keeps this from becoming an anonymous DM app.
CREATE TABLE IF NOT EXISTS messages (
  id         TEXT PRIMARY KEY,
  offer_id   TEXT NOT NULL REFERENCES offers(id) ON DELETE CASCADE,
  sender_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  read_at    INTEGER
);
CREATE INDEX IF NOT EXISTS idx_messages_offer ON messages(offer_id, created_at);

CREATE TABLE IF NOT EXISTS reviews (
  id             TEXT PRIMARY KEY,
  task_id        TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stars          INTEGER NOT NULL,
  body           TEXT NOT NULL DEFAULT '',
  would_again    INTEGER NOT NULL DEFAULT 1,
  author_role    TEXT NOT NULL,  -- poster | tasker
  created_at     INTEGER NOT NULL,
  UNIQUE(task_id, author_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_subject ON reviews(subject_id, created_at DESC);

CREATE TABLE IF NOT EXISTS reports (
  id          TEXT PRIMARY KEY,
  reporter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL,   -- user | task
  target_id   TEXT NOT NULL,
  reason      TEXT NOT NULL,
  detail      TEXT NOT NULL DEFAULT '',
  created_at  INTEGER NOT NULL
);

-- Student organizations. Kept deliberately separate from the peer-to-peer
-- feed: club work has a different rhythm and would drown out the $15 package
-- pickups that make the marketplace feel alive.
CREATE TABLE IF NOT EXISTS orgs (
  id          TEXT PRIMARY KEY,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  blurb       TEXT NOT NULL DEFAULT '',
  emoji       TEXT NOT NULL DEFAULT '🎓',
  avatar_hue  INTEGER NOT NULL DEFAULT 0,
  category    TEXT NOT NULL DEFAULT 'Student organization',
  verified_at INTEGER,
  created_by  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS org_members (
  org_id     TEXT NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'member',  -- owner | admin | member
  created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  link       TEXT NOT NULL DEFAULT '/feed',
  actor_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  read_at    INTEGER,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, created_at DESC);

-- Web Push subscriptions. On iOS these only exist once the app is installed to
-- the Home Screen, which is why the install prompt matters.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id);

-- Native device tokens for the App Store build. Web Push covers browsers and
-- installed PWAs; APNs covers the real iOS app. Same notification layer, two
-- transports, so a person gets exactly one alert wherever they actually are.
-- Payments ledger. Every money movement is a row, so the state of a task's
-- funds is never inferred from Stripe alone — a webhook that never arrives
-- leaves an obvious gap rather than a silently wrong balance.
CREATE TABLE IF NOT EXISTS payments (
  id                TEXT PRIMARY KEY,
  task_id           TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  payer_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payee_id          TEXT REFERENCES users(id) ON DELETE SET NULL,
  amount_cents      INTEGER NOT NULL,
  fee_cents         INTEGER NOT NULL,
  payout_cents      INTEGER NOT NULL,
  -- held: poster charged, money with the platform
  -- released: transferred to the tasker
  -- refunded: returned to the poster
  -- disputed: frozen pending review
  status            TEXT NOT NULL DEFAULT 'pending',
  intent_id         TEXT,
  transfer_id       TEXT,
  refund_id         TEXT,
  auto_release_at   INTEGER,
  created_at        INTEGER NOT NULL,
  held_at           INTEGER,
  released_at       INTEGER,
  refunded_at       INTEGER
);
CREATE INDEX IF NOT EXISTS idx_payments_task ON payments(task_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status, auto_release_at);

-- Stripe events we have already applied, so a redelivered webhook cannot
-- release the same money twice.
CREATE TABLE IF NOT EXISTS stripe_events (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS device_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  platform   TEXT NOT NULL DEFAULT 'ios',   -- ios | android
  environment TEXT NOT NULL DEFAULT 'production',
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_device_user ON device_tokens(user_id);

CREATE TABLE IF NOT EXISTS saved_tasks (
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id    TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, task_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  blocker_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (blocker_id, blocked_id)
);
`;

declare global {
  // Survives Next.js dev hot reloads, which would otherwise leak handles.
  var __sidekickDb: DatabaseSync | undefined;
}

function open(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const database = new DatabaseSync(DB_PATH);

  // Order matters. busy_timeout has to be set before anything that takes a
  // lock, or a contended statement fails instantly instead of waiting — which
  // is exactly what happens when a build's parallel workers, or a dev server
  // and a seed, open the same file at once.
  database.exec("PRAGMA busy_timeout = 10000;");

  // Switching journal modes needs an exclusive lock. If another connection
  // already has the file open, it's almost certainly already in WAL, so a
  // failure here is not worth aborting over.
  try {
    database.exec("PRAGMA journal_mode = WAL;");
  } catch {
    // Already WAL, or another connection holds the lock. Either way, continue.
  }

  database.exec("PRAGMA foreign_keys = ON;");
  database.exec(SCHEMA);
  migrate(database);
  return database;
}

export const db: DatabaseSync = globalThis.__sidekickDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__sidekickDb = db;

/* ------------------------------------------------------------------ */
/* Thin typed helpers over the driver                                  */
/* ------------------------------------------------------------------ */

type Param = string | number | bigint | null | Uint8Array;

/**
 * node:sqlite hands back rows with a null prototype. React refuses to serialize
 * those from a Server Component to a Client Component ("Only plain objects...
 * can be passed"), which broke the message thread the moment a row reached it.
 * Normalizing here means no future query can reintroduce it.
 */
function plain<T>(row: unknown): T {
  return { ...(row as object) } as T;
}

export function all<T>(sql: string, ...params: Param[]): T[] {
  return db.prepare(sql).all(...params).map((r) => plain<T>(r));
}

export function get<T>(sql: string, ...params: Param[]): T | undefined {
  const row = db.prepare(sql).get(...params);
  return row === undefined ? undefined : plain<T>(row);
}

export function run(sql: string, ...params: Param[]) {
  return db.prepare(sql).run(...params);
}

export function tx<T>(fn: () => T): T {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

/**
 * Column additions for databases created before a given feature existed.
 * SQLite has no "ADD COLUMN IF NOT EXISTS", so each one is attempted and a
 * duplicate-column error means it is already applied.
 */
function migrate(database: DatabaseSync) {
  const additions: Array<[string, string]> = [
    ["tasks", "org_id TEXT REFERENCES orgs(id) ON DELETE SET NULL"],
    ["users", "suspended_at INTEGER"],
    ["users", "suspended_reason TEXT NOT NULL DEFAULT ''"],
    ["users", "notify_offers INTEGER NOT NULL DEFAULT 1"],
    ["users", "notify_messages INTEGER NOT NULL DEFAULT 1"],
    ["users", "notify_nearby INTEGER NOT NULL DEFAULT 0"],
    ["users", "stripe_account_id TEXT"],
    ["users", "payouts_enabled INTEGER NOT NULL DEFAULT 0"],
    ["users", "stripe_customer_id TEXT"],
    ["reports", "status TEXT NOT NULL DEFAULT 'open'"],
    ["reports", "resolved_at INTEGER"],
    ["reports", "resolution TEXT NOT NULL DEFAULT ''"],
  ];
  for (const [table, definition] of additions) {
    try {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/duplicate column/i.test(message)) throw err;
    }
  }
}

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
