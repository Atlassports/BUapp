import { Suspense } from "react";
import Link from "next/link";
import { NowWindow } from "@/components/NowWindow";
import { TaskRow } from "@/components/TaskCard";
import { EmptyState, SectionLabel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { buildNowPlan } from "@/lib/queries";
import { money, duration } from "@/lib/format";
import { TRANSPORT_BY_ID, type TransportId } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function NowPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const raw = Array.isArray(sp.mins) ? sp.mins[0] : sp.mins;
  const minutes = [60, 120, 180, 360].includes(Number(raw)) ? Number(raw) : 120;

  const plan = buildNowPlan(user, minutes);
  const owned = (user.transport ? user.transport.split(",") : []) as TransportId[];

  return (
    <>
      <header className="px-4 pb-3 pt-5">
        <h1 className="text-[26px] font-bold tracking-tight">Available now</h1>
        <p className="muted mt-1 text-[14px] leading-relaxed">
          Tell Sidekick how long you're free. It builds the highest-paying run you can actually
          finish in that window.
        </p>
      </header>

      <Suspense fallback={<div className="h-8" />}>
        <NowWindow current={minutes} />
      </Suspense>

      <section className="mx-3 mt-4 overflow-hidden rounded-2xl border hairline" style={{ background: "var(--surface)" }}>
        <div className="border-b px-4 py-4 hairline">
          <p className="faint text-[11px] font-bold uppercase tracking-[0.08em]">Potential earnings</p>
          <p className="price mt-1 text-[38px] leading-none text-scarlet-600 dark:text-scarlet-400">
            {money(plan.potentialCents)}
          </p>
          <p className="muted mt-2 text-[13px]">
            {plan.picks.length} {plan.picks.length === 1 ? "task" : "tasks"} ·{" "}
            {duration(plan.minutesUsed)} of your {duration(plan.minutesAvailable)}
            {plan.minutesUsed > 0 && (
              <> · about {money(Math.round((plan.potentialCents / plan.minutesUsed) * 60))}/hr</>
            )}
          </p>
          <div className="rail mt-2.5">
            {owned.map((t) => {
              const mode = TRANSPORT_BY_ID.get(t);
              return mode ? (
                <span key={t} className="chip">
                  {mode.emoji} {mode.label}
                </span>
              ) : null;
            })}
          </div>
        </div>

        {plan.picks.length === 0 ? (
          <EmptyState
            emoji="🌙"
            title="Nothing fits that window"
            body="Either there's no open work you can reach right now, or everything takes longer than the time you have. Try a longer window."
            action={
              <Link href="/feed" className="btn btn-ghost mt-1">
                Browse everything
              </Link>
            }
          />
        ) : (
          <div className="divide-hair">
            {plan.picks.map((task, i) => (
              <TaskRow key={task.id} task={task} trailing={i === 0 ? "start here" : undefined} />
            ))}
          </div>
        )}
      </section>

      {plan.picks.length > 0 && (
        <>
          <SectionLabel>How this is built</SectionLabel>
          <p className="muted px-4 pb-8 text-[13px] leading-relaxed">
            Sidekick sorts open tasks by dollars per minute — including round-trip travel time at
            your fastest transportation mode — then packs the best ones into your window without
            missing anyone's deadline. Nothing here is a commitment until you send an offer.
          </p>
        </>
      )}
    </>
  );
}
