import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAction } from "@/components/AdminActions";
import { Avatar, EmptyState, SectionLabel } from "@/components/ui";
import { currentUser } from "@/lib/auth";
import { adminStats, isAdmin, listDisputes, listReports, recentUsers } from "@/lib/admin";
import { money, timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await currentUser();
  // Someone who isn't an admin shouldn't learn this page exists.
  if (!isAdmin(user)) notFound();

  const sp = await searchParams;
  const tab = (Array.isArray(sp.tab) ? sp.tab[0] : sp.tab) ?? "reports";
  const stats = adminStats();
  const reports = listReports(tab === "resolved" ? "resolved" : "open");
  const users = recentUsers(40);
  const disputes = listDisputes();

  return (
    <>
      <header className="px-4 pb-3 pt-5">
        <h1 className="text-[26px] font-bold tracking-tight">Admin</h1>
        <p className="muted mt-1 text-[13px]">Signed in as {user!.email}</p>
      </header>

      <div className="grid grid-cols-3 gap-2 px-3">
        <Stat label="Students" value={String(stats.users)} sub={`+${stats.signups_7d} this week`} />
        <Stat label="Open tasks" value={String(stats.tasks_open)} sub={`+${stats.tasks_7d} this week`} />
        <Stat label="Completed" value={String(stats.tasks_completed)} sub={`${money(stats.gmv_cents)} GMV`} />
        <Stat label="Fees earned" value={money(stats.fees_cents)} sub="after the 5/10% split" />
        <Stat label="Clubs" value={String(stats.orgs)} sub={`${stats.offers} offers`} />
        <Stat
          label="Open reports"
          value={String(stats.reports_open)}
          sub={stats.suspended > 0 ? `${stats.suspended} suspended` : "none suspended"}
          alert={stats.reports_open > 0}
        />
        <Stat label="Held in escrow" value={money(stats.held_cents)} sub="funded, not yet released" />
        <Stat
          label="Disputes"
          value={String(stats.disputes_open)}
          sub={stats.disputes_open > 0 ? "money frozen" : "nothing frozen"}
          alert={stats.disputes_open > 0}
        />
      </div>

      <div className="rail px-4 pt-5">
        {[
          ["reports", "Open reports"],
          ["disputes", `Disputes${disputes.length ? ` (${disputes.length})` : ""}`],
          ["resolved", "Resolved"],
          ["users", "Students"],
        ].map(([id, label]) => (
          <Link key={id} href={`/admin?tab=${id}`} className={`chip ${tab === id ? "chip-active" : ""}`}>
            {label}
          </Link>
        ))}
      </div>

      {tab === "disputes" ? (
        <>
          <SectionLabel>{disputes.length} frozen {disputes.length === 1 ? "payment" : "payments"}</SectionLabel>
          {disputes.length === 0 ? (
            <EmptyState
              emoji="🧊"
              title="No frozen payments"
              body="When either side reports a problem, the money stops here until you decide where it goes."
            />
          ) : (
            <div className="mx-3 space-y-2.5">
              {disputes.map((d) => (
                <div key={d.payment.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[15px] font-semibold">{d.task?.title ?? "Task removed"}</p>
                      <p className="faint mt-0.5 text-[12px]">
                        {money(d.payment.amount_cents)} held · {d.poster?.name ?? "?"} → {d.tasker?.name ?? "?"}
                      </p>
                    </div>
                    <span className="price text-[17px] text-scarlet-600 dark:text-scarlet-400">
                      {money(d.payment.amount_cents)}
                    </span>
                  </div>

                  {d.reason && <p className="muted mt-2.5 text-[13px] leading-relaxed">“{d.reason}”</p>}

                  <p className="faint mt-3 text-[12px] leading-relaxed">
                    Releasing sends {money(d.payment.payout_cents)} to {d.tasker?.name ?? "the tasker"}.
                    Refunding returns {money(d.payment.amount_cents)} to {d.poster?.name ?? "the poster"}.
                    Both are final.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminAction action="release_payment" id={d.payment.task_id} label="Release to tasker" />
                    <AdminAction action="refund_payment" id={d.payment.task_id} label="Refund poster" danger promptFor="Reason" />
                    {d.task && (
                      <Link href={`/tasks/${d.task.id}`} prefetch={false} className="chip">
                        Open task
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : tab === "users" ? (
        <>
          <SectionLabel>Recent signups</SectionLabel>
          <div className="mx-3 overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar user={u} size={34} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold">
                    {u.name}
                    {u.suspended_at && <span className="ml-2 text-[12px] text-scarlet-600">suspended</span>}
                  </p>
                  <p className="faint truncate text-[12px]">
                    {u.email} · {u.completed_count} done · trust {u.trust_score}
                  </p>
                </div>
                <AdminAction
                  action={u.suspended_at ? "unsuspend_user" : "suspend_user"}
                  id={u.id}
                  label={u.suspended_at ? "Restore" : "Suspend"}
                  danger={!u.suspended_at}
                  promptFor={u.suspended_at ? undefined : "Reason"}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <SectionLabel>{reports.length} {tab === "resolved" ? "resolved" : "open"}</SectionLabel>
          {reports.length === 0 ? (
            <EmptyState
              emoji={tab === "resolved" ? "📁" : "✅"}
              title={tab === "resolved" ? "Nothing resolved yet" : "No open reports"}
              body={tab === "resolved" ? "Reports you've acted on will be listed here." : "Nothing needs your attention right now."}
            />
          ) : (
            <div className="mx-3 space-y-2.5">
              {reports.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold">{r.reason}</p>
                      <p className="faint mt-0.5 text-[12px]">
                        {r.reporter?.name ?? "Someone"} reported a {r.target_type} · {timeAgo(r.created_at)}
                      </p>
                    </div>
                    <span className="chip capitalize">{r.status}</span>
                  </div>

                  {r.detail && <p className="muted mt-2.5 text-[13px] leading-relaxed">“{r.detail}”</p>}

                  {r.target_task && (
                    <Link href={`/tasks/${r.target_task.id}`} prefetch={false} className="card mt-3 block p-3">
                      <p className="text-[13px] font-semibold">{r.target_task.title}</p>
                      <p className="faint mt-0.5 text-[12px] capitalize">{r.target_task.status}</p>
                    </Link>
                  )}
                  {r.target_user && (
                    <Link href={`/u/${r.target_user.handle}`} prefetch={false} className="card mt-3 flex items-center gap-2.5 p-3">
                      <Avatar user={r.target_user} size={30} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-semibold">{r.target_user.name}</span>
                        <span className="faint block text-[12px]">trust {r.target_user.trust_score}</span>
                      </span>
                    </Link>
                  )}

                  {r.status === "open" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminAction action="resolve_report" id={r.id} label="Resolve" promptFor="What did you do?" />
                      {r.target_task && (
                        <AdminAction action="remove_task" id={r.target_task.id} label="Remove task" danger />
                      )}
                      {r.target_user && (
                        <AdminAction action="suspend_user" id={r.target_user.id} label="Suspend user" danger promptFor="Reason" />
                      )}
                    </div>
                  )}
                  {r.resolution && <p className="faint mt-2.5 text-[12px]">Resolution: {r.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <div className="h-8" />
    </>
  );
}

function Stat({ label, value, sub, alert }: { label: string; value: string; sub: string; alert?: boolean }) {
  return (
    <div className="card p-3">
      <p className="faint text-[10px] font-bold uppercase tracking-[0.06em]">{label}</p>
      <p className={`price mt-1 text-[20px] ${alert ? "text-scarlet-600 dark:text-scarlet-400" : ""}`}>{value}</p>
      <p className="faint mt-0.5 text-[10px]">{sub}</p>
    </div>
  );
}
