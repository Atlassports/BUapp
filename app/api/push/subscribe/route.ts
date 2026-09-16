import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { saveSubscription } from "@/lib/push";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const sub = await req.json().catch(() => null);
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  }
  saveSubscription(user.id, sub);
  return NextResponse.json({ ok: true });
}
