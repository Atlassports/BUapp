"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionButton, Sheet } from "./Sheet";
import { Banner } from "./ui";
import { ORG_CATEGORIES } from "@/lib/org-constants";

const EMOJI = ["🎓", "🎭", "🎬", "🎤", "🎨", "📰", "⚽", "🏀", "🏒", "🥍", "🤝", "🌍", "💼", "🔬", "🎮", "🍜", "♻️", "🕊️"];

export function CreateOrgButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [blurb, setBlurb] = useState("");
  const [emoji, setEmoji] = useState("🎓");
  const [category, setCategory] = useState(ORG_CATEGORIES[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/orgs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, blurb, emoji, category }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't create that.");
        return;
      }
      setOpen(false);
      router.push(`/orgs/${data.slug}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button className="btn btn-primary w-full" onClick={() => setOpen(true)}>
        Register a club
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Register a club">
        <Banner>
          Your BU verification carries over, so the club is verified from the start. You'll be its
          owner and can add other people who are allowed to post on its behalf.
        </Banner>

        <label className="mt-5 block text-[14px] font-semibold">Club name</label>
        <input className="field mt-2" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="BU Finance Association" />

        <label className="mt-5 block text-[14px] font-semibold">Icon</label>
        <div className="mt-2 flex flex-wrap gap-2">
          {EMOJI.map((e) => (
            <button key={e} type="button" className={`chip text-base ${emoji === e ? "chip-active" : ""}`} onClick={() => setEmoji(e)}>
              {e}
            </button>
          ))}
        </div>

        <label className="mt-5 block text-[14px] font-semibold">Type</label>
        <select className="field mt-2" value={category} onChange={(e) => setCategory(e.target.value)}>
          {ORG_CATEGORIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>

        <label className="mt-5 block text-[14px] font-semibold">What the club does</label>
        <textarea
          className="field mt-2 resize-none"
          rows={3}
          maxLength={300}
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="We run speaker events and a spring showcase. Usually need photographers and help at the door."
        />

        {error && (
          <div className="mt-4">
            <Banner tone="scarlet">{error}</Banner>
          </div>
        )}

        <ActionButton busy={busy} disabled={name.trim().length < 3} className="btn btn-primary mt-5 w-full" onClick={create}>
          Create club
        </ActionButton>
      </Sheet>
    </>
  );
}

export function OrgMembership({ slug, joined, role }: { slug: string; joined: boolean; role: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function act(path: "join" | "leave") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/orgs/${slug}/${path}`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't do that.");
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ActionButton
        busy={busy}
        className={joined ? "btn btn-ghost w-full py-2.5 text-[14px]" : "btn btn-primary w-full py-2.5 text-[14px]"}
        onClick={() => act(joined ? "leave" : "join")}
      >
        {joined ? (role === "owner" ? "Leave (owner)" : "Leave club") : "Join club"}
      </ActionButton>
      {error && <p className="mt-2 text-[12px] text-scarlet-600 dark:text-scarlet-400">{error}</p>}
      {!joined && (
        <p className="faint mt-2 text-center text-[12px]">
          Members see club postings first. Owners and admins can post on its behalf.
        </p>
      )}
    </div>
  );
}
