import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { leaveReview } from "@/lib/queries";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));

  const result = leaveReview({
    taskId: id,
    authorId: user.id,
    stars: Number(b.stars) || 0,
    body: String(b.body ?? ""),
    wouldAgain: b.wouldAgain !== false,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
