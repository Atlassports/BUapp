"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton } from "./Sheet";
import { SkillPicker } from "./SkillPicker";
import { Banner } from "./ui";
import { classYearOptions } from "@/lib/academics";
import { PLACES } from "@/lib/geo";
import { TRANSPORT, type TransportId } from "@/lib/taxonomy";

export function ProfileEditor({
  initial,
}: {
  initial: {
    name: string;
    bio: string;
    classYear: string;
    homePlace: string;
    transport: TransportId[];
    skills: string[];
  };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [classYear, setClassYear] = useState(initial.classYear);
  const [homePlace, setHomePlace] = useState(initial.homePlace);
  const [transport, setTransport] = useState<TransportId[]>(initial.transport);
  const [skills, setSkills] = useState<string[]>(initial.skills);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const dirty =
    name !== initial.name ||
    bio !== initial.bio ||
    classYear !== initial.classYear ||
    homePlace !== initial.homePlace ||
    transport.join() !== initial.transport.join() ||
    skills.join() !== initial.skills.join();

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio, classYear, homePlace, transport, skills }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't save that.");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Network trouble. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-7 px-4 pb-28">
      <Field label="Name">
        <input className="field" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
      </Field>

      <Field label="Bio" hint="One or two lines. People read this before they accept your offer.">
        <textarea
          className="field resize-none"
          rows={3}
          maxLength={240}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
        />
        <p className="faint mt-1 text-right text-[11px]">{bio.length}/240</p>
      </Field>

      <Field label="Class year">
        <div className="flex flex-wrap gap-2">
          {classYearOptions().map((y) => (
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
      </Field>

      <Field label="Where you spend most time" hint="Distances in your feed are measured from here.">
        <select className="field" value={homePlace} onChange={(e) => setHomePlace(e.target.value)}>
          {PLACES.filter((p) => p.id !== "remote").map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </Field>

      <Field
        label="How you get around"
        hint="This decides which tasks you're shown. Change it when you get a car for the weekend."
      >
        <div className="grid grid-cols-2 gap-2">
          {TRANSPORT.map((t) => {
            const on = transport.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setTransport(on ? transport.filter((x) => x !== t.id) : [...transport, t.id])
                }
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
      </Field>

      <Field label="Skills" hint="Used to surface better-paying work that actually fits you.">
        <SkillPicker selected={skills} onChange={setSkills} />
      </Field>

      {error && <Banner tone="scarlet">{error}</Banner>}

      <div
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-lg border-t px-4 pt-3 backdrop-blur-xl hairline"
        style={{
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px) + 4.5rem)",
        }}
      >
        <ActionButton busy={busy} disabled={!dirty || name.trim().length < 2 || !transport.length} onClick={save}>
          {saved ? "Saved" : dirty ? "Save changes" : "No changes"}
        </ActionButton>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[15px] font-semibold">{label}</label>
      {hint && <p className="faint mb-2 mt-0.5 text-[12px] leading-relaxed">{hint}</p>}
      <div className={hint ? "" : "mt-2"}>{children}</div>
    </div>
  );
}
