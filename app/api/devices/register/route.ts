import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { registerDeviceToken, removeDeviceToken } from "@/lib/apns";

/** Called by the native iOS shell once APNs hands it a device token. */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const { token, platform, remove } = await req.json().catch(() => ({}));
  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Missing device token." }, { status: 400 });
  }
  if (remove) removeDeviceToken(token);
  else registerDeviceToken(user.id, token, platform === "android" ? "android" : "ios");
  return NextResponse.json({ ok: true });
}
