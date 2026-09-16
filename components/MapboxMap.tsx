"use client";

import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import mapboxgl from "mapbox-gl";
import { useEffect, useRef, useState } from "react";
import { dueLabel, priceLabel } from "@/lib/format";
import { categoryOf } from "@/lib/taxonomy";
import type { TaskCard } from "@/lib/types";

/**
 * Real map tiles, used when a Mapbox token is configured.
 *
 * Only the price markers are ours; Mapbox draws the streets and buildings.
 * The token is public by design — it's restricted by URL in the Mapbox
 * dashboard rather than kept secret, which is why it carries the
 * NEXT_PUBLIC_ prefix.
 */
export function MapboxMap({
  token,
  tasks,
  home,
}: {
  token: string;
  tasks: TaskCard[];
  home: { lat: number; lng: number };
}) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [active, setActive] = useState<TaskCard | null>(null);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const explicit = root.dataset.theme;
    setDark(explicit === "dark" || (!explicit && window.matchMedia("(prefers-color-scheme: dark)").matches));
  }, []);

  useEffect(() => {
    if (!container.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: container.current,
      style: dark ? "mapbox://styles/mapbox/dark-v11" : "mapbox://styles/mapbox/light-v11",
      center: [home.lng, home.lat],
      zoom: 13.4,
      attributionControl: true,
      // Campus is small; letting people spin the map only disorients them.
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(
      new mapboxgl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      "top-right",
    );
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token, home.lat, home.lng, dark]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers: mapboxgl.Marker[] = [];
    const placed = tasks.filter((t) => !t.is_remote && t.lat !== null && t.lng !== null);

    for (const task of placed) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "sk-marker";
      el.textContent = task.price_type === "open" ? "$?" : `$${Math.round((task.price_max || task.price_min) / 100)}`;
      el.setAttribute("aria-label", `${task.title}, ${priceLabel(task)}`);
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setActive(task);
        map.easeTo({ center: [task.lng!, task.lat!], duration: 400, offset: [0, -60] });
      });
      markers.push(new mapboxgl.Marker({ element: el }).setLngLat([task.lng!, task.lat!]).addTo(map));
    }

    const me = document.createElement("div");
    me.className = "sk-me";
    markers.push(new mapboxgl.Marker({ element: me }).setLngLat([home.lng, home.lat]).addTo(map));

    // Frame everything, but don't zoom so far in that one task fills the screen.
    if (placed.length > 1) {
      const bounds = new mapboxgl.LngLatBounds();
      for (const t of placed) bounds.extend([t.lng!, t.lat!]);
      bounds.extend([home.lng, home.lat]);
      map.fitBounds(bounds, { padding: 56, maxZoom: 15.2, duration: 0 });
    }

    return () => markers.forEach((m) => m.remove());
  }, [tasks, home.lat, home.lng]);

  const remote = tasks.filter((t) => t.is_remote);

  return (
    <div className="px-3">
      <div className="card overflow-hidden p-0">
        <div ref={container} style={{ height: "58dvh", minHeight: 340 }} />
      </div>

      {active ? (
        <div className="card mt-3 animate-rise p-4">
          <div className="flex items-start gap-3">
            <span className="price text-[22px] text-scarlet-600 dark:text-scarlet-400">{priceLabel(active)}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold leading-snug">{active.title}</h3>
              <p className="muted mt-1 text-[12px]">
                {categoryOf(active.category).emoji} {active.place_label} ·{" "}
                {active.distance_mi !== null ? `${active.distance_mi.toFixed(1)} mi` : "Remote"} · {dueLabel(active.due_at)}
              </p>
            </div>
            <button className="faint text-lg" onClick={() => setActive(null)} aria-label="Close">
              ×
            </button>
          </div>
          <Link href={`/tasks/${active.id}`} className="btn btn-primary mt-3 w-full py-2.5 text-[14px]">
            Open task
          </Link>
        </div>
      ) : (
        <p className="muted mt-3 px-1 text-center text-[13px]">
          {tasks.length - remote.length} on the map · tap a price to see it
        </p>
      )}

      {remote.length > 0 && (
        <div className="card mt-3 p-4">
          <p className="text-[14px] font-semibold">💻 {remote.length} remote {remote.length === 1 ? "task" : "tasks"}</p>
          <p className="faint mt-0.5 text-[12px]">Not on the map because location doesn't matter for them.</p>
          <div className="mt-2.5 space-y-1.5">
            {remote.slice(0, 4).map((t) => (
              <Link key={t.id} href={`/tasks/${t.id}`} prefetch={false} className="flex items-center gap-2 text-[13px]">
                <span className="price text-scarlet-600 dark:text-scarlet-400">{priceLabel(t)}</span>
                <span className="truncate">{t.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
