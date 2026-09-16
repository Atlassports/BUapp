"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const WINDOWS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 240, label: "4 hours" },
];

export function AvailabilityToggle({ availableUntil }: { availableUntil: number | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const active = availableUntil !== null && availableUntil > Date.now();

  async function set(minutes: number) {
    setBusy(true);
    await fetch("/api/me/availability", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ minutes }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[15px] font-semibold">
            {active ? "You're available now" : "Mark yourself available"}
          </p>
          <p className="faint mt-0.5 text-[12px]">
            {active
              ? `Until ${new Date(availableUntil!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
              : "Posters see you first when you're free"}
          </p>
        </div>
        <span
          className={`h-2.5 w-2.5 rounded-full ${active ? "bg-emerald-500" : "bg-[var(--line-strong)]"}`}
          aria-hidden
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {WINDOWS.map((w) => (
          <button key={w.minutes} className="chip" disabled={busy} onClick={() => set(w.minutes)}>
            {active ? `Extend ${w.label}` : `Free for ${w.label}`}
          </button>
        ))}
        {active && (
          <button className="chip" disabled={busy} onClick={() => set(0)}>
            Go offline
          </button>
        )}
      </div>
    </div>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      className="faint w-full py-4 text-center text-[13px] underline underline-offset-4"
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        router.replace("/welcome");
        router.refresh();
      }}
    >
      Sign out
    </button>
  );
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<string>(() =>
    typeof document !== "undefined" ? document.documentElement.dataset.theme ?? "system" : "system",
  );

  function apply(next: string) {
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sk_theme", next);
    } catch {
      // Private browsing blocks storage; the choice just won't persist.
    }
  }

  return (
    <div className="flex gap-2">
      {["system", "light", "dark"].map((t) => (
        <button key={t} className={`chip capitalize ${theme === t ? "chip-active" : ""}`} onClick={() => apply(t)}>
          {t}
        </button>
      ))}
    </div>
  );
}
