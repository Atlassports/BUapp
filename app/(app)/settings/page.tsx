import Link from "next/link";
import { SettingsPanel } from "@/components/SettingsPanel";
import { requireUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { vapidPublicKey } from "@/lib/push";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireUser();
  const prefs = get<{ notify_offers: number; notify_messages: number; notify_nearby: number }>(
    `SELECT notify_offers, notify_messages, notify_nearby FROM users WHERE id = ?`,
    user.id,
  );

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href="/me" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-[19px] font-bold tracking-tight">Settings</h1>
      </header>
      <SettingsPanel
        email={user.email}
        initial={{
          offers: (prefs?.notify_offers ?? 1) === 1,
          messages: (prefs?.notify_messages ?? 1) === 1,
          nearby: (prefs?.notify_nearby ?? 0) === 1,
        }}
        vapidKey={vapidPublicKey()}
        nativePushReady={false}
      />
    </>
  );
}
