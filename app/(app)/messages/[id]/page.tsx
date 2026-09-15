import Link from "next/link";
import { notFound } from "next/navigation";
import { Thread } from "@/components/Thread";
import { Avatar, Banner, VerifiedBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { threadDetail } from "@/lib/queries";
import { money, priceLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const detail = threadDetail(id, user.id);
  if (!detail) notFound();

  const { offer, task, messages, counterpart, role } = detail;

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl hairline"
        style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}
      >
        <div className="flex items-center gap-3 px-3 py-2.5">
          <Link href="/messages" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m14 6-6 6 6 6" />
            </svg>
          </Link>
          <Link href={`/u/${counterpart.handle}`} className="flex min-w-0 items-center gap-2.5" prefetch={false}>
            <Avatar user={counterpart} size={34} />
            <span className="min-w-0">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-[14px] font-semibold">{counterpart.name}</span>
                {counterpart.verified && <VerifiedBadge compact />}
              </span>
              <span className="faint block text-[11px]">
                {counterpart.completed_count} tasks · trust {counterpart.trust_score}
              </span>
            </span>
          </Link>
        </div>

        <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 border-t px-4 py-2.5 hairline" prefetch={false}>
          <span className="price text-[15px] text-scarlet-600 dark:text-scarlet-400">
            {offer.status === "accepted" ? money(offer.price_cents) : priceLabel(task)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{task.title}</span>
          <span className="chip capitalize">{task.status}</span>
        </Link>
      </header>

      <div className="flex-1">
        {offer.status === "pending" && role === "poster" && (
          <div className="px-4 pt-4">
            <Banner>
              {counterpart.name} offered {money(offer.price_cents)}. Accept on the task page to lock
              it in and fund the escrow.
            </Banner>
          </div>
        )}
        {offer.status === "declined" && (
          <div className="px-4 pt-4">
            <Banner>This task went to someone else. The thread stays open if you want to follow up.</Banner>
          </div>
        )}
        <Thread offerId={offer.id} messages={messages} meId={user.id} />
      </div>
    </div>
  );
}
