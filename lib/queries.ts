import "server-only";
import { all, get, id, run, tx } from "./db";
import { publicUserById, toPublicUser } from "./auth";
import { haversineMiles } from "./geo";
import { reachOf, transportSatisfies, type TransportId } from "./taxonomy";
import type { Message, Offer, PublicUser, Review, Task, TaskCard, User } from "./types";

/* ------------------------------------------------------------------ */
/* Feed                                                                */
/* ------------------------------------------------------------------ */

export type FeedSort = "nearby" | "foryou" | "new" | "ending";

export type FeedFilters = {
  sort: FeedSort;
  categories: string[];
  maxDistance: number;      // miles; Infinity for anywhere
  transport: TransportId[]; // modes the viewer has available right now
  minPrice: number;         // cents
  withinHours: number | null;
  includeRemote: boolean;
  query: string;
};

export const DEFAULT_FILTERS: FeedFilters = {
  sort: "nearby",
  categories: [],
  maxDistance: Infinity,
  transport: [],
  minPrice: 0,
  withinHours: null,
  includeRemote: true,
  query: "",
};

function hydrate(task: Task, viewer: User | null): TaskCard {
  const poster = publicUserById(task.poster_id)!;
  const offers = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM offers WHERE task_id = ? AND status IN ('pending','accepted')`,
    task.id,
  );
  const origin = viewer
    ? { lat: viewer.home_lat, lng: viewer.home_lng }
    : { lat: 42.3505, lng: -71.1054 };
  const distance =
    task.is_remote || task.lat === null || task.lng === null
      ? null
      : haversineMiles(origin, { lat: task.lat, lng: task.lng });
  return {
    ...task,
    poster,
    offer_count: offers?.c ?? 0,
    distance_mi: distance,
    tag_list: task.tags ? task.tags.split(",").filter(Boolean) : [],
  };
}

export function listTasks(viewer: User | null, filters: FeedFilters): TaskCard[] {
  const where: string[] = [`t.status = 'open'`];
  const params: (string | number)[] = [];

  if (viewer) {
    where.push(`t.poster_id != ?`);
    params.push(viewer.id);
    // Blocks are bidirectional: neither party sees the other's posts.
    where.push(
      `t.poster_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?)`,
      `t.poster_id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?)`,
    );
    params.push(viewer.id, viewer.id);
  }

  if (filters.categories.length) {
    where.push(`t.category IN (${filters.categories.map(() => "?").join(",")})`);
    params.push(...filters.categories);
  }

  if (filters.minPrice > 0) {
    where.push(`(t.price_type = 'open' OR t.price_max >= ? OR t.price_min >= ?)`);
    params.push(filters.minPrice, filters.minPrice);
  }

  if (filters.withinHours !== null) {
    where.push(`(t.due_at IS NOT NULL AND t.due_at <= ? AND t.due_at > ?)`);
    params.push(Date.now() + filters.withinHours * 3600_000, Date.now());
  }

  if (!filters.includeRemote) where.push(`t.is_remote = 0`);

  if (filters.query.trim()) {
    where.push(`(t.title LIKE ? OR t.body LIKE ? OR t.tags LIKE ?)`);
    const q = `%${filters.query.trim()}%`;
    params.push(q, q, q);
  }

  const rows = all<Task>(
    `SELECT t.* FROM tasks t WHERE ${where.join(" AND ")} ORDER BY t.created_at DESC LIMIT 400`,
    ...params,
  );

  let cards = rows.map((t) => hydrate(t, viewer));

  // Transportation and distance are applied in code because "can this person
  // actually get there" is a judgment about the viewer, not a column.
  if (filters.transport.length) {
    cards = cards.filter(
      (c) => c.is_remote === 1 || transportSatisfies(filters.transport, c.transport_req),
    );
  }
  if (filters.maxDistance !== Infinity) {
    cards = cards.filter((c) => c.distance_mi === null || c.distance_mi <= filters.maxDistance);
  }

  return sortCards(cards, filters.sort, viewer);
}

function sortCards(cards: TaskCard[], sort: FeedSort, viewer: User | null): TaskCard[] {
  const out = [...cards];
  switch (sort) {
    case "nearby":
      out.sort((a, b) => (a.distance_mi ?? 99) - (b.distance_mi ?? 99));
      break;
    case "new":
      out.sort((a, b) => b.created_at - a.created_at);
      break;
    case "ending":
      out.sort((a, b) => (a.due_at ?? Infinity) - (b.due_at ?? Infinity));
      break;
    case "foryou":
      out.sort((a, b) => matchScore(b, viewer) - matchScore(a, viewer));
      break;
  }
  return out;
}

/**
 * "For You" ranking. Skills, reach and pay, weighted by how strongly each
 * actually predicts whether someone takes the job.
 */
export function matchScore(card: TaskCard, viewer: User | null): number {
  if (!viewer) return card.price_max || card.price_min;
  let score = 0;

  const skills = viewer.skills ? viewer.skills.toLowerCase().split(",").filter(Boolean) : [];
  const haystack = `${card.title} ${card.tags} ${card.body}`.toLowerCase();
  for (const skill of skills) if (skill && haystack.includes(skill.trim())) score += 40;

  const owned = (viewer.transport ? viewer.transport.split(",") : []) as TransportId[];
  if (card.transport_req && transportSatisfies(owned, card.transport_req)) score += 15;
  if (card.transport_req && !transportSatisfies(owned, card.transport_req)) score -= 60;

  if (card.distance_mi !== null) {
    const reach = reachOf(owned);
    if (card.distance_mi > reach) score -= 50;
    else score += Math.max(0, 25 - card.distance_mi * 10);
  } else {
    score += 10; // remote work is reachable by definition
  }

  score += Math.min(30, (card.price_max || card.price_min) / 500);
  if (card.due_at && card.due_at - Date.now() < 3600_000 * 3) score += 12;
  score -= card.offer_count * 3; // spread attention across posts

  return score;
}

/* ------------------------------------------------------------------ */
/* Available Now                                                       */
/* ------------------------------------------------------------------ */

export type NowPlan = {
  picks: TaskCard[];
  potentialCents: number;
  minutesUsed: number;
  minutesAvailable: number;
};

/**
 * Greedy schedule builder: the highest earning-rate tasks that actually fit in
 * the window, including the travel time to reach each one.
 */
export function buildNowPlan(viewer: User, minutesAvailable: number): NowPlan {
  const owned = (viewer.transport ? viewer.transport.split(",") : ["walk"]) as TransportId[];
  const candidates = listTasks(viewer, {
    ...DEFAULT_FILTERS,
    sort: "nearby",
    transport: owned,
    maxDistance: reachOf(owned),
  }).filter((c) => {
    if (c.due_at === null) return true;          // flexible: do it whenever
    if (c.due_at <= Date.now()) return false;    // already overdue
    // A deadline far past the window usually means a fixed future start time
    // ("Saturday 6:30 AM"), not work that's available right now.
    return c.due_at <= Date.now() + (minutesAvailable + 180) * 60_000;
  });

  const speed = Math.max(...owned.map((o) => ({ walk: 3, bike: 10, mbta: 12, car: 20, moto: 22, rideshare: 18 })[o] ?? 3), 3);

  const scored = candidates
    .map((c) => {
      const travelMin = c.distance_mi === null ? 0 : Math.round((c.distance_mi / speed) * 60) * 2;
      const totalMin = c.est_minutes + travelMin;
      const cents = c.price_type === "open" ? 0 : c.price_max || c.price_min;
      return { card: c, totalMin, cents, rate: totalMin ? cents / totalMin : 0 };
    })
    .filter((s) => s.cents > 0 && s.totalMin <= minutesAvailable)
    .sort((a, b) => b.rate - a.rate);

  const picks: TaskCard[] = [];
  let used = 0;
  let earned = 0;
  for (const s of scored) {
    if (used + s.totalMin > minutesAvailable) continue;
    // Don't schedule a task past its own deadline.
    if (s.card.due_at !== null && Date.now() + (used + s.totalMin) * 60_000 > s.card.due_at) continue;
    picks.push(s.card);
    used += s.totalMin;
    earned += s.cents;
    if (picks.length >= 6) break;
  }

  return { picks, potentialCents: earned, minutesUsed: used, minutesAvailable };
}

/* ------------------------------------------------------------------ */
/* Tasks                                                               */
/* ------------------------------------------------------------------ */

export function getTask(taskId: string, viewer: User | null): TaskCard | null {
  const t = get<Task>(`SELECT * FROM tasks WHERE id = ?`, taskId);
  return t ? hydrate(t, viewer) : null;
}

export function createTask(input: Omit<Task, "id" | "created_at" | "status" | "assignee_id" | "agreed_cents" | "assigned_at" | "completed_at">): string {
  const taskId = id("tsk");
  run(
    `INSERT INTO tasks
      (id, poster_id, title, body, category, tags, price_type, price_min, price_max,
       place_id, place_label, lat, lng, is_remote, transport_req, est_minutes,
       due_at, starts_at, status, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'open', ?)`,
    taskId,
    input.poster_id,
    input.title,
    input.body,
    input.category,
    input.tags,
    input.price_type,
    input.price_min,
    input.price_max,
    input.place_id,
    input.place_label,
    input.lat,
    input.lng,
    input.is_remote,
    input.transport_req,
    input.est_minutes,
    input.due_at,
    input.starts_at,
    Date.now(),
  );
  return taskId;
}

export function tasksPostedBy(userId: string, viewer: User | null): TaskCard[] {
  return all<Task>(`SELECT * FROM tasks WHERE poster_id = ? ORDER BY created_at DESC`, userId).map(
    (t) => hydrate(t, viewer),
  );
}

export function tasksAssignedTo(userId: string, viewer: User | null): TaskCard[] {
  return all<Task>(`SELECT * FROM tasks WHERE assignee_id = ? ORDER BY created_at DESC`, userId).map(
    (t) => hydrate(t, viewer),
  );
}

export function cancelTask(taskId: string, userId: string): void {
  run(`UPDATE tasks SET status = 'cancelled' WHERE id = ? AND poster_id = ? AND status = 'open'`, taskId, userId);
}

/* ------------------------------------------------------------------ */
/* Offers                                                              */
/* ------------------------------------------------------------------ */

export type OfferWithUser = Offer & { user: PublicUser; unread: number; last_message: string | null };

export function offersForTask(taskId: string, viewerId: string | null): OfferWithUser[] {
  const rows = all<Offer>(
    `SELECT * FROM offers WHERE task_id = ? AND status != 'withdrawn' ORDER BY
       CASE status WHEN 'accepted' THEN 0 ELSE 1 END, created_at DESC`,
    taskId,
  );
  return rows.map((o) => decorateOffer(o, viewerId));
}

function decorateOffer(o: Offer, viewerId: string | null): OfferWithUser {
  const last = get<{ body: string }>(
    `SELECT body FROM messages WHERE offer_id = ? ORDER BY created_at DESC LIMIT 1`,
    o.id,
  );
  const unread = viewerId
    ? (get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM messages WHERE offer_id = ? AND sender_id != ? AND read_at IS NULL`,
        o.id,
        viewerId,
      )?.c ?? 0)
    : 0;
  return { ...o, user: publicUserById(o.user_id)!, unread, last_message: last?.body ?? null };
}

