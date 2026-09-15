import { NextResponse } from "next/server";
import { ALLOWED_DOMAIN, issueCode, normalizeEmail, recentCodeCount } from "@/lib/auth";
import { MailError, sendVerificationCode } from "@/lib/mail";

export async function POST(req: Request) {
  const { email } = await req.json().catch(() => ({ email: "" }));
  const normalized = normalizeEmail(String(email ?? ""));

  if (!normalized) {
    return NextResponse.json(
      { error: `Sidekick is BU-only right now. Use your @${ALLOWED_DOMAIN} address.` },
      { status: 400 },
    );
  }

  if (recentCodeCount(normalized) >= 5) {
    return NextResponse.json(
      { error: "Too many codes requested. Try again in a few minutes." },
      { status: 429 },
    );
  }

  const code = issueCode(normalized);

  try {
    await sendVerificationCode(normalized, code);
  } catch (err) {
    // Operators need the real cause; the student gets something actionable.
    if (err instanceof MailError) {
      console.error(`[mail:${err.kind}] ${err.message}${err.remedy ? `\n  → ${err.remedy}` : ""}`);
      if (err.kind === "rate_limited") {
        return NextResponse.json(
          { error: "We're sending a lot of codes right now. Try again in a moment." },
          { status: 429 },
        );
      }
      return NextResponse.json(
        { error: "We couldn't send that code. This is on us — try again shortly." },
        { status: 502 },
      );
    }
    console.error("verification email failed", err);
    return NextResponse.json({ error: "Couldn't send that code. Try again." }, { status: 502 });
  }

  return NextResponse.json({ ok: true, email: normalized });
}
