import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { editTask } from "@/lib/queries";
import { CATEGORY_BY_ID } from "@/lib/taxonomy";
import { screenTaskText } from "@/lib/safety";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  const b = await req.json().catch(() => ({}));

  const title = String(b.title ?? "").trim();
  const body = String(b.body ?? "").trim();
  if (title.length < 6) return NextResponse.json({ error: "Give the task a clearer title." }, { status: 400 });

  const screen = screenTaskText(title, body);
  if (!screen.allowed) return NextResponse.json({ error: `${screen.label}: ${screen.explain}` }, { status: 422 });

  const priceType = ["fixed", "range", "open"].includes(b.priceType) ? b.priceType : "fixed";
  const priceMin = Math.max(0, Math.round(Number(b.priceMin) || 0));
  const priceMax = Math.max(priceMin, Math.round(Number(b.priceMax) || priceMin));
  if (priceType !== "open" && priceMin < 100) {
    return NextResponse.json({ error: "Set a price of at least $1." }, { status: 400 });
  }

  const result = editTask(id, user.id, {
    title,
    body,
    category: CATEGORY_BY_ID.has(b.category) ? b.category : "other",
    tags: (Array.isArray(b.tags) ? b.tags : []).map(String).slice(0, 6).join(","),
    priceType,
    priceMin,
    priceMax,
    estMinutes: Math.min(480, Math.max(5, Math.round(Number(b.estMinutes) || 30))),
    dueAt: b.deadlineHours === null ? null : Date.now() + Number(b.deadlineHours) * 3600_000,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ ok: true });
}
