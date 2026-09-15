"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { CATEGORIES, categoryOf, TRANSPORT, type CategoryId, type TransportId } from "@/lib/taxonomy";
import { PLACES, haversineMiles, PLACE_BY_ID } from "@/lib/geo";
import { DEADLINE_PRESETS, inferFromTitle } from "@/lib/infer";
import { suggestPrice, feeBreakdown, PLATFORM_FEE_RATE } from "@/lib/pricing";
import { ACADEMIC_NOTICE } from "@/lib/safety";
import { money } from "@/lib/format";
import { Banner } from "./ui";

/** Maps an inferred urgency in hours back to the closest deadline preset. */
function presetForHours(hours: number | null): string | null {
  if (hours === null) return null;
  let best: { id: string; delta: number } | null = null;
  for (const p of DEADLINE_PRESETS) {
    if (p.hours === null) continue;
    const delta = Math.abs(p.hours - hours);
    if (!best || delta < best.delta) best = { id: p.id, delta };
  }
  return best?.id ?? null;
}

const DURATION_CHOICES = [15, 30, 45, 60, 90, 120, 180, 300];

function nearestDuration(minutes: number): number {
  return DURATION_CHOICES.reduce((best, m) =>
    Math.abs(m - minutes) < Math.abs(best - minutes) ? m : best,
  );
}

const EXAMPLES = [
  "Pick up my package from Warren",
  "Help me move a couch in Allston",
  "Tutor me in Orgo tonight",
  "Edit a 30-second TikTok",
  "Ride to Logan on Saturday",
  "Walk my dog this week",
];