export function myOffer(taskId: string, userId: string): Offer | undefined {
  return get<Offer>(`SELECT * FROM offers WHERE task_id = ? AND user_id = ?`, taskId, userId);
}

export function createOffer(taskId: string, userId: string, priceCents: number, note: string): string {
  const offerId = id("ofr");
  run(
    `INSERT INTO offers (id, task_id, user_id, note, price_cents, created_at) VALUES (?,?,?,?,?,?)`,
    offerId,
    taskId,
    userId,
    note.slice(0, 500),
    priceCents,
    Date.now(),
  );
  // The offer note opens the thread — that's the whole messaging gate.
  if (note.trim()) {
    run(
      `INSERT INTO messages (id, offer_id, sender_id, body, created_at) VALUES (?,?,?,?,?)`,
      id("msg"),
      offerId,
      userId,
      note.trim().slice(0, 2000),
      Date.now(),
    );
  }
  return offerId;
}

/** Accepting an offer assigns the task and declines the rest, atomically. */
export function acceptOffer(offerId: string, posterId: string): { ok: boolean; error?: string } {
  return tx(() => {
    const offer = get<Offer>(`SELECT * FROM offers WHERE id = ?`, offerId);
    if (!offer) return { ok: false, error: "Offer not found." };
    const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, offer.task_id);
    if (!task || task.poster_id !== posterId) return { ok: false, error: "Not your task." };
    if (task.status !== "open") return { ok: false, error: "This task is no longer open." };

    run(`UPDATE offers SET status = 'accepted' WHERE id = ?`, offerId);
    run(`UPDATE offers SET status = 'declined' WHERE task_id = ? AND id != ? AND status = 'pending'`, offer.task_id, offerId);
    run(
      `UPDATE tasks SET status = 'assigned', assignee_id = ?, agreed_cents = ?, assigned_at = ? WHERE id = ?`,
      offer.user_id,
      offer.price_cents,
      Date.now(),
      offer.task_id,
    );
    return { ok: true };
  });
}

