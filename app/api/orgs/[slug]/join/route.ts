import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { joinOrg, orgBySlug } from "@/lib/orgs";

export async function POST(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const org = orgBySlug((await ctx.params).slug);
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });
  joinOrg(org.id, user.id);
  return NextResponse.json({ ok: true });
}
