"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { Avatar, Banner, Stars, TrustMeter, VerifiedBadge } from "./ui";
import { money, timeAgo } from "@/lib/format";
import { feeBreakdown, feePercentLabel } from "@/lib/pricing";
import { REPORT_REASONS } from "@/lib/safety";
import { TRANSPORT_BY_ID } from "@/lib/taxonomy";
import type { PublicUser } from "@/lib/types";

function useAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function call(url: string, payload?: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload ?? {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Network trouble. Try again.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return { call, busy, error, setError };
}

/* ------------------------------------------------------------------ */

const QUICK_REPLIES = [
  "I can be there in 15 minutes.",
  "Are you available now?",
  "Where should we meet?",
  "How long will this take?",
];

export function ApplyForm({
  taskId,
  suggestedCents,
  priceType,
}: {
  taskId: string;
  suggestedCents: number;
  priceType: string;
}) {
  const { call, busy, error } = useAction();
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState(priceType === "open" ? "" : String(suggestedCents / 100));
  const [counter, setCounter] = useState(false);

  const cents = Math.round(Number(amount || 0) * 100);
  const payout = feeBreakdown(cents).payout;

  return (
    <div className="space-y-3">
      <textarea
        className="field resize-none text-[15px]"
        rows={3}
        maxLength={500}
        placeholder="I have a car and can be there at 6:30."
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />

      <div className="rail">
        {QUICK_REPLIES.map((q) => (
          <button key={q} type="button" className="chip" onClick={() => setNote(q)}>
            {q}
          </button>
        ))}
      </div>

      {priceType === "open" || counter ? (
        <div>
          <label className="mb-1.5 block text-[13px] font-semibold">Your price</label>
          <div className="relative">
            <span className="price pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[17px] text-[var(--ink-3)]">
              $
            </span>
            <input
              className="field price pl-7 text-[17px]"
              inputMode="decimal"
              value={amount}
              placeholder="25"
              onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
            />
          </div>
          {cents >= 100 && (
            <p className="faint mt-1.5 text-[12px]">
              You'd receive {money(payout)} after the {feePercentLabel(cents)} Sidekick fee.
            </p>
          )}
        </div>
      ) : (
        <button type="button" className="chip" onClick={() => setCounter(true)}>
          Offer a different price
        </button>
      )}

      {error && <Banner tone="scarlet">{error}</Banner>}

      <button
        className="btn btn-primary w-full"
        disabled={busy || (priceType === "open" && cents < 100)}
        onClick={() => call(`/api/tasks/${taskId}/offers`, { note, priceCents: cents })}
      >
        {busy ? "Sending…" : "Send offer"}
      </button>
      <p className="faint text-center text-[12px] leading-relaxed">
        Sending an offer opens a message thread with the poster. Nothing is charged to anyone until
        they accept.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function OfferList({
  offers,
  isPoster,
  taskOpen,
}: {
  offers: Array<{
    id: string;
    note: string;
    price_cents: number;
    status: string;
    created_at: number;
    user: PublicUser;
  }>;
  isPoster: boolean;
  taskOpen: boolean;
}) {
  const { call, busy, error } = useAction();

  if (!offers.length) return null;

  return (
    <div className="space-y-2.5">
      {error && <Banner tone="scarlet">{error}</Banner>}
      {offers.map((o) => (
        <div key={o.id} className="card p-3.5">
          <div className="flex items-start gap-3">
            <Avatar user={o.user} size={40} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href={`/u/${o.user.handle}`} className="text-[14px] font-semibold" prefetch={false}>
                  {o.user.name}
                </Link>
                {o.user.verified && <VerifiedBadge compact />}
                <Stars value={o.user.rating} />
                <span className="price ml-auto text-[16px] text-scarlet-600 dark:text-scarlet-400">
                  {money(o.price_cents)}
                </span>
              </div>

              <div className="muted mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
                {o.user.transport.map((t) => {
                  const mode = TRANSPORT_BY_ID.get(t);
                  return mode ? <span key={t}>{mode.emoji} {mode.label}</span> : null;
                })}
                <span>{o.user.completed_count} completed</span>
                <span>· {timeAgo(o.created_at)}</span>
              </div>

              {o.note && <p className="mt-2 text-[14px] leading-relaxed">“{o.note}”</p>}

              <div className="mt-2.5">
                <p className="faint mb-1 text-[11px] font-bold uppercase tracking-[0.06em]">
                  Campus trust score
                </p>
                <TrustMeter score={o.user.trust_score} />
              </div>

              {o.status === "accepted" ? (
                <p className="mt-3 text-[13px] font-semibold text-emerald-600 dark:text-emerald-400">
                  ✓ Accepted
                </p>
              ) : o.status === "declined" ? (
                <p className="faint mt-3 text-[13px]">Not selected</p>
              ) : isPoster && taskOpen ? (
                <div className="mt-3 flex gap-2">
                  <button
                    className="btn btn-primary flex-1 py-2 text-[14px]"
                    disabled={busy}
                    onClick={() => call(`/api/offers/${o.id}/accept`)}
                  >
                    Accept {money(o.price_cents)}
                  </button>
                  <Link href={`/messages/${o.id}`} className="btn btn-ghost py-2 text-[14px]">
                    Message
                  </Link>
                  <button
                    className="btn btn-ghost py-2 text-[14px]"
                    disabled={busy}
                    onClick={() => call(`/api/offers/${o.id}/decline`)}
                    aria-label={`Decline ${o.user.name}`}
                  >
                    Pass
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function CompleteButton({ taskId, amountCents }: { taskId: string; amountCents: number }) {
  const { call, busy, error } = useAction();
  const [confirming, setConfirming] = useState(false);
  const { payout, fee } = feeBreakdown(amountCents);

  return (
    <div className="space-y-3">
      {error && <Banner tone="scarlet">{error}</Banner>}
      {confirming ? (
        <>
          <Banner tone="scarlet">
            Confirming releases {money(payout)} to them and closes the task. Only confirm once the
            work is actually done.
          </Banner>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1" onClick={() => setConfirming(false)}>
              Not yet
            </button>
            <button
              className="btn btn-primary flex-1"
              disabled={busy}
              onClick={() => call(`/api/tasks/${taskId}/complete`)}
            >
              {busy ? "Releasing…" : "Release payment"}
            </button>
          </div>
        </>
      ) : (
        <>
          <button className="btn btn-primary w-full" onClick={() => setConfirming(true)}>
            Confirm completion · {money(amountCents)}
          </button>
          <p className="faint text-center text-[12px]">
            They receive {money(payout)} · Sidekick fee {money(fee)}
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ReviewForm({ taskId, subjectName }: { taskId: string; subjectName: string }) {
  const { call, busy, error } = useAction();
  const [stars, setStars] = useState(0);
  const [body, setBody] = useState("");
  const [again, setAgain] = useState<boolean | null>(null);

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-[14px] font-semibold">Rate your experience with {subjectName}</p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onClick={() => setStars(n)}
              className="transition-transform active:scale-90"
            >
              <svg width="32" height="32" viewBox="0 0 20 20" fill={n <= stars ? "#f5a524" : "var(--line-strong)"}>
                <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9z" />
              </svg>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[14px] font-semibold">Would you work with them again?</p>
        <div className="flex gap-2">
          <button
            type="button"
            className={`chip ${again === true ? "chip-active" : ""}`}
            onClick={() => setAgain(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`chip ${again === false ? "chip-active" : ""}`}
            onClick={() => setAgain(false)}
          >
            No
          </button>
        </div>
      </div>

      <textarea
        className="field resize-none text-[15px]"
        rows={3}
        maxLength={500}
        placeholder="Optional — what should other people know?"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />

      {error && <Banner tone="scarlet">{error}</Banner>}

      <button
        className="btn btn-primary w-full"
        disabled={busy || stars === 0 || again === null}
        onClick={() => call(`/api/tasks/${taskId}/review`, { stars, body, wouldAgain: again })}
      >
        {busy ? "Posting…" : "Post review"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */

export function ReportButton({
  targetType,
  targetId,
  canBlock,
}: {
  targetType: "user" | "task";
  targetId: string;
  canBlock: boolean;
}) {
  const { call, busy, error } = useAction();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [detail, setDetail] = useState("");
  const [block, setBlock] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="faint py-3 text-center text-[13px]">Reported. Our team will review it.</p>;
  }

  if (!open) {
    return (
      <button className="faint w-full py-3 text-center text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>
        Report {targetType === "task" ? "this task" : "this person"}
      </button>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-[14px] font-semibold">What's wrong?</p>
      <div className="flex flex-wrap gap-2">
        {REPORT_REASONS.map((r) => (
          <button key={r} type="button" className={`chip ${reason === r ? "chip-active" : ""}`} onClick={() => setReason(r)}>
            {r}
          </button>
        ))}
      </div>
      <textarea
        className="field resize-none text-[14px]"
        rows={2}
        placeholder="Anything else we should know?"
        value={detail}
        onChange={(e) => setDetail(e.target.value)}
      />
      {canBlock && (
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            className="h-4 w-4 accent-[var(--color-scarlet-600)]"
            checked={block}
            onChange={(e) => setBlock(e.target.checked)}
          />
          Also block them — you won't see each other again
        </label>
      )}
      {error && <Banner tone="scarlet">{error}</Banner>}
      <div className="flex gap-2">
        <button className="btn btn-ghost flex-1 py-2 text-[14px]" onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button
          className="btn btn-primary flex-1 py-2 text-[14px]"
          disabled={busy}
          onClick={async () => {
            const ok = await call("/api/report", { targetType, targetId, reason, detail, block });
            if (ok) setDone(true);
          }}
        >
          Submit report
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Owner controls                                                      */
/* ------------------------------------------------------------------ */

/** Cancelling tells everyone who applied, so nobody keeps waiting on it. */
export function TaskOwnerActions({
  taskId,
  status,
  offerCount,
}: {
  taskId: string;
  status: string;
  offerCount: number;
}) {
  const router = useRouter();
  const { call, busy, error } = useAction();
  const [confirming, setConfirming] = useState(false);

  if (status === "completed" || status === "cancelled") return null;

  return (
    <div className="space-y-2.5">
      {error && <Banner tone="scarlet">{error}</Banner>}
      {status === "open" && (
        <Link href={`/tasks/${taskId}/edit`} className="btn btn-ghost w-full py-2.5 text-[14px]">
          Edit this task
        </Link>
      )}
      {confirming ? (
        <>
          <Banner tone="warn">
            {offerCount > 0
              ? `${offerCount} ${offerCount === 1 ? "person has" : "people have"} applied. They'll be told it's cancelled.`
              : "This takes the task down. You can always post it again."}
          </Banner>
          <div className="flex gap-2">
            <button className="btn btn-ghost flex-1 py-2.5 text-[14px]" onClick={() => setConfirming(false)}>
              Keep it up
            </button>
            <button
              className="btn btn-primary flex-1 py-2.5 text-[14px]"
              disabled={busy}
              onClick={async () => {
                const ok = await call(`/api/tasks/${taskId}/cancel`);
                if (ok) router.push("/me");
              }}
            >
              {busy ? "Cancelling…" : "Cancel task"}
            </button>
          </div>
        </>
      ) : (
        <button
          className="faint w-full py-3 text-center text-[13px] underline underline-offset-4"
          onClick={() => setConfirming(true)}
        >
          Cancel this task
        </button>
      )}
    </div>
  );
}

/** Pulling your own offer back before the poster has decided. */
export function WithdrawOffer({ offerId }: { offerId: string }) {
  const { call, busy, error } = useAction();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-3">
      {error && <Banner tone="scarlet">{error}</Banner>}
      {confirming ? (
        <div className="flex gap-2">
          <button className="btn btn-ghost flex-1 py-2 text-[13px]" onClick={() => setConfirming(false)}>
            Keep it
          </button>
          <button
            className="btn btn-primary flex-1 py-2 text-[13px]"
            disabled={busy}
            onClick={() => call(`/api/offers/${offerId}/withdraw`)}
          >
            {busy ? "Withdrawing…" : "Withdraw offer"}
          </button>
        </div>
      ) : (
        <button className="faint w-full text-center text-[12px] underline underline-offset-4" onClick={() => setConfirming(true)}>
          Withdraw my offer
        </button>
      )}
    </div>
  );
}

/** Saving a task you want but can't take this minute. */
export function SaveButton({ taskId, initial }: { taskId: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);

  return (
    <button
      className="flex h-8 w-8 items-center justify-center rounded-lg border transition-colors hairline"
      style={{ color: saved ? "var(--color-scarlet-600)" : "var(--ink-3)" }}
      aria-label={saved ? "Remove from saved" : "Save this task"}
      aria-pressed={saved}
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        // Flip immediately; the request only confirms it.
        setSaved((v) => !v);
        try {
          const res = await fetch(`/api/tasks/${taskId}/save`, { method: "POST" });
          const data = await res.json();
          if (typeof data.saved === "boolean") setSaved(data.saved);
        } catch {
          setSaved(initial);
        } finally {
          setBusy(false);
        }
      }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z" />
      </svg>
    </button>
  );
}