export function withdrawOffer(offerId: string, userId: string): void {
  run(`UPDATE offers SET status = 'withdrawn' WHERE id = ? AND user_id = ? AND status = 'pending'`, offerId, userId);
}

/** Completion is confirmed by the poster — that's the release trigger for escrow. */
export function completeTask(taskId: string, posterId: string): { ok: boolean; error?: string } {
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, taskId);
  if (!task || task.poster_id !== posterId) return { ok: false, error: "Not your task." };
  if (task.status !== "assigned") return { ok: false, error: "This task isn't in progress." };
  run(`UPDATE tasks SET status = 'completed', completed_at = ? WHERE id = ?`, Date.now(), taskId);
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Threads                                                             */
/* ------------------------------------------------------------------ */

export type Thread = {
  offer: Offer;
  task: Task;
  counterpart: PublicUser;
  last: Message | null;
  unread: number;
  role: "poster" | "tasker";
};

export function threadsFor(userId: string): Thread[] {
  const rows = all<Offer>(
    `SELECT o.* FROM offers o
     JOIN tasks t ON t.id = o.task_id
     WHERE (o.user_id = ? OR t.poster_id = ?) AND o.status != 'withdrawn'
     ORDER BY o.created_at DESC`,
    userId,
    userId,
  );

  const threads = rows.map((offer): Thread => {
    const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, offer.task_id)!;
    const role: "poster" | "tasker" = task.poster_id === userId ? "poster" : "tasker";
    const counterpartId = role === "poster" ? offer.user_id : task.poster_id;
    const last = get<Message>(
      `SELECT * FROM messages WHERE offer_id = ? ORDER BY created_at DESC LIMIT 1`,
      offer.id,
    );
    const unread =
      get<{ c: number }>(
        `SELECT COUNT(*) AS c FROM messages WHERE offer_id = ? AND sender_id != ? AND read_at IS NULL`,
        offer.id,
        userId,
      )?.c ?? 0;
    return { offer, task, counterpart: publicUserById(counterpartId)!, last: last ?? null, unread, role };
  });

  return threads.sort((a, b) => (b.last?.created_at ?? b.offer.created_at) - (a.last?.created_at ?? a.offer.created_at));
}

