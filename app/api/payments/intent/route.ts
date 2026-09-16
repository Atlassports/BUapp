import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { createEscrowIntent, PaymentError, paymentsConfigured } from "@/lib/payments";
import type { Task } from "@/lib/types";

/** Funds a task the poster has just accepted someone for. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!paymentsConfigured()) {
    return NextResponse.json({ error: "Payments aren't switched on yet." }, { status: 503 });
  }

  const { taskId } = await req.json().catch(() => ({}));
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, String(taskId ?? ""));
  if (!task || task.poster_id !== user.id) {
    return NextResponse.json({ error: "Not your task." }, { status: 403 });
  }
  if (task.status !== "assigned" || !task.assignee_id || !task.agreed_cents) {
    return NextResponse.json({ error: "Accept someone's offer first." }, { status: 400 });
  }

  try {
    const result = await createEscrowIntent({
      task,
      posterId: user.id,
      posterEmail: user.email,
      assigneeId: task.assignee_id,
      amountCents: task.agreed_cents,
      customerId: (user as { stripe_customer_id?: string | null }).stripe_customer_id ?? null,
    });
    return NextResponse.json({ clientSecret: result.clientSecret });
  } catch (err) {
    if (err instanceof PaymentError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("payment intent failed", err);
    return NextResponse.json({ error: "Couldn't start that payment." }, { status: 502 });
  }
}
