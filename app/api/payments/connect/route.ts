import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { ensureConnectAccount, onboardingLink, paymentsConfigured, refreshPayoutStatus } from "@/lib/payments";

/** Starts or resumes Stripe Express onboarding, so a tasker can be paid. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!paymentsConfigured()) {
    return NextResponse.json({ error: "Payments aren't switched on yet." }, { status: 503 });
  }

  const { refresh } = await req.json().catch(() => ({}));
  const existing = (user as { stripe_account_id?: string | null }).stripe_account_id ?? null;

  try {
    const accountId = await ensureConnectAccount({ id: user.id, email: user.email, stripe_account_id: existing });
    if (refresh) {
      const enabled = await refreshPayoutStatus(user.id, accountId);
      return NextResponse.json({ payoutsEnabled: enabled });
    }
    const base = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
    return NextResponse.json({ url: await onboardingLink(accountId, base) });
  } catch (err) {
    console.error("connect onboarding failed", err);
    return NextResponse.json({ error: "Couldn't reach Stripe. Try again." }, { status: 502 });
  }
}
