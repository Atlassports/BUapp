import Link from "next/link";
import { Avatar, EmptyState, VerifiedBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { threadsFor } from "@/lib/queries";
import { money, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const user = await requireUser();
  const threads = threadsFor(user.id);

  return (
    <>
      <header className="px-4 pb-3 pt-5">
        <h1 className="text-[26px] font-bold tracking-tight">Messages</h1>
        <p className="muted mt-1 text-[13px] leading-relaxed">
          Threads open when someone sends an offer. There are no cold DMs on Sidekick.
        </p>
      </header>

      {threads.length === 0 ? (
        <EmptyState
          emoji="💬"
          title="No threads yet"
          body="Apply to a task or accept an offer on one of yours, and the conversation starts here."
          action={
            <Link href="/feed" className="btn btn-primary mt-1">
              Find work
            </Link>
          }
        />
      ) : (
        <div className="mx-3 overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
          {threads.map((t) => (
            <Link key={t.offer.id} href={`/messages/${t.offer.id}`} className="flex items-center gap-3 px-4 py-3.5" prefetch={false}>
              <Avatar user={t.counterpart} size={42} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[14px] font-semibold">{t.counterpart.name}</span>
                  {t.counterpart.verified && <VerifiedBadge compact />}
                  <span className="faint ml-auto shrink-0 text-[11px]">
                    {timeAgo(t.last?.created_at ?? t.offer.created_at)}
                  </span>
                </div>
                <p className="muted truncate text-[13px]">
                  {t.last?.body ?? `Offered ${money(t.offer.price_cents)}`}
                </p>
                <p className="faint mt-0.5 truncate text-[11px]">
                  {t.role === "poster" ? "Your task" : "You applied"} · {t.task.title}
                </p>
              </div>
              {t.unread > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-scarlet-600 px-1.5 text-[11px] font-bold text-white">
                  {t.unread}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
