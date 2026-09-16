import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { orgBySlug, roleInOrg, setMemberRole } from "@/lib/orgs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const org = orgBySlug((await ctx.params).slug);
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });
  if (roleInOrg(org.id, user.id) !== "owner") {
    return NextResponse.json({ error: "Only an owner can change roles." }, { status: 403 });
  }
  const { userId, role } = await req.json().catch(() => ({}));
  if (!["owner", "admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Unknown role." }, { status: 400 });
  }
  setMemberRole(org.id, String(userId), role);
  return NextResponse.json({ ok: true });
}
