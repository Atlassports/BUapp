"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);

  return (
    <form
      className="flex-1"
      onSubmit={(e) => {
        e.preventDefault();
        router.replace(`/search?q=${encodeURIComponent(value)}`, { scroll: false });
      }}
    >
      <input
        className="field text-[15px]"
        autoFocus
        placeholder="CH203, video editing, Warren…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
