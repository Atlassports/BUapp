import Link from "next/link";
import { AvailabilityToggle, SignOutButton, ThemeToggle } from "@/components/MeControls";
import { TaskRow } from "@/components/TaskCard";
import { Avatar, EmptyState, SectionLabel, Stars, TrustMeter, VerifiedBadge } from "@/components/ui";
import { requireUser, toPublicUser } from "@/lib/auth";
import { tasksAssignedTo, tasksPostedBy } from "@/lib/queries";
import { TRANSPORT_BY_ID } from "@/lib/taxonomy";
import { money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function MePage() {
  const user = await requireUser();
  const me = toPublicUser(user);
  const posted = tasksPostedBy(user.id, user);
  const working = tasksAssignedTo(user.id, user);

  const earned = working
    .filter((t) => t.status === "completed")
    .reduce((sum, t) => sum + Math.round((t.agreed_cents ?? 0) * 0.9), 0);

  return (
    <>
      <header className="px-4 pb-1 pt-5">
        <div className="flex items-start gap-4">
          <Avatar user={me} size={64} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-bold tracking-tight">{me.name}</h1>
              {me.verified && <VerifiedBadge />}
            </div>
            <p className="faint mt-0.5 text-[13px]">
              @{me.handle}
              {me.class_year && ` · ${me.class_year}`}
            </p>
            <div className="mt-1.5 flex items-center gap-3">
              <Stars value={me.rating} />
              <span className="muted text-[12px]">{me.completed_count} completed</span>
            </div>
          </div>
        </div>

        <div className="rail mt-3.5">
          {me.transport.map((t) => {
            const mode = TRANSPORT_BY_ID.get(t);
            return mode ? (
              <span key={t} className="chip">
                {mode.emoji} {mode.label}
              </span>
            ) : null;
          })}
          <span className="chip">📍 {me.home_area}</span>
          <Link href={`/u/${me.handle}`} className="chip">
            View public profile
          </Link>
        </div>
      </header>

      <main className="px-3 pb-8">
        <div className="mt-4">
          <AvailabilityToggle availableUntil={me.available_until} />
        </div>

        <div className="mt-2.5 grid grid-cols-2 gap-2.5">
          <div className="card p-4">
            <p className="faint text-[11px] font-bold uppercase tracking-[0.06em]">Earned</p>
            <p className="price mt-1 text-[24px] text-scarlet-600 dark:text-scarlet-400">
              {money(earned)}
            </p>
            <p className="faint mt-0.5 text-[11px]">after fees, all time</p>
          </div>
          <div className="card p-4">
            <p className="faint text-[11px] font-bold uppercase tracking-[0.06em]">Trust</p>
            <p className="price mt-1 text-[24px]">{me.trust_score}</p>
            <div className="mt-1.5">
              <TrustMeter score={me.trust_score} />
            </div>
          </div>
        </div>

        <SectionLabel>Work you're doing</SectionLabel>
        {working.length === 0 ? (
          <div className="card">
            <EmptyState
              emoji="⚡"
              title="Nothing in progress"
              body="Check Available Now — it packs the best-paying tasks into whatever time you have free."
              action={
                <Link href="/now" className="btn btn-primary mt-1">
                  See what fits
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
            {working.map((t) => (
              <TaskRow key={t.id} task={t} trailing={t.status} />
            ))}
          </div>
        )}

        <SectionLabel>Tasks you posted</SectionLabel>
        {posted.length === 0 ? (
          <div className="card">
            <EmptyState
              emoji="📝"
              title="Nothing posted yet"
              body="Describe what you need in one line. Sidekick fills in the category, location and a fair price."
              action={
                <Link href="/post" className="btn btn-primary mt-1">
                  Post a task
                </Link>
              }
            />
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
            {posted.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                trailing={t.status === "open" ? `${t.offer_count} offers` : t.status}
              />
            ))}
          </div>
        )}

        <SectionLabel>Appearance</SectionLabel>
        <div className="px-1">
          <ThemeToggle />
        </div>

        <SectionLabel>Account</SectionLabel>
        <div className="card p-4">
          <p className="muted text-[13px] leading-relaxed">
            Verified as <span className="font-semibold text-[var(--ink)]">{user.email}</span>. Sidekick is
            BU-only while we build real liquidity on one campus — BC, Harvard, MIT and Northeastern
            come after, not before.
          </p>
        </div>

        <SignOutButton />
      </main>
    </>
  );
}
