import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { run } from "@/lib/db";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  run(
    `UPDATE users SET notify_offers = ?, notify_messages = ?, notify_nearby = ? WHERE id = ?`,
    b.offers === false ? 0 : 1,
    b.messages === false ? 0 : 1,
    b.nearby === true ? 1 : 0,
    user.id,
  );
  return NextResponse.json({ ok: true });
}
