"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Device location.
 *
 * Distances were measured from the place someone picked at signup, which is
 * wrong the moment they leave it — the Nearby feed would rank a task by where
 * they sleep rather than where they are.
 *
 * The coordinate is kept in this browser and sent only as a query parameter to
 * rank the feed. It is never stored: a precise, logged history of where
 * students are is a liability with no product upside.
 */

type Coords = { lat: number; lng: number };
export type LocationState = {
  coords: Coords | null;
  status: "idle" | "asking" | "ready" | "denied" | "unavailable";
  request: () => void;
  clear: () => void;
};

const KEY = "sk_use_location";

type CapacitorGeolocation = {
  requestPermissions: () => Promise<{ location: string }>;
  getCurrentPosition: (options?: Record<string, unknown>) => Promise<{
    coords: { latitude: number; longitude: number };
  }>;
};

function nativeGeolocation(): CapacitorGeolocation | null {
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Geolocation?: CapacitorGeolocation } };
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Geolocation ?? null;
}

export function useDeviceLocation(): LocationState {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<LocationState["status"]>("idle");

  const request = useCallback(() => {
    setStatus("asking");

    const native = nativeGeolocation();
    if (native) {
      native
        .requestPermissions()
        .then((permission) => {
          if (permission.location === "denied") {
            setStatus("denied");
            return;
          }
          return native.getCurrentPosition({ enableHighAccuracy: true }).then((position) => {
            setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
            setStatus("ready");
            try {
              localStorage.setItem(KEY, "1");
            } catch {
              // Not remembering the choice is survivable.
            }
          });
        })
        .catch(() => setStatus("unavailable"));
      return;
    }

    if (!("geolocation" in navigator)) {
      setStatus("unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
        setStatus("ready");
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          // As above.
        }
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "unavailable"),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setCoords(null);
    setStatus("idle");
    try {
      localStorage.removeItem(KEY);
    } catch {
      // As above.
    }
  }, []);

  // Someone who already opted in shouldn't be asked again every visit.
  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === "1") request();
    } catch {
      // No stored preference available; wait for an explicit tap.
    }
  }, [request]);

  return { coords, status, request, clear };
}
