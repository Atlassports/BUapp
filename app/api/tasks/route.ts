import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { PLACE_BY_ID } from "@/lib/geo";
import { CATEGORY_BY_ID, TRANSPORT_BY_ID, type CategoryId, type TransportId } from "@/lib/taxonomy";
import { createTask } from "@/lib/queries";
import { screenTaskText } from "@/lib/safety";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const b = await req.json().catch(() => ({}));

  const title = String(b.title ?? "").trim();
  const body = String(b.body ?? "").trim();
  if (title.length < 6) return NextResponse.json({ error: "Give the task a clearer title." }, { status: 400 });

  const screen = screenTaskText(title, body);
  if (!screen.allowed) {
    return NextResponse.json({ error: `${screen.label}: ${screen.explain}` }, { status: 422 });
  }

  const category = (CATEGORY_BY_ID.has(b.category) ? b.category : "other") as CategoryId;
  const place = PLACE_BY_ID.get(String(b.placeId ?? "remote"));
  if (!place) return NextResponse.json({ error: "Pick a location." }, { status: 400 });
  const isRemote = place.id === "remote";

  const transportRequired = TRANSPORT_BY_ID.has(b.transportRequired)
    ? (b.transportRequired as TransportId)
    : null;

  const priceType = ["fixed", "range", "open"].includes(b.priceType) ? b.priceType : "fixed";
  const priceMin = Math.max(0, Math.round(Number(b.priceMin) || 0));
  const priceMax = Math.max(priceMin, Math.round(Number(b.priceMax) || priceMin));
  if (priceType !== "open" && priceMin < 100) {
    return NextResponse.json({ error: "Set a price of at least $1." }, { status: 400 });
  }
  if (priceMin > 500_00 || priceMax > 500_00) {
    return NextResponse.json(
      { error: "Tasks over $500 need a business account. Email us to get set up." },
      { status: 400 },
    );
  }

  const estMinutes = Math.min(480, Math.max(5, Math.round(Number(b.estMinutes) || 30)));
  const deadlineHours = b.deadlineHours === null ? null : Number(b.deadlineHours);
  const dueAt =
    deadlineHours === null || Number.isNaN(deadlineHours)
      ? null
      : Date.now() + deadlineHours * 3600_000;

  const tags = (Array.isArray(b.tags) ? b.tags : [])
    .map((t: unknown) => String(t).trim())
    .filter(Boolean)
    .slice(0, 6);

  const id = createTask({
    poster_id: user.id,
    title: title.slice(0, 100),
    body: body.slice(0, 1200),
    category,
    tags: tags.join(","),
    price_type: priceType,
    price_min: priceMin,
    price_max: priceMax,
    place_id: place.id,
    place_label: place.name,
    lat: isRemote ? null : place.lat,
    lng: isRemote ? null : place.lng,
    is_remote: isRemote ? 1 : 0,
    transport_req: isRemote ? null : transportRequired,
    est_minutes: estMinutes,
    due_at: dueAt,
    starts_at: null,
  });

  return NextResponse.json({ id });
}
