import { NextResponse } from "next/server";
import { clearPendingEmail, createUser, findUserByEmail, readPendingEmail, startSession } from "@/lib/auth";
import { PLACES } from "@/lib/geo";
import { TRANSPORT_BY_ID, type TransportId } from "@/lib/taxonomy";

export async function POST(req: Request) {
  const email = await readPendingEmail();
  if (!email) {
    return NextResponse.json({ error: "Verify your BU email again." }, { status: 401 });
  }
  if (findUserByEmail(email)) {
    return NextResponse.json({ error: "That account already exists." }, { status: 409 });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name ?? "").trim();
  if (name.length < 2) return NextResponse.json({ error: "Add your name." }, { status: 400 });

  const transport = (Array.isArray(body.transport) ? body.transport : [])
    .filter((t: string): t is TransportId => TRANSPORT_BY_ID.has(t as TransportId));
  if (!transport.length) {
    return NextResponse.json({ error: "Pick at least one way you get around." }, { status: 400 });
  }

  const place = PLACES.find((p) => p.id === body.homePlace) ?? PLACES[0];
  const skills = (Array.isArray(body.skills) ? body.skills : [])
    .map((s: unknown) => String(s).trim())
    .filter(Boolean)
    .slice(0, 8);

  const user = createUser({
    email,
    name,
    classYear: String(body.classYear ?? "").slice(0, 20),
    homeArea: place.area,
    homeLat: place.lat,
    homeLng: place.lng,
    transport,
    skills,
    bio: String(body.bio ?? ""),
  });

  await clearPendingEmail();
  await startSession(user.id);
  return NextResponse.json({ status: "signed_in", handle: user.handle });
}