export function unreadCount(userId: string): number {
  return (
    get<{ c: number }>(
      `SELECT COUNT(*) AS c FROM messages m
       JOIN offers o ON o.id = m.offer_id
       JOIN tasks t ON t.id = o.task_id
       WHERE m.sender_id != ? AND m.read_at IS NULL AND (o.user_id = ? OR t.poster_id = ?)`,
      userId,
      userId,
      userId,
    )?.c ?? 0
  );
}

export function threadDetail(offerId: string, userId: string) {
  const offer = get<Offer>(`SELECT * FROM offers WHERE id = ?`, offerId);
  if (!offer) return null;
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, offer.task_id);
  if (!task) return null;
  if (offer.user_id !== userId && task.poster_id !== userId) return null;

  run(`UPDATE messages SET read_at = ? WHERE offer_id = ? AND sender_id != ? AND read_at IS NULL`, Date.now(), offerId, userId);

  const messages = all<Message>(`SELECT * FROM messages WHERE offer_id = ? ORDER BY created_at`, offerId);
  const role: "poster" | "tasker" = task.poster_id === userId ? "poster" : "tasker";
  const counterpartId = role === "poster" ? offer.user_id : task.poster_id;
  return { offer, task, messages, role, counterpart: publicUserById(counterpartId)! };
}

export function sendMessage(offerId: string, senderId: string, body: string): boolean {
  const offer = get<Offer>(`SELECT * FROM offers WHERE id = ?`, offerId);
  if (!offer) return false;
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, offer.task_id);
  if (!task) return false;
  if (offer.user_id !== senderId && task.poster_id !== senderId) return false;
  const blocked = get(
    `SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)`,
    offer.user_id,
    task.poster_id,
    task.poster_id,
    offer.user_id,
  );
  if (blocked) return false;

  run(
    `INSERT INTO messages (id, offer_id, sender_id, body, created_at) VALUES (?,?,?,?,?)`,
    id("msg"),
    offerId,
    senderId,
    body.trim().slice(0, 2000),
    Date.now(),
  );
  return true;
}

