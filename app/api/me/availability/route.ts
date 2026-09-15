import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { setAvailability } from "@/lib/queries";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const minutes = Number(b.minutes);
  setAvailability(user.id, minutes > 0 ? Date.now() + minutes * 60_000 : null);
  return NextResponse.json({ ok: true });
}
