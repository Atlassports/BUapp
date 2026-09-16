"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { CATEGORIES, TRANSPORT, type TransportId } from "@/lib/taxonomy";
import { DISTANCE_FILTERS } from "@/lib/geo";

const SORTS = [
  { id: "nearby", label: "Nearby" },
  { id: "foryou", label: "For You" },
  { id: "new", label: "New" },
  { id: "ending", label: "Ending Soon" },
] as const;

const TIME_WINDOWS = [
  { id: "2", label: "Next 2 hours" },
  { id: "6", label: "Next 6 hours" },
  { id: "24", label: "Today" },
  { id: "72", label: "Next 3 days" },
];

export function FeedControls({ activeCount, myTransport }: { activeCount: number; myTransport: TransportId[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const urlSort = params.get("sort") ?? "nearby";
  // Show the tapped sort as selected right away; the feed catches up behind it.
  const [pendingSort, setPendingSort] = useState<string | null>(null);
  useEffect(() => setPendingSort(null), [urlSort]);
  const sort = pendingSort ?? urlSort;
  const cats = params.get("cat")?.split(",").filter(Boolean) ?? [];

  function apply(next: Record<string, string | null>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === null || v === "") sp.delete(k);
      else sp.set(k, v);
    }
    // A transition keeps the current feed interactive while the next one loads,
    // instead of blanking the list mid-tap.
    startTransition(() => router.replace(`/feed?${sp.toString()}`, { scroll: false }));
  }

  function toggleCat(id: string) {
    const next = cats.includes(id) ? cats.filter((c) => c !== id) : [...cats, id];
    apply({ cat: next.join(",") || null });
  }

  return (
    <>
      <div className="rail px-4 pb-2.5">
        <div className="flex gap-1">
          {SORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setPendingSort(s.id);
                apply({ sort: s.id });
              }}
              className={`shrink-0 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                sort === s.id
                  ? "bg-[var(--ink)] text-[var(--bg)]"
                  : "muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rail px-4 pb-3">
        <button
          onClick={() => setOpen(true)}
          className="relative flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold hairline"
          aria-label="Filters"
          style={{ background: "var(--surface-2)" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 6h18M7 12h10M11 18h2" />
          </svg>
          Filter
          {activeCount > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-scarlet-600 px-1 text-[10px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
        <span className="w-px shrink-0 self-stretch" style={{ background: "var(--line)" }} aria-hidden />
        <button
          onClick={() => apply({ cat: null })}
          className={`chip ${cats.length === 0 ? "chip-active" : ""}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => toggleCat(c.id)}
            className={`chip ${cats.includes(c.id) ? "chip-active" : ""}`}
          >
            {c.emoji} {c.label}
          </button>
        ))}
      </div>

      {open && (
        <FilterSheet
          params={params}
          myTransport={myTransport}
          onClose={() => setOpen(false)}
          onApply={apply}
        />
      )}
    </>
  );
}

function FilterSheet({
  params,
  myTransport,
  onClose,
  onApply,
}: {
  params: URLSearchParams;
  myTransport: TransportId[];
  onClose: () => void;
  onApply: (next: Record<string, string | null>) => void;
}) {
  const [dist, setDist] = useState(params.get("dist") ?? "any");
  const [transport, setTransport] = useState<TransportId[]>(
    (params.get("transport")?.split(",").filter(Boolean) ?? []) as TransportId[],
  );
  const [minPrice, setMinPrice] = useState(params.get("min") ?? "");
  const [within, setWithin] = useState(params.get("within") ?? "");
  const [remote, setRemote] = useState(params.get("remote") !== "0");

  function submit() {
    onApply({
      dist: dist === "any" ? null : dist,
      transport: transport.join(",") || null,
      min: minPrice || null,
      within: within || null,
      remote: remote ? null : "0",
    });
    onClose();
  }

  function clear() {
    onApply({ dist: null, transport: null, min: null, within: null, remote: null, cat: null });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade" role="dialog" aria-modal="true">
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close filters" />
      <div
        className="relative mx-auto max-h-[86dvh] w-full max-w-lg animate-sheet overflow-y-auto rounded-t-3xl border-t surface hairline"
        style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b px-5 py-4 hairline" style={{ background: "var(--surface)" }}>
          <button onClick={clear} className="muted text-[13px] font-medium">
            Clear all
          </button>
          <h2 className="text-[15px] font-bold">Filters</h2>
          <button onClick={onClose} className="muted text-[13px] font-medium">
            Close
          </button>
        </div>

        <div className="space-y-6 px-5 py-5">
          <Group title="Distance" hint="Measured from where you spend most of your time.">
            <div className="flex flex-wrap gap-2">
              {DISTANCE_FILTERS.map((d) => (
                <button key={d.id} className={`chip ${dist === d.id ? "chip-active" : ""}`} onClick={() => setDist(d.id)}>
                  {d.label}
                </button>
              ))}
            </div>
          </Group>

          <Group title="Transportation" hint="Only show tasks you can actually reach and complete.">
            <div className="flex flex-wrap gap-2">
              {TRANSPORT.map((t) => {
                const on = transport.includes(t.id);
                return (
                  <button
                    key={t.id}
                    className={`chip ${on ? "chip-active" : ""}`}
                    onClick={() => setTransport(on ? transport.filter((x) => x !== t.id) : [...transport, t.id])}
                  >
                    {t.emoji} {t.label}
                  </button>
                );
              })}
            </div>
            {myTransport.length > 0 && (
              <button
                className="mt-2.5 text-[12px] font-semibold text-scarlet-600 dark:text-scarlet-400"
                onClick={() => setTransport(myTransport)}
              >
                Use what's on my profile
              </button>
            )}
          </Group>

          <Group title="Minimum pay">
            <div className="flex flex-wrap gap-2">
              {["", "1000", "2000", "3000", "5000"].map((v) => (
                <button key={v || "any"} className={`chip ${minPrice === v ? "chip-active" : ""}`} onClick={() => setMinPrice(v)}>
                  {v ? `$${Number(v) / 100}+` : "Any"}
                </button>
              ))}
            </div>
          </Group>

          <Group title="When">
            <div className="flex flex-wrap gap-2">
              <button className={`chip ${within === "" ? "chip-active" : ""}`} onClick={() => setWithin("")}>
                Anytime
              </button>
              {TIME_WINDOWS.map((w) => (
                <button key={w.id} className={`chip ${within === w.id ? "chip-active" : ""}`} onClick={() => setWithin(w.id)}>
                  {w.label}
                </button>
              ))}
            </div>
          </Group>

          <label className="flex items-center justify-between rounded-xl border px-3.5 py-3 hairline">
            <span>
              <span className="block text-[14px] font-semibold">Include remote tasks</span>
              <span className="faint text-[12px]">Tutoring over Zoom, video editing, design work</span>
            </span>
            <input
              type="checkbox"
              className="h-5 w-5 accent-[var(--color-scarlet-600)]"
              checked={remote}
              onChange={(e) => setRemote(e.target.checked)}
            />
          </label>

          <button className="btn btn-primary w-full" onClick={submit}>
            Show tasks
          </button>
        </div>
      </div>
    </div>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-[14px] font-bold">{title}</h3>
      {hint && <p className="faint mb-2.5 mt-0.5 text-[12px] leading-relaxed">{hint}</p>}
      <div className={hint ? "" : "mt-2.5"}>{children}</div>
    </div>
  );
}
