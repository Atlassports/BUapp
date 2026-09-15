import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { cancelTask } from "@/lib/queries";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  cancelTask(id, user.id);
  return NextResponse.json({ ok: true });
}
