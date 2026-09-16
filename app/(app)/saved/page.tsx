import Link from "next/link";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getTask } from "@/lib/queries";
import { savedTaskIds } from "@/lib/saved";

export const dynamic = "force-dynamic";

export default async function SavedPage() {
  const user = await requireUser();
  const tasks = savedTaskIds(user.id)
    .map((id) => getTask(id, user))
    .filter((t): t is NonNullable<typeof t> => t !== null);

  const open = tasks.filter((t) => t.status === "open");
  const gone = tasks.filter((t) => t.status !== "open");

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href="/me" className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-[19px] font-bold tracking-tight">Saved</h1>
      </header>

      {tasks.length === 0 ? (
        <EmptyState
          emoji="🔖"
          title="Nothing saved"
          body="Tap the bookmark on any task to keep it here — useful for work you want but can't take this minute."
          action={
            <Link href="/feed" className="btn btn-primary mt-1">
              Browse tasks
            </Link>
          }
        />
      ) : (
        <main className="space-y-2.5 px-3">
          {open.map((t) => (
            <TaskCard key={t.id} task={t} />
          ))}
          {gone.length > 0 && (
            <>
              <h2 className="faint px-1 pb-1 pt-5 text-[11px] font-bold uppercase tracking-[0.08em]">
                No longer open
              </h2>
              {gone.map((t) => (
                <div key={t.id} className="opacity-55">
                  <TaskCard task={t} />
                </div>
              ))}
            </>
          )}
        </main>
      )}
    </>
  );
}
