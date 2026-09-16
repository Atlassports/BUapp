"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useDeviceLocation } from "./useDeviceLocation";

/**
 * Ranks the feed from where the person actually is, rather than the campus
 * spot they chose at signup.
 */
export function NearMeToggle({ basePath = "/feed" }: { basePath?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const { coords, status, request, clear } = useDeviceLocation();
  const active = params.has("lat");

  useEffect(() => {
    if (!coords) return;
    const sp = new URLSearchParams(params.toString());
    sp.set("lat", coords.lat.toFixed(5));
    sp.set("lng", coords.lng.toFixed(5));
    router.replace(`${basePath}?${sp.toString()}`, { scroll: false });
  }, [coords, basePath, router, params]);

  function off() {
    clear();
    const sp = new URLSearchParams(params.toString());
    sp.delete("lat");
    sp.delete("lng");
    router.replace(`${basePath}?${sp.toString()}`, { scroll: false });
  }

  if (status === "denied") {
    return (
      <span className="chip" title="Re-allow location in your device settings">
        📍 Location off
      </span>
    );
  }

  return (
    <button
      className={`chip ${active ? "chip-active" : ""}`}
      onClick={active ? off : request}
      disabled={status === "asking"}
    >
      {status === "asking" ? "Locating…" : active ? "📍 Near me · on" : "📍 Near me"}
    </button>
  );
}
