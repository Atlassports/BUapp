import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ApplyForm,
  CompleteButton,
  OfferList,
  ReportButton,
  ReviewForm,
} from "@/components/TaskActions";
import { Banner, SectionLabel, TrustMeter, UserLine } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getTask, myOffer, offersForTask, pendingReview } from "@/lib/queries";
import { categoryOf, TRANSPORT_BY_ID } from "@/lib/taxonomy";
import { formatDistance, SAFE_MEETING_SPOTS } from "@/lib/geo";
import { dueLabel, duration, money, priceLabel, timeAgo } from "@/lib/format";
import { ACADEMIC_NOTICE } from "@/lib/safety";

export const dynamic = "force-dynamic";

export default async function TaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = getTask(id, user);
  if (!task) notFound();

  const isPoster = task.poster_id === user.id;
  const isAssignee = task.assignee_id === user.id;
  const mine = myOffer(task.id, user.id);
  const offers = isPoster ? offersForTask(task.id, user.id) : [];
  const cat = categoryOf(task.category);
  const transport = task.transport_req ? TRANSPORT_BY_ID.get(task.transport_req) : null;
  const canReview = pendingReview(task.id, user.id);

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b px-3 py-3 backdrop-blur-xl hairline"
        style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}>
        <Link href="/feed" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <span className="chip">{cat.emoji} {cat.label}</span>
        {task.status !== "open" && (
          <span className="chip capitalize">{task.status}</span>
        )}
      </header>

      <main className="px-4 pb-10">
        <div className="pt-4">
          <p className="price text-[34px] leading-none text-scarlet-600 dark:text-scarlet-400">
            {priceLabel(task)}
            {task.price_type === "open" && <span className="muted text-[16px] font-medium"> — name your price</span>}
          </p>
          <h1 className="mt-2.5 text-[21px] font-bold leading-snug tracking-tight">{task.title}</h1>

          <div className="muted mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
            <Meta icon={task.is_remote ? "💻" : "📍"} label={task.is_remote ? "Remote" : task.place_label}
              sub={task.is_remote ? "Anywhere" : formatDistance(task.distance_mi)} />
            <Meta icon="⏰" label={dueLabel(task.due_at)} sub={`Posted ${timeAgo(task.created_at)}`} />
            <Meta icon="⌛" label={duration(task.est_minutes)} sub="Estimated" />
            {transport && <Meta icon={transport.emoji} label={transport.label} sub="Required" />}
          </div>
        </div>

        {task.tag_list.length > 0 && (
          <div className="rail mt-4">
            {task.tag_list.map((t) => (
              <span key={t} className="chip">{t}</span>
            ))}
          </div>
        )}

        {task.body && (
          <p className="mt-5 whitespace-pre-wrap text-[15px] leading-relaxed">{task.body}</p>
        )}

        {task.category === "academic" && (
          <div className="mt-5">
            <Banner tone="warn">{ACADEMIC_NOTICE}</Banner>
          </div>
        )}

        <SectionLabel>Posted by</SectionLabel>
        <div className="card p-4">
          <UserLine user={task.poster} size={44} />
          {task.poster.bio && <p className="muted mt-2.5 text-[13px] leading-relaxed">{task.poster.bio}</p>}
          <div className="mt-3">
            <p className="faint mb-1 text-[11px] font-bold uppercase tracking-[0.06em]">Campus trust score</p>
            <TrustMeter score={task.poster.trust_score} />
          </div>
        </div>

        {!task.is_remote && (
          <>
            <SectionLabel>Safe handoff spots</SectionLabel>
            <div className="card p-4">
              <p className="muted text-[13px] leading-relaxed">
                For any in-person exchange, meet somewhere staffed and busy. Never invite someone
                into your room for a handoff.
              </p>
              <div className="rail mt-2.5">
                {SAFE_MEETING_SPOTS.slice(0, 5).map((s) => (
                  <span key={s} className="chip">{s}</span>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ---------------- state machine ---------------- */}

        {task.status === "open" && !isPoster && !mine && (
          <>
            <SectionLabel>Apply</SectionLabel>
            <ApplyForm
              taskId={task.id}
              suggestedCents={task.price_max || task.price_min}
              priceType={task.price_type}
            />
          </>
        )}

        {task.status === "open" && !isPoster && mine && (
          <>
            <SectionLabel>Your offer</SectionLabel>
            <div className="card p-4">
              <p className="price text-[18px] text-scarlet-600 dark:text-scarlet-400">
                {money(mine.price_cents)}
              </p>
              {mine.note && <p className="mt-1.5 text-[14px] leading-relaxed">“{mine.note}”</p>}
              <p className="faint mt-2 text-[12px]">Sent {timeAgo(mine.created_at)} · waiting on the poster</p>
              <Link href={`/messages/${mine.id}`} className="btn btn-ghost mt-3 w-full py-2.5 text-[14px]">
                Open messages
              </Link>
            </div>
          </>
        )}

        {isPoster && (
          <>
            <SectionLabel>
              {offers.length} {offers.length === 1 ? "offer" : "offers"}
            </SectionLabel>
            {offers.length === 0 ? (
              <p className="muted px-1 text-[14px] leading-relaxed">
                No offers yet. Most tasks get their first offer within about 20 minutes — the tighter
                the deadline, the faster it moves.
              </p>
            ) : (
              <OfferList offers={offers} isPoster taskOpen={task.status === "open"} />
            )}
          </>
        )}

        {task.status === "assigned" && (isPoster || isAssignee) && (
          <>
            <SectionLabel>In progress</SectionLabel>
            <div className="card space-y-3 p-4">
              <div className="flex items-center gap-2 text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                🔒 {money(task.agreed_cents ?? 0)} held in escrow
              </div>
              <p className="muted text-[13px] leading-relaxed">
                {isPoster
                  ? "The money is set aside. It moves when you confirm the work is done — never before, and never in cash."
                  : "The poster has funded this task. Finish the work, then they confirm and your payout is released."}
              </p>
              <Banner>
                Payments are simulated in this build. Stripe Connect handles the real escrow, payouts
                and disputes — wired in behind the same interface.
              </Banner>
              {isPoster && task.agreed_cents && (
                <CompleteButton taskId={task.id} amountCents={task.agreed_cents} />
              )}
            </div>
          </>
        )}

        {task.status === "completed" && (
          <>
            <SectionLabel>Completed</SectionLabel>
            <div className="card p-4">
              <p className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Paid {money(task.agreed_cents ?? 0)} · {timeAgo(task.completed_at ?? task.created_at)}
              </p>
            </div>
            {canReview && (
              <>
                <SectionLabel>Leave a review</SectionLabel>
                <div className="card p-4">
                  <ReviewForm taskId={task.id} subjectName={isPoster ? "your sidekick" : task.poster.name} />
                </div>
              </>
            )}
          </>
        )}

        {!isPoster && (
          <div className="mt-6">
            <ReportButton targetType="task" targetId={task.id} canBlock />
          </div>
        )}
      </main>
    </>
  );
}

function Meta({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-[15px] leading-none">{icon}</span>
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-semibold text-[var(--ink)]">{label}</span>
        <span className="faint block text-[11px]">{sub}</span>
      </span>
    </div>
  );
}
