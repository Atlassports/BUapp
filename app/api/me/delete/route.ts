import { NextResponse } from "next/server";
import { currentUser, endSession } from "@/lib/auth";
import { get, run, tx } from "@/lib/db";

/**
 * Account deletion. Publishing means people can leave, and leaving has to
 * actually remove them — not flag a row and keep the data.
 *
 * Completed tasks keep their reviews, because the counterparty's reputation is
 * partly built on them; the account behind them is anonymized instead.
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { confirm } = await req.json().catch(() => ({}));
  if (confirm !== user.email) {
    return NextResponse.json(
      { error: "Type your BU email exactly to confirm deletion." },
      { status: 400 },
    );
  }

  const active = get<{ c: number }>(
    `SELECT COUNT(*) AS c FROM tasks
     WHERE (poster_id = ? OR assignee_id = ?) AND status = 'assigned'`,
    user.id,
    user.id,
  );
  if ((active?.c ?? 0) > 0) {
    return NextResponse.json(
      { error: "Finish or cancel your in-progress tasks first, so nobody is left hanging." },
      { status: 409 },
    );
  }

  tx(() => {
    run(`UPDATE tasks SET status = 'cancelled' WHERE poster_id = ? AND status = 'open'`, user.id);
    run(`UPDATE offers SET status = 'withdrawn' WHERE user_id = ? AND status = 'pending'`, user.id);
    run(`DELETE FROM push_subscriptions WHERE user_id = ?`, user.id);
    run(`DELETE FROM device_tokens WHERE user_id = ?`, user.id);
    run(`DELETE FROM notifications WHERE user_id = ?`, user.id);
    run(`DELETE FROM saved_tasks WHERE user_id = ?`, user.id);
    run(`DELETE FROM org_members WHERE user_id = ?`, user.id);
    run(`DELETE FROM sessions WHERE user_id = ?`, user.id);

    // Keep reviews this person wrote — they belong to the subject's record —
    // but detach the identity behind them.
    run(
      `UPDATE users SET email = ?, handle = ?, name = 'Former student', bio = '',
         skills = '', class_year = '', suspended_at = ?, suspended_reason = 'deleted'
       WHERE id = ?`,
      `deleted+${user.id}@invalid`,
      `deleted_${user.id.slice(-8)}`,
      Date.now(),
      user.id,
    );
  });

  await endSession();
  return NextResponse.json({ ok: true });
}
