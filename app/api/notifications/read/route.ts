import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { markNotificationsRead } from "@/lib/notify";

export async function POST() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  markNotificationsRead(user.id);
  return NextResponse.json({ ok: true });
}
