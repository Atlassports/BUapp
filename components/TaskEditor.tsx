"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "./Sheet";
import { Banner } from "./ui";
import { CATEGORIES, categoryOf, type CategoryId } from "@/lib/taxonomy";
import { DEADLINE_PRESETS } from "@/lib/infer";

const DURATIONS = [15, 30, 45, 60, 90, 120, 180, 300];

export function TaskEditor({
  taskId,
  initial,
}: {
  taskId: string;
  initial: {
    title: string;
    body: string;
    category: CategoryId;
    tags: string[];
    priceType: "fixed" | "range" | "open";
    priceMin: number;
    priceMax: number;
    estMinutes: number;
  };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [body, setBody] = useState(initial.body);
  const [category, setCategory] = useState<CategoryId>(initial.category);
  const [tags, setTags] = useState<string[]>(initial.tags);
  const [priceType, setPriceType] = useState(initial.priceType);
  const [amount, setAmount] = useState(String(initial.priceMin / 100));
  const [amountMax, setAmountMax] = useState(String(initial.priceMax / 100));
  const [estMinutes, setEstMinutes] = useState(initial.estMinutes);
  const [deadline, setDeadline] = useState("3h");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cents = Math.round(Number(amount || 0) * 100);
  const centsMax = Math.round(Number(amountMax || 0) * 100);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${taskId}/edit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          category,
          tags,
          priceType,
          priceMin: priceType === "open" ? 0 : cents,
          priceMax: priceType === "range" ? centsMax : cents,
          estMinutes,
          deadlineHours: DEADLINE_PRESETS.find((d) => d.id === deadline)?.hours ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      router.push(`/tasks/${taskId}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const subTags = categoryOf(category).subcategories;

  return (
    <div className="space-y-6 px-4 pb-10">
      <Banner>
        Anyone who already applied will be told the terms changed. Once you accept someone, the
        task is locked to what they agreed to.
      </Banner>

      <div>
        <label className="mb-2 block text-[15px] font-semibold">Title</label>
        <input className="field" value={title} maxLength={100} onChange={(e) => setTitle(e.target.value)} />
      </div>

      <div>
        <label className="mb-2 block text-[15px] font-semibold">Details</label>
        <textarea className="field resize-none" rows={4} maxLength={1200} value={body} onChange={(e) => setBody(e.target.value)} />
      </div>

      <div>
        <label className="mb-2 block text-[15px] font-semibold">Category</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c.id} type="button" className={`chip ${category === c.id ? "chip-active" : ""}`} onClick={() => setCategory(c.id)}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
      </div>

      {subTags.length > 0 && (
        <div>
          <label className="mb-2 block text-[15px] font-semibold">Tags</label>
          <div className="flex flex-wrap gap-2">
            {subTags.map((t) => (
              <button
                key={t}
                type="button"
                className={`chip ${tags.includes(t) ? "chip-active" : ""}`}
                onClick={() => setTags(tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t])}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="mb-2 block text-[15px] font-semibold">How long</label>
        <div className="flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <button key={m} type="button" className={`chip ${estMinutes === m ? "chip-active" : ""}`} onClick={() => setEstMinutes(m)}>
              {m < 60 ? `${m} min` : m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} hr`}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[15px] font-semibold">New deadline</label>
        <div className="flex flex-wrap gap-2">
          {DEADLINE_PRESETS.map((d) => (
            <button key={d.id} type="button" className={`chip ${deadline === d.id ? "chip-active" : ""}`} onClick={() => setDeadline(d.id)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-2 block text-[15px] font-semibold">Price</label>
        <div className="mb-3 flex gap-2">
          {(["fixed", "range", "open"] as const).map((id) => (
            <button key={id} type="button" className={`chip ${priceType === id ? "chip-active" : ""}`} onClick={() => setPriceType(id)}>
              {id === "fixed" ? "Fixed" : id === "range" ? "Range" : "Make an offer"}
            </button>
          ))}
        </div>
        {priceType !== "open" && (
          <div className="flex items-center gap-2">
            <input className="field price" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            {priceType === "range" && (
              <>
                <span className="faint">to</span>
                <input className="field price" inputMode="decimal" value={amountMax} onChange={(e) => setAmountMax(e.target.value.replace(/[^\d.]/g, ""))} />
              </>
            )}
          </div>
        )}
      </div>

      {error && <Banner tone="scarlet">{error}</Banner>}

      <ActionButton busy={busy} disabled={title.trim().length < 6} onClick={save}>
        Save changes
      </ActionButton>
    </div>
  );
}
