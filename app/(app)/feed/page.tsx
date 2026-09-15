import { Suspense } from "react";
import Link from "next/link";
import { FeedControls } from "@/components/FeedControls";
import { TaskCard } from "@/components/TaskCard";
import { EmptyState } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { DEFAULT_FILTERS, listTasks, type FeedFilters, type FeedSort } from "@/lib/queries";
import type { TransportId } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

type SP = Record<string, string | string[] | undefined>;

function one(sp: SP, key: string): string {
  const v = sp[key];
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

function parseFilters(sp: SP): { filters: FeedFilters; activeCount: number } {
  const dist = one(sp, "dist");
  const transport = one(sp, "transport").split(",").filter(Boolean) as TransportId[];
  const cats = one(sp, "cat").split(",").filter(Boolean);
  const min = Number(one(sp, "min")) || 0;
  const within = one(sp, "within") ? Number(one(sp, "within")) : null;
  const includeRemote = one(sp, "remote") !== "0";

  const filters: FeedFilters = {
    ...DEFAULT_FILTERS,
    sort: (["nearby", "foryou", "new", "ending"].includes(one(sp, "sort"))
      ? one(sp, "sort")
      : "nearby") as FeedSort,
    categories: cats,
    maxDistance: dist && dist !== "any" ? Number(dist) : Infinity,
    transport,
    minPrice: min,
    withinHours: within,
    includeRemote,
    query: one(sp, "q"),
  };

  const activeCount =
    (filters.maxDistance !== Infinity ? 1 : 0) +
    (transport.length ? 1 : 0) +
    (min ? 1 : 0) +
    (within !== null ? 1 : 0) +
    (!includeRemote ? 1 : 0) +
    (cats.length ? 1 : 0);

  return { filters, activeCount };
}

export default async function FeedPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const { filters, activeCount } = parseFilters(sp);
  const tasks = listTasks(user, filters);

  const myTransport = (user.transport ? user.transport.split(",") : []) as TransportId[];

  return (
    <>
      <header
        className="sticky top-0 z-30 border-b backdrop-blur-xl hairline"
        style={{ background: "color-mix(in srgb, var(--bg) 85%, transparent)" }}
      >
        <div className="flex items-center justify-between px-4 pb-1 pt-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-scarlet-600 text-[15px] font-black text-white">
              S
            </span>
            <h1 className="text-[19px] font-bold tracking-tight">BU Tasks</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/search"
              className="flex h-8 w-8 items-center justify-center rounded-lg border hairline"
              aria-label="Search"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.2-3.2" />
              </svg>
            </Link>
          </div>
        </div>

        <Suspense fallback={<div className="h-[86px]" />}>
          <FeedControls activeCount={activeCount} myTransport={myTransport} />
        </Suspense>
      </header>

      <main className="space-y-2.5 px-3 pt-3">
        {tasks.length === 0 ? (
          <EmptyState
            emoji="🪹"
            title="Nothing matches yet"
            body={
              activeCount > 0
                ? "Your filters are narrow. Widen the distance or clear a filter to see what else is open."
                : "No open tasks right now. Post the first one — someone nearby is probably free."
            }
            action={
              <Link href="/post" className="btn btn-primary mt-1">
                Post a task
              </Link>
            }
          />
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
        {tasks.length > 0 && (
          <p className="faint py-6 text-center text-[12px]">
            {tasks.length} open {tasks.length === 1 ? "task" : "tasks"} · BU only
          </p>
        )}
      </main>
    </>
  );
}