export function Composer({ home }: { home: { lat: number; lng: number } }) {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const guess = useMemo(() => inferFromTitle(title), [title]);

  const [category, setCategory] = useState<CategoryId | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [transportReq, setTransportReq] = useState<TransportId | null>(null);
  const [estMinutes, setEstMinutes] = useState<number | null>(null);
  const [deadline, setDeadline] = useState("3h");
  const [priceType, setPriceType] = useState<"fixed" | "range" | "open">("fixed");
  const [amount, setAmount] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inferred values act as defaults until the poster overrides them.
  const effCategory = touched.category && category ? category : guess.category;
  const effPlaceId = touched.place && placeId ? placeId : (guess.placeId ?? "warren");
  const effTransport = touched.transport ? transportReq : guess.transportRequired;
  const effMinutes = touched.minutes && estMinutes ? estMinutes : nearestDuration(guess.estMinutes);
  const effTags = touched.tags ? tags : guess.tags;
  const effDeadline = touched.deadline ? deadline : (presetForHours(guess.urgentHours) ?? deadline);

  const place = PLACE_BY_ID.get(effPlaceId) ?? PLACES[0];
  const isRemote = effPlaceId === "remote";
  const distance = isRemote ? 0 : haversineMiles(home, place);
  const deadlineHours = DEADLINE_PRESETS.find((d) => d.id === effDeadline)?.hours ?? null;

  const suggestion = useMemo(
    () =>
      suggestPrice({
        category: effCategory,
        estMinutes: effMinutes,
        distanceMi: distance,
        transportRequired: effTransport,
        urgentHours: deadlineHours,
      }),
    [effCategory, effMinutes, distance, effTransport, deadlineHours],
  );

  const cents = Math.round(Number(amount || 0) * 100);
  const centsMax = Math.round(Number(amountMax || 0) * 100);
  const fee = feeBreakdown(priceType === "range" ? centsMax || cents : cents);

  const catDef = categoryOf(effCategory);
  const subTags = catDef.subcategories;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          category: effCategory,
          tags: effTags,
          placeId: effPlaceId,
          transportRequired: isRemote ? null : effTransport,
          estMinutes: effMinutes,
          deadlineHours,
          priceType,
          priceMin: priceType === "open" ? 0 : cents,
          priceMax: priceType === "range" ? centsMax : cents,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't post that.");
        return;
      }
      router.push(`/tasks/${data.id}`);
    } catch {
      setError("Network trouble. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const priceValid =
    priceType === "open" ||
    (priceType === "fixed" && cents >= 100) ||
    (priceType === "range" && cents >= 100 && centsMax > cents);

  return (
    <form onSubmit={submit} className="space-y-7 px-4 pb-10">
      <div>
        <label className="mb-2 block text-[15px] font-semibold">What do you need?</label>
        <input
          className="field text-[16px]"
          autoFocus
          maxLength={100}
          placeholder="Pick up my package from the Warren mailroom"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        {title.length > 8 && (
          <p className="faint mt-2 text-[12px] leading-relaxed">
            Sorted into <span className="font-semibold text-[var(--ink-2)]">{catDef.label}</span>
            {guess.placeId && !touched.place && (
              <>
                {" "}at <span className="font-semibold text-[var(--ink-2)]">{place.name}</span>
              </>
            )}
            {" "}· about {effMinutes} min. Change anything below.
          </p>
        )}
      </div>

      {title.length <= 8 && (
        <div className="animate-rise">
          <p className="faint mb-2.5 text-[12px] font-bold uppercase tracking-[0.06em]">
            Or start from one of these
          </p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button key={e} type="button" className="chip" onClick={() => setTitle(e)}>
                {e}
              </button>
            ))}
          </div>
        </div>
      )}

      {title.length > 8 && (
        <>
          <div className="animate-rise">
            <label className="mb-2 block text-[15px] font-semibold">Details</label>
            <textarea
              className="field resize-none text-[15px]"
              rows={3}
              maxLength={1200}
              placeholder="Tracking number is in my email — I'll forward it. Package is a medium box, nothing heavy."
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>

          {effCategory === "academic" && <Banner tone="warn">{ACADEMIC_NOTICE}</Banner>}

          <Field label="Category">
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`chip ${effCategory === c.id ? "chip-active" : ""}`}
                  onClick={() => {
                    setCategory(c.id);
                    setTouched((t) => ({ ...t, category: true }));
                  }}
                >
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </Field>

          {subTags.length > 0 && (
            <Field label="Tags" hint="Tags are how people find work they're actually good at.">
              <div className="flex flex-wrap gap-2">
                {subTags.map((s) => {
                  const on = effTags.includes(s);
                  return (
                    <button
                      key={s}
                      type="button"
                      className={`chip ${on ? "chip-active" : ""}`}
                      onClick={() => {
                        setTags(on ? effTags.filter((t) => t !== s) : [...effTags, s]);
                        setTouched((t) => ({ ...t, tags: true }));
                      }}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </Field>
          )}

          <Field label="Where">
            <select
              className="field"
              value={effPlaceId}
              onChange={(e) => {
                setPlaceId(e.target.value);
                setTouched((t) => ({ ...t, place: true }));
              }}
            >
              <option value="remote">💻 Remote / online</option>
              {PLACES.filter((p) => p.id !== "remote").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {!isRemote && (
              <p className="faint mt-1.5 text-[12px]">{distance.toFixed(1)} mi from you</p>
            )}
          </Field>

          {!isRemote && (
            <Field label="Transportation needed" hint="Leave on Any if it doesn't matter.">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`chip ${effTransport === null ? "chip-active" : ""}`}
                  onClick={() => {
                    setTransportReq(null);
                    setTouched((t) => ({ ...t, transport: true }));
                  }}
                >
                  Any
                </button>
                {TRANSPORT.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    className={`chip ${effTransport === t.id ? "chip-active" : ""}`}
                    onClick={() => {
                      setTransportReq(t.id);
                      setTouched((x) => ({ ...x, transport: true }));
                    }}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
              </div>
            </Field>
          )}

          <Field label="How long will it take?">
            <div className="flex flex-wrap gap-2">
              {DURATION_CHOICES.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`chip ${effMinutes === m ? "chip-active" : ""}`}
                  onClick={() => {
                    setEstMinutes(m);
                    setTouched((t) => ({ ...t, minutes: true }));
                  }}
                >
                  {m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} hr`}
                </button>
              ))}
            </div>
          </Field>

          <Field label="When do you need it done?">
            <div className="flex flex-wrap gap-2">
              {DEADLINE_PRESETS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`chip ${effDeadline === d.id ? "chip-active" : ""}`}
                  onClick={() => {
                    setDeadline(d.id);
                    setTouched((t) => ({ ...t, deadline: true }));
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="What will you pay?">
            <div className="mb-3 flex gap-2">
              {(
                [
                  ["fixed", "Fixed price"],
                  ["range", "Price range"],
                  ["open", "Make an offer"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={`chip ${priceType === id ? "chip-active" : ""}`}
                  onClick={() => setPriceType(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {priceType !== "open" && (
              <div className="flex items-center gap-2">
                <MoneyInput value={amount} onChange={setAmount} placeholder={String(suggestion.low)} />
                {priceType === "range" && (
                  <>
                    <span className="faint">to</span>
                    <MoneyInput value={amountMax} onChange={setAmountMax} placeholder={String(suggestion.high)} />
                  </>
                )}
              </div>
            )}

            <div className="mt-3 rounded-xl border px-3.5 py-3 hairline" style={{ background: "var(--surface-2)" }}>
              <p className="text-[13px] font-semibold">
                Typical BU price: ${suggestion.low}–{suggestion.high}
              </p>
              <ul className="faint mt-1.5 space-y-0.5 text-[12px]">
                {suggestion.rationale.map((r) => (
                  <li key={r}>· {r}</li>
                ))}
              </ul>
              {priceType !== "open" && cents > 0 && (
                <div className="muted mt-2.5 border-t pt-2.5 text-[12px] hairline">
                  They receive <span className="font-semibold text-[var(--ink)]">{money(fee.payout)}</span> ·
                  Sidekick fee {money(fee.fee)} ({Math.round(PLATFORM_FEE_RATE * 100)}%)
                </div>
              )}
              {priceType !== "open" && (
                <button
                  type="button"
                  className="mt-2.5 text-[12px] font-semibold text-scarlet-600 dark:text-scarlet-400"
                  onClick={() => {
                    setAmount(String(suggestion.low));
                    if (priceType === "range") setAmountMax(String(suggestion.high));
                  }}
                >
                  Use the suggested price
                </button>
              )}
            </div>
          </Field>

          {error && <Banner tone="scarlet">{error}</Banner>}

          <button className="btn btn-primary w-full" disabled={busy || title.trim().length < 6 || !priceValid}>
            {busy ? "Posting…" : "Post task"}
          </button>
          <p className="faint text-center text-[12px] leading-relaxed">
            Posting is free. Sidekick only takes a fee when a task is completed and paid.
          </p>
        </>
      )}
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="animate-rise">
      <label className="block text-[15px] font-semibold">{label}</label>
      {hint && <p className="faint mb-2 mt-0.5 text-[12px]">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}

function MoneyInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative flex-1">
      <span className="price pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-[var(--ink-3)]">
        $
      </span>
      <input
        className="field price pl-7 text-[17px]"
        inputMode="decimal"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
      />
    </div>
  );
}
