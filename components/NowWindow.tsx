"use client";

import { useRouter, useSearchParams } from "next/navigation";

const WINDOWS = [
  { id: "60", label: "1 hour" },
  { id: "120", label: "2 hours" },
  { id: "180", label: "3 hours" },
  { id: "360", label: "All evening" },
];

export function NowWindow({ current }: { current: number }) {
  const router = useRouter();
  const params = useSearchParams();

  return (
    <div className="rail px-4">
      {WINDOWS.map((w) => {
        const active = String(current) === w.id;
        return (
          <button
            key={w.id}
            onClick={() => {
              const sp = new URLSearchParams(params.toString());
              sp.set("mins", w.id);
              router.replace(`/now?${sp.toString()}`, { scroll: false });
            }}
            className={`chip ${active ? "chip-active" : ""}`}
          >
            {w.label}
          </button>
        );
      })}
    </div>
  );
}
