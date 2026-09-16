import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { deletePhoto, readPhoto } from "@/lib/photos";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  // Photos are behind the login wall, same as everything else here.
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { id } = await ctx.params;
  const found = readPhoto(id);
  if (!found) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return new NextResponse(new Uint8Array(found.bytes), {
    headers: {
      "Content-Type": found.photo.mime,
      "Content-Length": String(found.photo.bytes),
      // Immutable: a photo id always refers to the same bytes.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const { id } = await ctx.params;
  if (!deletePhoto(id, user.id)) {
    return NextResponse.json({ error: "Can't delete that." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
