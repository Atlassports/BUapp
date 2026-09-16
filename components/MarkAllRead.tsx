"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAllRead() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="chip"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch("/api/notifications/read", { method: "POST" });
        router.refresh();
        setBusy(false);
      }}
    >
      Mark all read
    </button>
  );
}
