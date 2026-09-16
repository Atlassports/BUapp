import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import {
  isAdmin,
  removeTask,
  resolveReport,
  suspendUser,
  unsuspendUser,
} from "@/lib/admin";

/** One endpoint, because every action here is a single verb on one id. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!isAdmin(user)) {
    // Don't confirm the console exists to someone who isn't an admin.
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { action, id, note } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  switch (action) {
    case "resolve_report":
      resolveReport(String(id), String(note ?? "Reviewed"));
      break;
    case "suspend_user":
      suspendUser(String(id), String(note ?? "Violated the community rules"));
      break;
    case "unsuspend_user":
      unsuspendUser(String(id));
      break;
    case "remove_task":
      removeTask(String(id));
      break;
    default:
      return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
