import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportButton } from "@/components/TaskActions";
import { Avatar, SectionLabel, Stars, TrustMeter, VerifiedBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { publicProfile } from "@/lib/queries";
import { TRANSPORT_BY_ID } from "@/lib/taxonomy";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ProfilePage({ params }: { params: Promise<{ handle: string }> }) {
  const me = await requireUser();
  const { handle } = await params;
  const profile = publicProfile(handle);
  if (!profile) notFound();

  const { user, reviews } = profile;
  const isMe = user.id === me.id;

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href="/feed" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
      </header>

      <main className="px-4 pb-10">
        <div className="flex items-start gap-4">
          <Avatar user={user} size={72} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[21px] font-bold tracking-tight">{user.name}</h1>
              {user.verified && <VerifiedBadge />}
            </div>
            <p className="faint mt-0.5 text-[13px]">
              @{user.handle}
              {user.class_year && ` · ${user.class_year}`}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <Stars value={user.rating} size={15} />
              <span className="muted text-[13px]">{user.review_count} reviews</span>
            </div>
          </div>
        </div>

        {user.bio && <p className="mt-4 text-[15px] leading-relaxed">{user.bio}</p>}

        <div className="mt-5 grid grid-cols-3 gap-2 text-center">
          <Stat value={String(user.completed_count)} label="Completed" />
          <Stat value={user.rating ? user.rating.toFixed(1) : "—"} label="Rating" />
          <Stat value={String(user.trust_score)} label="Trust" />
        </div>

        <SectionLabel>Campus trust score</SectionLabel>
        <div className="card p-4">
          <TrustMeter score={user.trust_score} />
          <p className="muted mt-2.5 text-[13px] leading-relaxed">
            Built from BU verification, completed tasks, ratings, account age and dispute history.
            Separate from the star rating on purpose: stars say how good someone is, trust says how
            safe they are to transact with.
          </p>
        </div>

        <SectionLabel>Gets around by</SectionLabel>
        <div className="rail px-0">
          {user.transport.map((t) => {
            const mode = TRANSPORT_BY_ID.get(t);
            return mode ? (
              <span key={t} className="chip">
                {mode.emoji} {mode.label}
              </span>
            ) : null;
          })}
          <span className="chip">📍 {user.home_area}</span>
        </div>

        {user.skills.length > 0 && (
          <>
            <SectionLabel>Skills</SectionLabel>
            <div className="flex flex-wrap gap-2">
              {user.skills.map((s) => (
                <span key={s} className="chip">{s}</span>
              ))}
            </div>
          </>
        )}

        <SectionLabel>Reviews</SectionLabel>
        {reviews.length === 0 ? (
          <p className="muted px-1 text-[14px]">No reviews yet.</p>
        ) : (
          <div className="space-y-2.5">
            {reviews.map((r) => (
              <div key={r.id} className="card p-3.5">
                <div className="flex items-center gap-2">
                  <Avatar user={r.author} size={24} />
                  <span className="text-[13px] font-semibold">{r.author.name}</span>
                  <span className="faint ml-auto text-[11px]">{timeAgo(r.created_at)}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Stars value={r.stars} />
                  {r.would_again === 1 && (
                    <span className="text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
                      Would work with again
                    </span>
                  )}
                </div>
                {r.body && <p className="mt-2 text-[14px] leading-relaxed">{r.body}</p>}
                <p className="faint mt-1.5 text-[11px]">on “{r.task_title}”</p>
              </div>
            ))}
          </div>
        )}

        {!isMe && (
          <div className="mt-6">
            <ReportButton targetType="user" targetId={user.id} canBlock />
          </div>
        )}
      </main>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border px-2 py-3 hairline" style={{ background: "var(--surface)" }}>
      <p className="price text-[19px]">{value}</p>
      <p className="faint mt-0.5 text-[11px] font-medium">{label}</p>
    </div>
  );
}
