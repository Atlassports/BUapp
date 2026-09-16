import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { canPostForOrg, ORG_CATEGORIES, orgBySlug, updateOrg } from "@/lib/orgs";

export async function POST(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { slug } = await ctx.params;
  const org = orgBySlug(slug);
  if (!org) return NextResponse.json({ error: "Org not found." }, { status: 404 });
  if (!canPostForOrg(org.id, user.id)) {
    return NextResponse.json({ error: "Only owners and admins can edit this org." }, { status: 403 });
  }
  const b = await req.json().catch(() => ({}));
  updateOrg(org.id, {
    name: String(b.name ?? org.name),
    blurb: String(b.blurb ?? org.blurb),
    emoji: String(b.emoji ?? org.emoji),
    category: ORG_CATEGORIES.includes(b.category) ? b.category : org.category,
  });
  return NextResponse.json({ ok: true });
}
