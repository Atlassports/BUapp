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

export function id(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
