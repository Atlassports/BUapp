import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { removeSubscription } from "@/lib/push";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { endpoint } = await req.json().catch(() => ({}));
  if (endpoint) removeSubscription(String(endpoint));
  return NextResponse.json({ ok: true });
}