/* ------------------------------------------------------------------ */
/* Reviews, reports, blocks                                            */
/* ------------------------------------------------------------------ */

export type ReviewWithAuthor = Review & { author: PublicUser; task_title: string };

export function reviewsFor(userId: string): ReviewWithAuthor[] {
  const rows = all<Review>(`SELECT * FROM reviews WHERE subject_id = ? ORDER BY created_at DESC LIMIT 50`, userId);
  return rows.map((r) => ({
    ...r,
    author: publicUserById(r.author_id)!,
    task_title: get<{ title: string }>(`SELECT title FROM tasks WHERE id = ?`, r.task_id)?.title ?? "",
  }));
}

export function pendingReview(taskId: string, authorId: string): boolean {
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, taskId);
  if (!task || task.status !== "completed") return false;
  if (task.poster_id !== authorId && task.assignee_id !== authorId) return false;
  return !get(`SELECT 1 FROM reviews WHERE task_id = ? AND author_id = ?`, taskId, authorId);
}

export function leaveReview(input: {
  taskId: string;
  authorId: string;
  stars: number;
  body: string;
  wouldAgain: boolean;
}): { ok: boolean; error?: string } {
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, input.taskId);
  if (!task || task.status !== "completed") return { ok: false, error: "Task isn't completed yet." };
  const isPoster = task.poster_id === input.authorId;
  const isTasker = task.assignee_id === input.authorId;
  if (!isPoster && !isTasker) return { ok: false, error: "You weren't part of this task." };
  const subjectId = isPoster ? task.assignee_id! : task.poster_id;
  if (get(`SELECT 1 FROM reviews WHERE task_id = ? AND author_id = ?`, input.taskId, input.authorId)) {
    return { ok: false, error: "You already reviewed this task." };
  }
  run(
    `INSERT INTO reviews (id, task_id, author_id, subject_id, stars, body, would_again, author_role, created_at)
     VALUES (?,?,?,?,?,?,?,?,?)`,
    id("rev"),
    input.taskId,
    input.authorId,
    subjectId,
    Math.max(1, Math.min(5, input.stars)),
    input.body.slice(0, 500),
    input.wouldAgain ? 1 : 0,
    isPoster ? "poster" : "tasker",
    Date.now(),
  );
  return { ok: true };
}

export function reportTarget(input: {
  reporterId: string;
  targetType: "user" | "task";
  targetId: string;
  reason: string;
  detail: string;
}): void {
  run(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, detail, created_at)
     VALUES (?,?,?,?,?,?,?)`,
    id("rpt"),
    input.reporterId,
    input.targetType,
    input.targetId,
    input.reason,
    input.detail.slice(0, 1000),
    Date.now(),
  );
}

export function blockUser(blockerId: string, blockedId: string): void {
  run(`INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?,?,?)`, blockerId, blockedId, Date.now());
}

export function userByHandle(handle: string): User | undefined {
  return get<User>(`SELECT * FROM users WHERE handle = ?`, handle);
}

export function publicProfile(handle: string): { user: PublicUser; reviews: ReviewWithAuthor[] } | null {
  const u = userByHandle(handle);
  if (!u) return null;
  return { user: toPublicUser(u), reviews: reviewsFor(u.id) };
}

export function setAvailability(userId: string, untilMs: number | null): void {
  run(`UPDATE users SET available_until = ? WHERE id = ?`, untilMs, userId);
}

export function updateProfile(userId: string, patch: {
  name: string;
  bio: string;
  class_year: string;
  home_area: string;
  home_lat: number;
  home_lng: number;
  transport: string;
  skills: string;
}): void {
  run(
    `UPDATE users SET name=?, bio=?, class_year=?, home_area=?, home_lat=?, home_lng=?, transport=?, skills=? WHERE id=?`,
    patch.name,
    patch.bio,
    patch.class_year,
    patch.home_area,
    patch.home_lat,
    patch.home_lng,
    patch.transport,
    patch.skills,
    userId,
  );
}
