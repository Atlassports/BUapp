import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { sendMessage } from "@/lib/queries";
import { screenTaskText } from "@/lib/safety";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));
  const body = String(b.body ?? "").trim();
  if (!body) return NextResponse.json({ error: "Empty message." }, { status: 400 });

  const screen = screenTaskText(body);
  if (!screen.allowed) {
    return NextResponse.json({ error: `${screen.label}: ${screen.explain}` }, { status: 422 });
  }

  if (!sendMessage(id, user.id, body)) {
    return NextResponse.json({ error: "Can't send that message." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
