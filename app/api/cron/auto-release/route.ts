import { NextResponse } from "next/server";
import { runAutoReleases } from "@/lib/payments";

/**
 * Releases held payments whose confirmation window has passed.
 *
 * Called on a schedule (Fly machines, a cron job, any pinger). Protected by a
 * shared secret rather than a session, since no person is behind it.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const result = await runAutoReleases();
  return NextResponse.json(result);
}
