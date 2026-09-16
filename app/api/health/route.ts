import { NextResponse } from "next/server";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Readiness probe: the server is only healthy if it can reach its database. */
export async function GET() {
  try {
    const row = get<{ count: number }>(`SELECT COUNT(*) AS count FROM users`);
    return NextResponse.json({ ok: true, users: row?.count ?? 0 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "database unreachable" },
      { status: 503 },
    );
  }
}
