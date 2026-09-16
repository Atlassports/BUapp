/**
 * Loading states. These exist so a tap produces something instantly instead of
 * leaving the previous screen sitting there during the server round trip — that
 * dead interval is what reads as "slow", more than the actual latency does.
 *
 * Each skeleton mirrors the layout it replaces, so the real content swaps in
 * without the page jumping.
 */

export function FeedSkeleton() {
  return (
    <>
      <header className="border-b px-4 pb-3 pt-3.5 hairline">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-scarlet-600 text-[15px] font-black text-white">
            S
          </span>
          <div className="sk h-5 w-28" />
        </div>
        <div className="mt-3 flex gap-2">
          {[64, 58, 40, 76].map((w, i) => (
            <div key={i} className="sk h-7" style={{ width: w }} />
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          {[44, 72, 96].map((w, i) => (
            <div key={i} className="sk h-[34px] rounded-full" style={{ width: w }} />
          ))}
        </div>
      </header>
      <div className="space-y-2.5 px-3 pt-3">
        {[0, 1, 2, 3].map((i) => (
          <TaskCardSkeleton key={i} />
        ))}
      </div>
    </>
  );
}

export function TaskCardSkeleton() {
  return (
    <div className="card p-3.5">
      <div className="flex gap-3">
        <div className="flex w-[62px] shrink-0 flex-col items-center gap-1.5 pt-0.5">
          <div className="sk h-5 w-12" />
          <div className="sk h-3 w-9" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="sk h-4 w-[85%]" />
          <div className="sk mt-2 h-3 w-[60%]" />
          <div className="mt-2.5 flex gap-1.5">
            <div className="sk h-[34px] w-24 rounded-full" />
            <div className="sk h-[34px] w-20 rounded-full" />
          </div>
          <div className="mt-3 flex items-center gap-2 border-t pt-2.5 hairline">
            <div className="sk h-5 w-5 rounded-full" />
            <div className="sk h-3 w-20" />
            <div className="sk ml-auto h-3 w-12" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 4, title }: { rows?: number; title: string }) {
  return (
    <>
      <header className="px-4 pb-3 pt-5">
        <div className="sk h-7 w-44" />
        <div className="sk mt-2 h-3 w-[70%]" />
        <span className="sr-only">{title}</span>
      </header>
      <div className="mx-3 overflow-hidden rounded-2xl border hairline divide-hair" style={{ background: "var(--surface)" }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3.5">
            <div className="sk h-10 w-10 rounded-full" />
            <div className="min-w-0 flex-1">
              <div className="sk h-3.5 w-28" />
              <div className="sk mt-2 h-3 w-[65%]" />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

export function DetailSkeleton() {
  return (
    <>
      <div className="flex items-center gap-3 border-b px-3 py-3 hairline">
        <div className="sk h-8 w-8 rounded-lg" />
        <div className="sk h-[34px] w-32 rounded-full" />
      </div>
      <div className="px-4 pt-4">
        <div className="sk h-9 w-24" />
        <div className="sk mt-3 h-5 w-[80%]" />
        <div className="sk mt-2 h-5 w-[55%]" />
        <div className="mt-5 grid grid-cols-2 gap-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="sk h-9" />
          ))}
        </div>
        <div className="sk mt-5 h-3 w-full" />
        <div className="sk mt-2 h-3 w-[90%]" />
        <div className="sk mt-2 h-3 w-[70%]" />
        <div className="card mt-6 p-4">
          <div className="flex items-center gap-3">
            <div className="sk h-11 w-11 rounded-full" />
            <div className="flex-1">
              <div className="sk h-3.5 w-28" />
              <div className="sk mt-2 h-3 w-20" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="px-4 pt-5">
      <div className="flex items-start gap-4">
        <div className="sk h-[72px] w-[72px] rounded-full" />
        <div className="flex-1 pt-1">
          <div className="sk h-6 w-36" />
          <div className="sk mt-2 h-3 w-24" />
          <div className="sk mt-3 h-3 w-28" />
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="sk h-[76px] rounded-xl" />
        ))}
      </div>
      <div className="sk mt-6 h-4 w-32" />
      <div className="card mt-2 p-4">
        <div className="sk h-1.5 w-full rounded-full" />
        <div className="sk mt-3 h-3 w-full" />
        <div className="sk mt-2 h-3 w-[80%]" />
      </div>
    </div>
  );
}

export function ComposerSkeleton() {
  return (
    <div className="px-4 pt-5">
      <div className="sk h-7 w-40" />
      <div className="sk mt-2 h-3 w-[75%]" />
      <div className="sk mt-6 h-4 w-36" />
      <div className="sk mt-2 h-12 rounded-xl" />
      <div className="sk mt-6 h-3 w-48" />
      <div className="mt-3 flex flex-wrap gap-2">
        {[80, 110, 90, 70, 100, 86].map((w, i) => (
          <div key={i} className="sk h-[34px] rounded-full" style={{ width: w }} />
        ))}
      </div>
    </div>
  );
}
