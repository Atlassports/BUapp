import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { get, id, run } from "@/lib/db";
import { disputePayment } from "@/lib/payments";
import type { Task } from "@/lib/types";

/** Freezes a held payment and files a report for review. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { taskId, reason } = await req.json().catch(() => ({}));
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, String(taskId ?? ""));
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (task.poster_id !== user.id && task.assignee_id !== user.id) {
    return NextResponse.json({ error: "You weren't part of this task." }, { status: 403 });
  }

  disputePayment(task.id);
  run(
    `INSERT INTO reports (id, reporter_id, target_type, target_id, reason, detail, created_at)
     VALUES (?,?,'task',?,?,?,?)`,
    id("rpt"),
    user.id,
    task.id,
    "Payment dispute",
    String(reason ?? "").slice(0, 1000),
    Date.now(),
  );
  return NextResponse.json({ ok: true });
}
