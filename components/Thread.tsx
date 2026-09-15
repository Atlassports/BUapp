"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clockTime } from "@/lib/format";
import type { Message } from "@/lib/types";

const QUICK = [
  "Are you available now?",
  "Where should we meet?",
  "How long will this take?",
  "On my way.",
];

export function Thread({
  offerId,
  messages,
  meId,
}: {
  offerId: string;
  messages: Message[];
  meId: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(text: string) {
    const value = text.trim();
    if (!value || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/threads/${offerId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: value }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't send that.");
        return;
      }
      setBody("");
      router.refresh();
    } catch {
      setError("Network trouble. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="space-y-2 px-4 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === meId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                  mine ? "bg-scarlet-600 text-white" : "surface border"
                }`}
                style={mine ? undefined : { borderRadius: "1rem" }}
              >
                <p className="whitespace-pre-wrap">{m.body}</p>
                <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "faint"}`}>
                  {clockTime(m.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <div
        className="sticky bottom-0 border-t backdrop-blur-xl hairline"
        style={{
          background: "color-mix(in srgb, var(--bg) 92%, transparent)",
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom, 0px))",
        }}
      >
        {error && <p className="px-4 pt-2 text-[12px] text-scarlet-600 dark:text-scarlet-400">{error}</p>}
        <div className="rail px-4 pt-2.5">
          {QUICK.map((q) => (
            <button key={q} className="chip" onClick={() => send(q)} disabled={busy}>
              {q}
            </button>
          ))}
        </div>
        <form
          className="flex items-end gap-2 px-4 pt-2.5"
          onSubmit={(e) => {
            e.preventDefault();
            send(body);
          }}
        >
          <textarea
            className="field max-h-28 resize-none py-2.5 text-[15px]"
            rows={1}
            placeholder="Message…"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(body);
              }
            }}
          />
          <button
            className="btn btn-primary shrink-0 px-4 py-2.5"
            disabled={busy || !body.trim()}
            aria-label="Send"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12h15M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
      </div>
    </>
  );
}
