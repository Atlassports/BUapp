"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ActionButton, Sheet } from "./Sheet";
import { Banner } from "./ui";

type Prefs = { offers: boolean; messages: boolean; nearby: boolean };

export function SettingsPanel({
  email,
  initial,
  vapidKey,
  nativePushReady,
}: {
  email: string;
  initial: Prefs;
  vapidKey: string | null;
  nativePushReady: boolean;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(initial);
  const [theme, setTheme] = useState("system");
  const [pushState, setPushState] = useState<"unsupported" | "off" | "on" | "blocked">("unsupported");
  const [pushBusy, setPushBusy] = useState(false);
  const [installed, setInstalled] = useState(true);

  useEffect(() => {
    try {
      setTheme(localStorage.getItem("sk_theme") ?? "system");
    } catch {
      // Private browsing; the toggle still works for this session.
    }
    // iOS only offers notifications to a Home Screen install.
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    setInstalled(standalone || !/iPhone|iPad|iPod/.test(navigator.userAgent));

    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;
    if (Notification.permission === "denied") return setPushState("blocked");
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setPushState(sub ? "on" : "off");
    });
  }, []);

  function applyTheme(next: string) {
    setTheme(next);
    if (next === "system") delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("sk_theme", next);
    } catch {
      // Not persisting is acceptable; the choice still applies now.
    }
  }

  async function savePrefs(next: Prefs) {
    setPrefs(next);
    await fetch("/api/me/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    router.refresh();
  }

  async function enablePush() {
    if (!vapidKey) return;
    setPushBusy(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setPushState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
      setPushState("on");
    } catch (err) {
      console.error(err);
      setPushState("off");
    } finally {
      setPushBusy(false);
    }
  }

  async function disablePush() {
    setPushBusy(true);
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/unsubscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setPushState("off");
    } finally {
      setPushBusy(false);
    }
  }

  return (
    <div className="space-y-6 px-4 pb-10">
      <Section title="Notifications" hint="What you get told about, wherever you've turned alerts on.">
        <Toggle
          label="Offers on my tasks"
          detail="Someone applies, or your offer is accepted or declined"
          checked={prefs.offers}
          onChange={(v) => savePrefs({ ...prefs, offers: v })}
        />
        <Toggle
          label="Messages"
          detail="New messages in a conversation you're part of"
          checked={prefs.messages}
          onChange={(v) => savePrefs({ ...prefs, messages: v })}
        />
        <Toggle
          label="Nearby tasks"
          detail="Well-paid work posted close to you, at most a few times a day"
          checked={prefs.nearby}
          onChange={(v) => savePrefs({ ...prefs, nearby: v })}
        />
      </Section>

      <Section title="Push notifications" hint="Alerts that reach your phone when the app is closed.">
        {nativePushReady ? (
          <Banner tone="scarlet">
            You're in the iOS app, which handles notifications through system settings. Manage them
            in Settings → Sidekick → Notifications.
          </Banner>
        ) : !installed ? (
          <Banner tone="warn">
            iOS only allows notifications once the app is on your Home Screen. Tap Share → Add to
            Home Screen, open it from there, and this will turn on.
          </Banner>
        ) : !vapidKey ? (
          <Banner>
            Push isn't configured on the server yet. Everything still shows up in Activity.
          </Banner>
        ) : pushState === "blocked" ? (
          <Banner tone="warn">
            Notifications are blocked for this site in your browser settings. Re-allow them there
            first.
          </Banner>
        ) : (
          <div className="card p-4">
            <p className="text-[14px] font-semibold">
              {pushState === "on" ? "Push is on for this device" : "Push is off for this device"}
            </p>
            <p className="faint mt-1 text-[12px] leading-relaxed">
              {pushState === "on"
                ? "You'll get alerts even with the app closed."
                : "Turn this on so you don't have to keep checking for offers."}
            </p>
            <ActionButton
              busy={pushBusy}
              className="btn btn-ghost mt-3 w-full py-2.5 text-[14px]"
              onClick={pushState === "on" ? disablePush : enablePush}
            >
              {pushState === "on" ? "Turn off on this device" : "Turn on notifications"}
            </ActionButton>
          </div>
        )}
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {["system", "light", "dark"].map((t) => (
            <button
              key={t}
              className={`chip capitalize ${theme === t ? "chip-active" : ""}`}
              onClick={() => applyTheme(t)}
            >
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Account">
        <div className="card p-4">
          <p className="muted text-[13px] leading-relaxed">
            Verified as <span className="font-semibold text-[var(--ink)]">{email}</span>
          </p>
        </div>
        <DeleteAccount email={email} />
      </Section>
    </div>
  );
}

function DeleteAccount({ email }: { email: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't delete the account.");
        return;
      }
      router.replace("/welcome");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        className="w-full py-3 text-center text-[13px] font-medium text-scarlet-600 underline underline-offset-4 dark:text-scarlet-400"
        onClick={() => setOpen(true)}
      >
        Delete my account
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Delete account">
        <Banner tone="scarlet">
          This removes your profile, saved tasks and messages, and cancels anything you have open.
          Reviews you left on other people stay, because their reputation is partly built on them.
          It can't be undone.
        </Banner>
        <p className="mt-4 text-[13px] font-semibold">Type {email} to confirm</p>
        <input
          className="field mt-2"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={email}
          autoComplete="off"
        />
        {error && (
          <p className="mt-3 text-[13px] text-scarlet-600 dark:text-scarlet-400">{error}</p>
        )}
        <ActionButton busy={busy} disabled={confirm !== email} className="btn btn-primary mt-4 w-full" onClick={remove}>
          Permanently delete
        </ActionButton>
      </Sheet>
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[15px] font-bold">{title}</h2>
      {hint && <p className="faint mb-2.5 mt-0.5 text-[12px] leading-relaxed">{hint}</p>}
      <div className={`space-y-2 ${hint ? "" : "mt-2.5"}`}>{children}</div>
    </section>
  );
}

function Toggle({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border px-3.5 py-3 hairline">
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{label}</span>
        <span className="faint block text-[12px] leading-snug">{detail}</span>
      </span>
      <input
        type="checkbox"
        className="h-5 w-5 shrink-0 accent-[var(--color-scarlet-600)]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}

/** VAPID keys arrive base64url; the subscribe API wants raw bytes. */
function urlBase64ToUint8Array(base64: string): ArrayBuffer {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const buffer = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buffer;
}
