import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { MarkAllRead } from "@/components/MarkAllRead";
import { requireUser } from "@/lib/auth";
import { notificationsFor, unreadNotificationCount } from "@/lib/notify";
import { publicUserById } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

const ICONS: Record<string, string> = {
  offer_received: "✋",
  offer_accepted: "✅",
  offer_declined: "—",
  message: "💬",
  task_completed: "💸",
  review_received: "⭐",
  task_cancelled: "🚫",
  org_invite: "🎓",
};

export default async function ActivityPage() {
  const user = await requireUser();
  const items = notificationsFor(user.id);
  const unread = unreadNotificationCount(user.id);

  return (
    <>
      <header className="flex items-center justify-between px-4 pb-3 pt-5">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Activity</h1>
          <p className="muted mt-1 text-[13px]">
            {unread > 0 ? `${unread} new` : "Everything that's happened on your tasks"}
          </p>
        </div>
        {unread > 0 && <MarkAllRead />}
      </header>

      {items.length === 0 ? (
        <EmptyState
          emoji="🔔"
          title="Nothing yet"
          body="Offers, accepted work, messages and reviews all land here. Turn on notifications in Settings so you don't have to keep checking."
          action={
            <Link href="/settings" className="btn btn-ghost mt-1">
              Notification settings
            </Link>
          }
        />
      ) : (
        <div className="mx-3 overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
          {items.map((n) => {
            const actor = n.actor_id ? publicUserById(n.actor_id) : null;
            return (
              <Link
                key={n.id}
                href={n.link}
                prefetch={false}
                className="flex items-start gap-3 px-4 py-3.5"
                style={{
                  background: n.read_at ? undefined : "color-mix(in srgb, var(--color-scarlet-600) 5%, transparent)",
                }}
              >
                {actor ? (
                  <Avatar user={actor} size={38} />
                ) : (
                  <span className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-lg" style={{ background: "var(--surface-2)" }}>
                    {ICONS[n.kind] ?? "🔔"}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate text-[14px] font-semibold">{n.title}</span>
                    {!n.read_at && <span className="h-2 w-2 shrink-0 rounded-full bg-scarlet-600" aria-label="unread" />}
                  </span>
                  {n.body && <span className="muted mt-0.5 block truncate text-[13px]">{n.body}</span>}
                  <span className="faint mt-0.5 block text-[11px]">
                    {ICONS[n.kind] ?? "•"} {timeAgo(n.created_at)}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
