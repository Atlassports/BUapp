import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { updateProfile } from "@/lib/queries";
import { PLACES } from "@/lib/geo";
import { TRANSPORT_BY_ID, type TransportId } from "@/lib/taxonomy";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Add your name." }, { status: 400 });

  const transport = (Array.isArray(b.transport) ? b.transport : []).filter(
    (t: string): t is TransportId => TRANSPORT_BY_ID.has(t as TransportId),
  );
  if (!transport.length) {
    return NextResponse.json({ error: "Pick at least one way you get around." }, { status: 400 });
  }

  const place = PLACES.find((p) => p.id === b.homePlace) ?? PLACES[0];
  const skills = (Array.isArray(b.skills) ? b.skills : [])
    .map((s: unknown) => String(s).trim())
    .filter(Boolean)
    .slice(0, 10);

  updateProfile(user.id, {
    name: name.slice(0, 60),
    bio: String(b.bio ?? "").slice(0, 240),
    class_year: String(b.classYear ?? "").slice(0, 20),
    home_area: place.area,
    home_lat: place.lat,
    home_lng: place.lng,
    transport: transport.join(","),
    skills: skills.join(","),
  });

  return NextResponse.json({ ok: true });
}
