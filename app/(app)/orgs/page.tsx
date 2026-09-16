import Link from "next/link";
import { CreateOrgButton } from "@/components/OrgControls";
import { EmptyState, SectionLabel } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listOrgs, orgsForUser } from "@/lib/orgs";

export const dynamic = "force-dynamic";

export default async function OrgsPage() {
  const user = await requireUser();
  const mine = orgsForUser(user.id);
  const mineIds = new Set(mine.map((o) => o.id));
  const all = listOrgs().filter((o) => !mineIds.has(o.id));

  return (
    <>
      <header className="px-4 pb-3 pt-5">
        <h1 className="text-[26px] font-bold tracking-tight">Clubs</h1>
        <p className="muted mt-1 text-[14px] leading-relaxed">
          Student organizations post their own work — photographers, designers, event help. Kept
          separate so club jobs don't bury the quick errands in your feed.
        </p>
      </header>

      {mine.length > 0 && (
        <>
          <SectionLabel>Your clubs</SectionLabel>
          <div className="mx-3 space-y-2.5">
            {mine.map((org) => (
              <Link key={org.id} href={`/orgs/${org.slug}`} prefetch={false} className="card flex items-center gap-3 p-3.5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: "var(--surface-2)" }}>
                  {org.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">{org.name}</span>
                  <span className="faint block text-[12px] capitalize">{org.role} · {org.category}</span>
                </span>
                <span className="faint text-lg">›</span>
              </Link>
            ))}
          </div>
        </>
      )}

      <SectionLabel>{mine.length ? "Other clubs" : "All clubs"}</SectionLabel>
      {all.length === 0 ? (
        <EmptyState
          emoji="🎓"
          title={mine.length ? "That's all of them" : "No clubs yet"}
          body="Any verified BU student can register one. If you run a club, this is where you'd post for a photographer or someone to help at the door."
        />
      ) : (
        <div className="mx-3 space-y-2.5">
          {all.map((org) => (
            <Link key={org.id} href={`/orgs/${org.slug}`} prefetch={false} className="card flex items-center gap-3 p-3.5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl" style={{ background: "var(--surface-2)" }}>
                {org.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{org.name}</span>
                <span className="faint block truncate text-[12px]">
                  {org.member_count} {org.member_count === 1 ? "member" : "members"}
                  {org.open_tasks > 0 && ` · ${org.open_tasks} open`}
                </span>
              </span>
              <span className="faint text-lg">›</span>
            </Link>
          ))}
        </div>
      )}

      <div className="px-3 py-6">
        <CreateOrgButton />
      </div>
    </>
  );
}
