import { NextResponse } from "next/server";
import { checkCode, findUserByEmail, normalizeEmail, setPendingEmail, startSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, code } = await req.json().catch(() => ({}));
  const normalized = normalizeEmail(String(email ?? ""));
  if (!normalized) return NextResponse.json({ error: "Invalid email." }, { status: 400 });

  const result = checkCode(normalized, String(code ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.reason }, { status: 400 });

  const existing = findUserByEmail(normalized);
  if (existing) {
    await startSession(existing.id);
    return NextResponse.json({ status: "signed_in" });
  }

  await setPendingEmail(normalized);
  return NextResponse.json({ status: "needs_profile" });
}
