import { NextResponse } from "next/server";
import { run } from "@/lib/db";
import { claimEvent, markHeld, verifyWebhook } from "@/lib/payments";
import { notify } from "@/lib/notify";
import { get } from "@/lib/db";
import type { Task } from "@/lib/types";

/**
 * Stripe is the source of truth for whether money actually moved, so the
 * ledger is advanced here rather than optimistically in the request that
 * started the charge.
 */
export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature." }, { status: 400 });

  const body = await req.text();
  let event;
  try {
    event = verifyWebhook(body, signature);
  } catch (err) {
    console.error("stripe signature rejected", err);
    return NextResponse.json({ error: "Bad signature." }, { status: 400 });
  }

  // Stripe retries, so applying an event twice must be impossible.
  if (!claimEvent(event)) return NextResponse.json({ received: true, duplicate: true });

  switch (event.type) {
    case "payment_intent.succeeded": {
      const intent = event.data.object;
      markHeld(intent.id);
      const taskId = intent.metadata?.sidekick_task;
      if (taskId) {
        const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, taskId);
        if (task?.assignee_id) {
          void notify({
            userId: task.assignee_id,
            kind: "offer_accepted",
            title: "This task is funded",
            body: `${task.title} — the money is held until you finish.`,
            link: `/tasks/${task.id}`,
          });
        }
      }
      break;
    }

    case "account.updated": {
      const account = event.data.object;
      const userId = account.metadata?.sidekick_user;
      if (userId) {
        run(
          `UPDATE users SET payouts_enabled = ? WHERE id = ?`,
          account.payouts_enabled && account.charges_enabled ? 1 : 0,
          userId,
        );
      }
      break;
    }

    case "charge.dispute.created": {
      // The cardholder went to their bank. Freeze before anything is released.
      const dispute = event.data.object;
      run(
        `UPDATE payments SET status = 'disputed', auto_release_at = NULL
         WHERE intent_id = ? AND status = 'held'`,
        String(dispute.payment_intent ?? ""),
      );
      break;
    }
  }

  return NextResponse.json({ received: true });
}
