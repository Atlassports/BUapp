"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminAction({
  action,
  id,
  label,
  danger,
  promptFor,
}: {
  action: string;
  id: string;
  label: string;
  danger?: boolean;
  promptFor?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [asking, setAsking] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id, note }),
      });
      setAsking(false);
      setNote("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (promptFor && asking) {
    return (
      <div className="mt-2 flex gap-2">
        <input
          className="field py-1.5 text-[13px]"
          placeholder={promptFor}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
        <button className="btn btn-primary shrink-0 px-3 py-1.5 text-[13px]" disabled={busy} onClick={run}>
          {busy ? "…" : "Go"}
        </button>
        <button className="btn btn-ghost shrink-0 px-3 py-1.5 text-[13px]" onClick={() => setAsking(false)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <button
      className={`chip ${danger ? "text-scarlet-600 dark:text-scarlet-400" : ""}`}
      disabled={busy}
      onClick={() => (promptFor ? setAsking(true) : run())}
    >
      {busy ? "…" : label}
    </button>
  );
}
