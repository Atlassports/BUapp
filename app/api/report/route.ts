import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { blockUser, reportTarget } from "@/lib/queries";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const targetType = b.targetType === "task" ? "task" : "user";
  const targetId = String(b.targetId ?? "");
  if (!targetId) return NextResponse.json({ error: "Nothing to report." }, { status: 400 });

  reportTarget({
    reporterId: user.id,
    targetType,
    targetId,
    reason: String(b.reason ?? "Unspecified"),
    detail: String(b.detail ?? ""),
  });

  if (b.block && targetType === "user") blockUser(user.id, targetId);

  return NextResponse.json({ ok: true });
}
