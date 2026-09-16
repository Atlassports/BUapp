import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createOrg, ORG_CATEGORIES } from "@/lib/orgs";
import { screenTaskText } from "@/lib/safety";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  const blurb = String(b.blurb ?? "").trim();
  if (name.length < 3) return NextResponse.json({ error: "Give the org a name." }, { status: 400 });

  const screen = screenTaskText(name, blurb);
  if (!screen.allowed) return NextResponse.json({ error: `${screen.label}: ${screen.explain}` }, { status: 422 });

  const org = createOrg({
    name,
    blurb,
    emoji: String(b.emoji ?? "🎓").slice(0, 4),
    category: ORG_CATEGORIES.includes(b.category) ? b.category : ORG_CATEGORIES[0],
    createdBy: user.id,
  });
  return NextResponse.json({ slug: org.slug });
}
