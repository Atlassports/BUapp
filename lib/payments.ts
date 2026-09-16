import Stripe from "stripe";
import { all, get, id, run, tx } from "./db";
import { feeBreakdown } from "./pricing";
import type { Task } from "./types";

/**
 * Money.
 *
 * Two things are worth stating plainly, because they shape everything here.
 *
 * First, the platform never holds student money itself. Holding funds on
 * behalf of others is money transmission, which needs state-by-state licensing
 * — Stripe is the licensed party, and Sidekick is a platform on top of it.
 *
 * Second, "in-app payments" means the card sheet appears inside the app rather
 * than in a browser. That is what Stripe's native SDK and Payment Element do.
 * It does not mean processing cards ourselves; card data never touches this
 * server, which is the difference between a light PCI questionnaire and a
 * yearly audit.
 *
 * The flow, and why it protects both sides:
 *
 *   accept    poster is charged; money sits with the platform, not the tasker
 *   complete  poster confirms; the payout transfers to the tasker
 *   auto      if the poster goes quiet, it releases on its own after 72h
 *   dispute   either side can freeze it for review before that happens
 *
 * A tasker can't be stiffed after doing the work, and a poster can't be
 * charged for work that never happened.
 */

export const AUTO_RELEASE_HOURS = 72;

export function paymentsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let client: Stripe | null = null;
function stripe(): Stripe {
  if (!paymentsConfigured()) throw new PaymentError("Payments are not configured yet.");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-08-26.dahlia" });
  return client;
}

export class PaymentError extends Error {}

export type Payment = {
  id: string;
  task_id: string;
  payer_id: string;
  payee_id: string | null;
  amount_cents: number;
  fee_cents: number;
  payout_cents: number;
  status: "pending" | "held" | "released" | "refunded" | "disputed";
  intent_id: string | null;
  transfer_id: string | null;
  refund_id: string | null;
  auto_release_at: number | null;
  created_at: number;
  held_at: number | null;
  released_at: number | null;
  refunded_at: number | null;
};

export function paymentForTask(taskId: string): Payment | undefined {
  return get<Payment>(`SELECT * FROM payments WHERE task_id = ? ORDER BY created_at DESC LIMIT 1`, taskId);
}

/* ------------------------------------------------------------------ */
/* Tasker onboarding                                                   */
/* ------------------------------------------------------------------ */

/**
 * Taskers need a Stripe Express account before they can be paid. Stripe
 * collects the identity and bank details and carries the KYC obligation; we
 * only ever store the resulting account id.
 */
export async function ensureConnectAccount(user: { id: string; email: string; stripe_account_id?: string | null }) {
  if (user.stripe_account_id) return user.stripe_account_id;

  const account = await stripe().accounts.create({
    type: "express",
    email: user.email,
    country: "US",
    capabilities: { transfers: { requested: true } },
    business_type: "individual",
    business_profile: { product_description: "Campus tasks completed for other students" },
    metadata: { sidekick_user: user.id },
  });

  run(`UPDATE users SET stripe_account_id = ? WHERE id = ?`, account.id, user.id);
  return account.id;
}

