"use client";

import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ActionButton, Sheet } from "./Sheet";
import { Banner } from "./ui";
import { money } from "@/lib/format";

/**
 * Card entry inside the app — no browser redirect.
 *
 * Stripe's Payment Element renders in an iframe it controls, so card numbers
 * go straight to Stripe and never touch this server. That is what keeps the
 * app out of full PCI scope while still looking and feeling native.
 */

let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(key: string) {
  stripePromise ??= loadStripe(key);
  return stripePromise;
}

export function FundTaskButton({
  taskId,
  amountCents,
  publishableKey,
  taskerName,
}: {
  taskId: string;
  amountCents: number;
  publishableKey: string | null;
  taskerName: string;
}) {
  const [open, setOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't start that payment.");
        return;
      }
      setClientSecret(data.clientSecret);
      setOpen(true);
    } catch {
      setError("Network trouble. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (!publishableKey) {
    return (
      <Banner>
        Payments aren't switched on yet, so nothing is charged. The flow below is
        what will happen once Stripe keys are configured.
      </Banner>
    );
  }

  return (
    <div className="space-y-2.5">
      {error && <Banner tone="scarlet">{error}</Banner>}
      <ActionButton busy={busy} onClick={start}>
        Fund this task · {money(amountCents)}
      </ActionButton>
      <p className="faint text-center text-[12px] leading-relaxed">
        {taskerName} doesn't get paid until you confirm the work is done.
      </p>

      <Sheet open={open && !!clientSecret} onClose={() => setOpen(false)} title={`Pay ${money(amountCents)}`}>
        {clientSecret && (
          <Elements
            stripe={getStripe(publishableKey)}
            options={{
              clientSecret,
              appearance: {
                theme: "flat",
                variables: {
                  colorPrimary: "#cc0000",
                  borderRadius: "12px",
                  fontFamily: "-apple-system, 'Segoe UI', sans-serif",
                },
              },
            }}
          >
            <CardForm amountCents={amountCents} taskerName={taskerName} onDone={() => setOpen(false)} />
          </Elements>
        )}
      </Sheet>
    </div>
  );
}

function CardForm({
  amountCents,
  taskerName,
  onDone,
}: {
  amountCents: number;
  taskerName: string;
  onDone: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pay() {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    // redirect: "if_required" keeps the flow in the app for cards, and only
    // leaves for methods that genuinely require it, like a bank redirect.
    const result = await stripe.confirmPayment({ elements, redirect: "if_required" });

    if (result.error) {
      setError(result.error.message ?? "That card was declined.");
      setBusy(false);
      return;
    }

    onDone();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Banner>
        {money(amountCents)} is charged now and held. It goes to {taskerName} when you confirm the
        work is done — and back to you if it isn't.
      </Banner>

      <PaymentElement options={{ layout: "tabs" }} />

      {error && <Banner tone="scarlet">{error}</Banner>}

      <ActionButton busy={busy} disabled={!stripe} onClick={pay}>
        Pay {money(amountCents)}
      </ActionButton>
      <p className="faint text-center text-[11px] leading-relaxed">
        Card details go straight to Stripe. Sidekick never sees or stores them.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Taskers must onboard with Stripe before money can reach their bank. */
export function PayoutSetup({ enabled, hasAccount }: { enabled: boolean; hasAccount: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coming back from Stripe's hosted onboarding, re-check the real status.
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("payouts")) return;
    void fetch("/api/payments/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh: true }),
    }).then(() => window.location.replace("/settings"));
  }, []);

  async function begin() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't reach Stripe.");
        return;
      }
      window.location.assign(data.url);
    } finally {
      setBusy(false);
    }
  }

  if (enabled) {
    return (
      <div className="card p-4">
        <p className="text-[14px] font-semibold text-emerald-600 dark:text-emerald-400">✓ Payouts are set up</p>
        <p className="faint mt-1 text-[12px] leading-relaxed">
          Money from completed tasks goes to your bank automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4">
      <p className="text-[14px] font-semibold">Set up payouts</p>
      <p className="faint mt-1 text-[12px] leading-relaxed">
        Before you can be paid, Stripe needs to verify who you are — your legal name, date of
        birth, the last four of your SSN, and a bank account. Sidekick never sees any of it.
      </p>
      {error && <p className="mt-2 text-[12px] text-scarlet-600 dark:text-scarlet-400">{error}</p>}
      <ActionButton busy={busy} className="btn btn-primary mt-3 w-full py-2.5 text-[14px]" onClick={begin}>
        {hasAccount ? "Finish payout setup" : "Set up payouts"}
      </ActionButton>
    </div>
  );
}

/** Either side can freeze a held payment before it auto-releases. */
export function DisputeButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <Banner tone="warn">
        The payment is frozen and we've been sent the details. Nothing moves until it's reviewed.
      </Banner>
    );
  }

  return (
    <>
      <button className="faint w-full py-3 text-center text-[13px] underline underline-offset-4" onClick={() => setOpen(true)}>
        Something went wrong with this task
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Report a problem">
        <Banner tone="warn">
          This freezes the payment so it can't be released while we look at it. Use it if the work
          wasn't done, wasn't what was agreed, or something felt wrong.
        </Banner>
        <textarea
          className="field mt-4 resize-none"
          rows={4}
          maxLength={1000}
          placeholder="What happened?"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <ActionButton
          busy={busy}
          disabled={reason.trim().length < 10}
          className="btn btn-primary mt-4 w-full"
          onClick={async () => {
            setBusy(true);
            await fetch("/api/payments/dispute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ taskId, reason }),
            });
            setBusy(false);
            setDone(true);
            setOpen(false);
            router.refresh();
          }}
        >
          Freeze the payment and report
        </ActionButton>
      </Sheet>
    </>
  );
}
