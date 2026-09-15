import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { createOffer, getTask, myOffer } from "@/lib/queries";
import { screenTaskText } from "@/lib/safety";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const task = getTask(id, user);
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (task.poster_id === user.id) {
    return NextResponse.json({ error: "You can't apply to your own task." }, { status: 400 });
  }
  if (task.status !== "open") {
    return NextResponse.json({ error: "This task is no longer open." }, { status: 409 });
  }
  if (myOffer(id, user.id)) {
    return NextResponse.json({ error: "You already sent an offer." }, { status: 409 });
  }

  const b = await req.json().catch(() => ({}));
  const note = String(b.note ?? "").trim();

  const screen = screenTaskText(note);
  if (!screen.allowed) {
    return NextResponse.json({ error: `${screen.label}: ${screen.explain}` }, { status: 422 });
  }

  const asked = Math.round(Number(b.priceCents) || 0);
  const price = asked >= 100 ? asked : task.price_max || task.price_min;
  if (price < 100) {
    return NextResponse.json({ error: "Name a price of at least $1." }, { status: 400 });
  }

  const offerId = createOffer(id, user.id, price, note);
  return NextResponse.json({ id: offerId });
}