export async function onboardingLink(accountId: string, returnTo: string) {
  const link = await stripe().accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${returnTo}/settings?payouts=retry`,
    return_url: `${returnTo}/settings?payouts=done`,
  });
  return link.url;
}

export async function refreshPayoutStatus(userId: string, accountId: string): Promise<boolean> {
  const account = await stripe().accounts.retrieve(accountId);
  const enabled = Boolean(account.payouts_enabled && account.charges_enabled);
  run(`UPDATE users SET payouts_enabled = ? WHERE id = ?`, enabled ? 1 : 0, userId);
  return enabled;
}

/* ------------------------------------------------------------------ */
/* Charging the poster                                                 */
/* ------------------------------------------------------------------ */

/**
 * Creates the charge that funds a task. Returns a client secret the app hands
 * to Stripe's native sheet, so the card is entered in the app and never
 * reaches this server.
 */
export async function createEscrowIntent(input: {
  task: Task;
  posterId: string;
  posterEmail: string;
  assigneeId: string;
  amountCents: number;
  customerId?: string | null;
}): Promise<{ clientSecret: string; paymentId: string }> {
  const existing = paymentForTask(input.task.id);
  if (existing && existing.status !== "pending") {
    throw new PaymentError("This task is already funded.");
  }

  const { fee, payout } = feeBreakdown(input.amountCents);

  // A customer record lets a returning poster reuse a saved card.
  let customerId = input.customerId ?? null;
  if (!customerId) {
    const customer = await stripe().customers.create({
      email: input.posterEmail,
      metadata: { sidekick_user: input.posterId },
    });
    customerId = customer.id;
    run(`UPDATE users SET stripe_customer_id = ? WHERE id = ?`, customerId, input.posterId);
  }

  const intent = await stripe().paymentIntents.create({
    amount: input.amountCents,
    currency: "usd",
    customer: customerId,
    // Funds land in the platform balance and are transferred on completion,
    // rather than authorized and captured later: a card authorization expires
    // in about a week, which is too short for a task booked for next weekend.
    capture_method: "automatic",
    automatic_payment_methods: { enabled: true },
    description: input.task.title.slice(0, 200),
    metadata: {
      sidekick_task: input.task.id,
      sidekick_poster: input.posterId,
      sidekick_assignee: input.assigneeId,
    },
  });

  const paymentId = existing?.id ?? id("pay");
  if (existing) {
    run(`UPDATE payments SET intent_id = ?, amount_cents = ?, fee_cents = ?, payout_cents = ? WHERE id = ?`,
      intent.id, input.amountCents, fee, payout, paymentId);
  } else {
    run(
      `INSERT INTO payments (id, task_id, payer_id, payee_id, amount_cents, fee_cents, payout_cents,
         status, intent_id, created_at)
       VALUES (?,?,?,?,?,?,?, 'pending', ?, ?)`,
      paymentId, input.task.id, input.posterId, input.assigneeId,
      input.amountCents, fee, payout, intent.id, Date.now(),
    );
  }

  if (!intent.client_secret) throw new PaymentError("Stripe did not return a client secret.");
  return { clientSecret: intent.client_secret, paymentId };
}

/** Called from the webhook once Stripe confirms the charge succeeded. */
export function markHeld(intentId: string): void {
  const now = Date.now();
  run(
    `UPDATE payments SET status = 'held', held_at = ?, auto_release_at = ?
     WHERE intent_id = ? AND status = 'pending'`,
    now,
    now + AUTO_RELEASE_HOURS * 3600_000,
    intentId,
  );
}

/* ------------------------------------------------------------------ */
/* Paying the tasker                                                   */
/* ------------------------------------------------------------------ */

export async function releasePayment(taskId: string, reason: "confirmed" | "auto"): Promise<{ ok: boolean; error?: string }> {
  const payment = paymentForTask(taskId);
  if (!payment) return { ok: false, error: "No payment on this task." };
  if (payment.status === "released") return { ok: true };
  if (payment.status !== "held") return { ok: false, error: `Can't release a ${payment.status} payment.` };
  if (!payment.payee_id) return { ok: false, error: "No one is assigned to pay." };

  const payee = get<{ stripe_account_id: string | null; payouts_enabled: number }>(
    `SELECT stripe_account_id, payouts_enabled FROM users WHERE id = ?`,
    payment.payee_id,
  );
  if (!payee?.stripe_account_id || !payee.payouts_enabled) {
    // Money stays held rather than vanishing; they finish onboarding and it goes.
    return { ok: false, error: "They haven't finished setting up payouts yet. The money stays held until they do." };
  }

  const transfer = await stripe().transfers.create(
    {
      amount: payment.payout_cents,
      currency: "usd",
      destination: payee.stripe_account_id,
      transfer_group: taskId,
      metadata: { sidekick_task: taskId, sidekick_reason: reason },
    },
    // Stripe drops a repeat with the same key, so a double-tap or a retried
    // webhook cannot pay twice.
    { idempotencyKey: `release_${payment.id}` },
  );

  run(
    `UPDATE payments SET status = 'released', transfer_id = ?, released_at = ? WHERE id = ?`,
    transfer.id,
    Date.now(),
    payment.id,
  );
  return { ok: true };
}

export async function refundPayment(taskId: string, reason: string): Promise<{ ok: boolean; error?: string }> {
  const payment = paymentForTask(taskId);
  if (!payment?.intent_id) return { ok: false, error: "No payment to refund." };
  if (payment.status === "refunded") return { ok: true };
  if (payment.status === "released") return { ok: false, error: "That payout already went out." };

  const refund = await stripe().refunds.create(
    { payment_intent: payment.intent_id, metadata: { sidekick_reason: reason.slice(0, 200) } },
    { idempotencyKey: `refund_${payment.id}` },
  );

  run(
    `UPDATE payments SET status = 'refunded', refund_id = ?, refunded_at = ? WHERE id = ?`,
    refund.id,
    Date.now(),
    payment.id,
  );
  return { ok: true };
}

/** Freezes the auto-release so a human can look before money moves. */
export function disputePayment(taskId: string): void {
  run(`UPDATE payments SET status = 'disputed', auto_release_at = NULL WHERE task_id = ? AND status = 'held'`, taskId);
}

/**
 * Releases held payments whose confirmation window has passed.
 *
 * Without this, a poster who simply stops responding keeps a tasker's money
 * indefinitely — the most common way a marketplace like this quietly cheats
 * the people doing the work.
 */
export async function runAutoReleases(): Promise<{ released: number; failed: number }> {
  if (!paymentsConfigured()) return { released: 0, failed: 0 };
  const due = all<Payment>(
    `SELECT * FROM payments WHERE status = 'held' AND auto_release_at IS NOT NULL AND auto_release_at < ?`,
    Date.now(),
  );

  let released = 0;
  let failed = 0;
  for (const payment of due) {
    try {
      const result = await releasePayment(payment.task_id, "auto");
      if (result.ok) released++;
      else failed++;
    } catch (err) {
      failed++;
      console.error("auto-release failed", payment.id, err);
    }
  }
  return { released, failed };
}

/* ------------------------------------------------------------------ */
/* Webhooks                                                            */
/* ------------------------------------------------------------------ */

export function verifyWebhook(body: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new PaymentError("STRIPE_WEBHOOK_SECRET is not set.");
  return stripe().webhooks.constructEvent(body, signature, secret);
}

/** True the first time an event id is seen; false if it's a redelivery. */
export function claimEvent(event: Stripe.Event): boolean {
  return tx(() => {
    if (get(`SELECT 1 FROM stripe_events WHERE id = ?`, event.id)) return false;
    run(`INSERT INTO stripe_events (id, type, created_at) VALUES (?,?,?)`, event.id, event.type, Date.now());
    return true;
  });
}
