import Link from "next/link";
import { notFound } from "next/navigation";
import { OrgMembership } from "@/components/OrgControls";
import { TaskCard } from "@/components/TaskCard";
import { Avatar, EmptyState, SectionLabel, VerifiedBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { canPostForOrg, orgBySlug, orgMembers, orgTasks, roleInOrg } from "@/lib/orgs";
import { getTask } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function OrgPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const org = orgBySlug(slug);
  if (!org) notFound();

  const role = roleInOrg(org.id, user.id);
  const members = orgMembers(org.id);
  const canPost = canPostForOrg(org.id, user.id);
  const tasks = orgTasks(org.id)
    .map((t) => getTask(t.id, user))
    .filter((t): t is NonNullable<typeof t> => t !== null);
  const open = tasks.filter((t) => t.status === "open");
  const past = tasks.filter((t) => t.status !== "open");

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href="/orgs" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
      </header>

      <main className="px-4 pb-10">
        <div className="flex items-start gap-4">
          <span className="flex h-[68px] w-[68px] shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: "var(--surface-2)" }}>
            {org.emoji}
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[21px] font-bold tracking-tight">{org.name}</h1>
              {org.verified_at && <VerifiedBadge />}
            </div>
            <p className="faint mt-0.5 text-[13px]">
              {org.category} · {members.length} {members.length === 1 ? "member" : "members"}
            </p>
          </div>
        </div>

        {org.blurb && <p className="mt-4 text-[15px] leading-relaxed">{org.blurb}</p>}

        <div className="mt-5">
          <OrgMembership slug={org.slug} joined={role !== null} role={role} />
        </div>

        {canPost && (
          <Link href={`/post?org=${org.slug}`} className="btn btn-ghost mt-2.5 w-full py-2.5 text-[14px]">
            Post a task as {org.name}
          </Link>
        )}

        <SectionLabel>{open.length} open {open.length === 1 ? "posting" : "postings"}</SectionLabel>
        {open.length === 0 ? (
          <EmptyState
            emoji="📋"
            title="Nothing open"
            body={
              canPost
                ? "Post what the club needs — a photographer for an event, someone to design a flyer, help running the door."
                : "This club hasn't posted anything right now. Join to see new postings first."
            }
          />
        ) : (
          <div className="space-y-2.5">
            {open.map((t) => (
              <TaskCard key={t.id} task={t} />
            ))}
          </div>
        )}

        <SectionLabel>Members</SectionLabel>
        <div className="overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
          {members.map((m) => (
            <Link key={m.user.id} href={`/u/${m.user.handle}`} prefetch={false} className="flex items-center gap-3 px-4 py-3">
              <Avatar user={m.user} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-semibold">{m.user.name}</span>
                <span className="faint block text-[12px] capitalize">{m.role}</span>
              </span>
            </Link>
          ))}
        </div>

        {past.length > 0 && (
          <>
            <SectionLabel>Past postings</SectionLabel>
            <div className="space-y-2.5 opacity-60">
              {past.slice(0, 5).map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}
