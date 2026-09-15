import { Suspense } from "react";
import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/ui";
import { SearchBox } from "@/components/SearchBox";
import { requireUser } from "@/lib/auth";
import { DEFAULT_FILTERS, listTasks } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const q = (Array.isArray(sp.q) ? sp.q[0] : sp.q) ?? "";
  const results = q.trim() ? listTasks(user, { ...DEFAULT_FILTERS, sort: "nearby", query: q }) : [];

  return (
    <>
      <header className="flex items-center gap-2.5 px-3 py-3">
        <Link href="/feed" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <Suspense fallback={<div className="field flex-1" />}>
          <SearchBox initial={q} />
        </Suspense>
      </header>

      <main className="space-y-2.5 px-3">
        {!q.trim() ? (
          <EmptyState
            emoji="🔎"
            title="Search open tasks"
            body="Try a course code like CH203, a skill like video editing, or a place like Warren."
          />
        ) : results.length === 0 ? (
          <EmptyState emoji="🫙" title={`Nothing open for “${q}”`} body="Try a broader term, or post the task yourself and let someone come to you." />
        ) : (
          results.map((t) => <TaskCard key={t.id} task={t} />)
        )}
      </main>
    </>
  );
}
