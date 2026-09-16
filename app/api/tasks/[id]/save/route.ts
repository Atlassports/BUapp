import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { isSaved, saveTask, unsaveTask } from "@/lib/saved";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const saved = isSaved(user.id, id);
  if (saved) unsaveTask(user.id, id);
  else saveTask(user.id, id);
  return NextResponse.json({ saved: !saved });
}
