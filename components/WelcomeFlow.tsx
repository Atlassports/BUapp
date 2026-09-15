"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PLACES } from "@/lib/geo";
import { SKILL_SUGGESTIONS, TRANSPORT, type TransportId } from "@/lib/taxonomy";

type Step = "email" | "code" | "profile";

export function WelcomeFlow({ domain }: { domain: string }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState("");
  const [classYear, setClassYear] = useState("");
  const [homePlace, setHomePlace] = useState(PLACES[0].id);
  const [transport, setTransport] = useState<TransportId[]>(["walk"]);
  const [skills, setSkills] = useState<string[]>([]);
  const [bio, setBio] = useState("");

  async function post(url: string, payload: unknown) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        return null;
      }
      return data;
    } catch {
      setError("Network trouble. Try again.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    const data = await post("/api/auth/request-code", { email });
    if (data) {
      setEmail(data.email);
      setStep("code");
    }
  }

  async function submitCode(value: string) {
    const data = await post("/api/auth/verify", { email, code: value });
    if (!data) {
      setCode("");
      return;
    }
    if (data.status === "signed_in") router.replace("/feed");
    else setStep("profile");
  }

  async function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    const data = await post("/api/auth/profile", { name, classYear, homePlace, transport, skills, bio });
    if (data) router.replace("/feed");
  }

  function toggle<T>(list: T[], value: T, setter: (v: T[]) => void) {
    setter(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-6 pb-12 pt-10">
      <Header step={step} />

      {error && (
        <p className="mb-4 rounded-xl border border-scarlet-600/25 bg-scarlet-600/8 px-3.5 py-2.5 text-[13px] text-scarlet-700 dark:text-scarlet-400">
          {error}
        </p>
      )}

      {step === "email" && (
        <form onSubmit={submitEmail} className="animate-rise">
          <label className="mb-2 block text-sm font-semibold">Your BU email</label>
          <input
            className="field"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            placeholder={`name@${domain}`}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <p className="faint mt-2 text-[12px] leading-relaxed">
            We verify every account against a real @{domain} inbox. That verification is the
            whole reason this is safer than Facebook Marketplace.
          </p>
          <button className="btn btn-primary mt-5 w-full" disabled={busy || email.length < 5}>
            {busy ? "Sending…" : "Send verification code"}
          </button>
        </form>
      )}

      {step === "code" && (
        <div className="animate-rise">
          <label className="mb-1 block text-sm font-semibold">Enter the 6-digit code</label>
          <p className="muted mb-4 text-[13px]">
            Sent to <span className="font-medium text-[var(--ink)]">{email}</span>
          </p>
          <CodeInput
            value={code}
            onChange={setCode}
            onComplete={submitCode}
            disabled={busy}
          />
          <div className="mt-5 flex items-center justify-between text-[13px]">
            <button
              type="button"
              className="muted underline underline-offset-4"
              onClick={() => {
                setStep("email");
                setCode("");
              }}
            >
              Change email
            </button>
            <button
              type="button"
              className="font-semibold text-scarlet-600 dark:text-scarlet-400"
              disabled={busy}
              onClick={() => post("/api/auth/request-code", { email })}
            >
              Resend code
            </button>
          </div>
        </div>
      )}

      {step === "profile" && (
        <form onSubmit={submitProfile} className="animate-rise space-y-6">
          <div>
            <label className="mb-2 block text-sm font-semibold">Your name</label>
            <input
              className="field"
              autoFocus
              placeholder="Michael C."
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <p className="faint mt-1.5 text-[12px]">
              First name and last initial is plenty. Everyone here is already verified.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Class year</label>
            <div className="rail">
              {["2026", "2027", "2028", "2029", "Grad", "Faculty/Staff"].map((y) => (
                <button
                  key={y}
                  type="button"
                  className={`chip ${classYear === y ? "chip-active" : ""}`}
                  onClick={() => setClassYear(y)}
                >
                  {y}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Where do you spend most time?</label>
            <select className="field" value={homePlace} onChange={(e) => setHomePlace(e.target.value)}>
              {PLACES.filter((p) => p.id !== "remote").map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="faint mt-1.5 text-[12px]">
              Distances in your feed are measured from here.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">How do you get around?</label>
            <p className="faint mb-2.5 text-[12px]">
              This decides which tasks you see. Walking-only students never get shown a couch in
              Medford.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {TRANSPORT.map((t) => {
                const on = transport.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggle(transport, t.id, setTransport)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${
                      on
                        ? "border-scarlet-600 bg-scarlet-600/8 text-scarlet-700 dark:text-scarlet-400"
                        : "hairline border surface"
                    }`}
                  >
                    <span className="text-base">{t.emoji}</span>
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-semibold">What are you good at?</label>
            <p className="faint mb-2.5 text-[12px]">Optional. Used to match you with better-paying work.</p>
            <div className="flex flex-wrap gap-2">
              {SKILL_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`chip ${skills.includes(s) ? "chip-active" : ""}`}
                  onClick={() => toggle(skills, s, setSkills)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold">Short bio</label>
            <textarea
              className="field resize-none"
              rows={3}
              maxLength={240}
              placeholder="CAS '27. Usually around West Campus. Have a car on weekends."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
            />
          </div>

          <button className="btn btn-primary w-full" disabled={busy || name.trim().length < 2 || !transport.length}>
            {busy ? "Creating…" : "Create my account"}
          </button>
        </form>
      )}
    </div>
  );
}

function Header({ step }: { step: Step }) {
  const copy = {
    email: { title: "Sidekick", sub: "A verified BU-only marketplace for anything you need done." },
    code: { title: "Check your inbox", sub: "Codes expire after 10 minutes." },
    profile: { title: "Set up your profile", sub: "Takes about 30 seconds. You can change all of it later." },
  }[step];

  return (
    <header className="mb-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-scarlet-600 text-lg font-black text-white">
          S
        </span>
        <span className="chip">BU · Charles River</span>
      </div>
      <h1 className="text-[27px] font-bold tracking-tight">{copy.title}</h1>
      <p className="muted mt-1.5 text-[14px] leading-relaxed">{copy.sub}</p>
    </header>
  );
}

function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete: (v: string) => void;
  disabled: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        className="absolute inset-0 h-full w-full opacity-0"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => {
          const next = e.target.value.replace(/\D/g, "").slice(0, 6);
          onChange(next);
          if (next.length === 6) onComplete(next);
        }}
      />
      <div className="pointer-events-none flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className={`flex h-14 flex-1 items-center justify-center rounded-xl border text-xl font-bold tabular-nums transition-colors ${
              i === value.length
                ? "border-scarlet-600 bg-[var(--surface)]"
                : "hairline border bg-[var(--surface)]"
            }`}
          >
            {value[i] ?? ""}
          </span>
        ))}
      </div>
    </div>
  );
}
