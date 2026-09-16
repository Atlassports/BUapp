"use client";

import Link from "next/link";
import { useState } from "react";
import { PLACES } from "@/lib/geo";
import { money, priceLabel, dueLabel } from "@/lib/format";
import { categoryOf } from "@/lib/taxonomy";
import type { TaskCard } from "@/lib/types";

/**
 * A drawn campus map rather than tiles from a provider.
 *
 * BU is a two-mile ribbon along one avenue, so the useful information is
 * "which end of campus, how far" — not street geometry. Drawing it keeps the
 * page free of API keys, usage billing and an external dependency on a screen
 * students open constantly, and it works with no network at all.
 */

// Tight to where tasks actually are. BU is a ribbon along one avenue, so a
// generous box just leaves dead space and squeezes every pin onto one line.
const BOUNDS = { west: -71.136, east: -71.074, south: 42.338, north: 42.360 };
const W = 1000;
const H = 760;

function project(lat: number, lng: number) {
  const x = ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * W;
  const y = H - ((lat - BOUNDS.south) / (BOUNDS.north - BOUNDS.south)) * H;
  return { x: Math.max(18, Math.min(W - 18, x)), y: Math.max(18, Math.min(H - 18, y)) };
}

/**
 * Only the landmarks people navigate by. The dense middle of campus has a
 * dozen buildings within a block, and labelling them all turns the map into
 * overlapping grey text instead of orientation.
 */
const LANDMARKS: Array<[string, string]> = [
  ["allston-pratt", "Allston"],
  ["stuvi", "StuVi"],
  ["agganis", "Agganis"],
  ["west", "West Campus"],
  ["gsu", "GSU"],
  ["warren", "Warren"],
  ["questrom", "Questrom"],
  ["south", "South Campus"],
  ["fenway", "Fenway"],
];

export function CampusMap({ tasks, home }: { tasks: TaskCard[]; home: { lat: number; lng: number } }) {
  const [active, setActive] = useState<TaskCard | null>(null);

  const placed = tasks
    .filter((t) => !t.is_remote && t.lat !== null && t.lng !== null)
    .map((t) => ({ task: t, ...project(t.lat!, t.lng!) }));

  // Campus is linear, so pins naturally stack on top of each other along the
  // avenue. Push each colliding pin vertically — alternating above and below —
  // until it has room, which keeps every one tappable and still near its
  // true location.
  placed.sort((a, b) => a.x - b.x);
  const settled: Array<{ x: number; y: number }> = [];
  const MIN_X = 76;
  const MIN_Y = 34;
  for (const pin of placed) {
    const baseY = pin.y;
    for (let step = 0; step < 24; step++) {
      // 0, +1, -1, +2, -2 … so pins fan out evenly around the street.
      const direction = step === 0 ? 0 : (step % 2 === 1 ? 1 : -1) * Math.ceil(step / 2);
      const candidate = baseY + direction * MIN_Y;
      if (candidate < 40 || candidate > H - 40) continue;
      const clash = settled.some(
        (s) => Math.abs(s.x - pin.x) < MIN_X && Math.abs(s.y - candidate) < MIN_Y,
      );
      if (!clash) {
        pin.y = candidate;
        break;
      }
    }
    settled.push({ x: pin.x, y: pin.y });
  }

  const me = project(home.lat, home.lng);
  const remote = tasks.filter((t) => t.is_remote);

  return (
    <div className="px-3">
      <div className="card overflow-hidden p-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="Map of tasks around BU">
          <defs>
            <linearGradient id="river" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#7aa7d9" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#4d7fb5" stopOpacity="0.6" />
            </linearGradient>
          </defs>

          <rect width={W} height={H} fill="var(--surface-2)" />

          {/* The Charles, which is the one landmark everyone orients by. */}
          <path
            d="M -20 210 C 180 176, 360 150, 560 138 C 740 128, 880 124, 1020 122 L 1020 40 C 880 42, 740 48, 560 60 C 360 74, 180 112, -20 148 Z"
            fill="url(#river)"
          />
          <text x="150" y="150" fill="var(--ink-3)" fontSize="18" fontStyle="italic" opacity="0.8">
            Charles River
          </text>

          {/* Commonwealth Ave runs the length of campus. */}
          <path d="M -20 400 C 220 390, 520 378, 1020 368" stroke="var(--line-strong)" strokeWidth="18" fill="none" strokeLinecap="round" />
          <path d="M -20 400 C 220 390, 520 378, 1020 368" stroke="var(--surface)" strokeWidth="2" strokeDasharray="14 14" fill="none" />
          <text x="34" y="434" fill="var(--ink-3)" fontSize="16" fontWeight="600" opacity="0.8">
            Commonwealth Ave
          </text>

          {/* Storrow, on the river side. */}
          <path d="M -20 262 C 240 240, 560 222, 1020 212" stroke="var(--line)" strokeWidth="8" fill="none" />

          {LANDMARKS.map(([id, label]) => {
            const place = PLACES.find((p) => p.id === id);
            if (!place) return null;
            const { x, y } = project(place.lat, place.lng);
            return (
              <g key={id} opacity="0.55">
                <circle cx={x} cy={y} r="3.5" fill="var(--ink-3)" />
                <text x={x} y={y + 20} textAnchor="middle" fill="var(--ink-3)" fontSize="14" fontWeight="600">
                  {label}
                </text>
              </g>
            );
          })}

          <g>
            <circle cx={me.x} cy={me.y} r="26" fill="var(--color-scarlet-600)" opacity="0.12" />
            <circle cx={me.x} cy={me.y} r="8" fill="var(--color-scarlet-600)" stroke="var(--surface)" strokeWidth="3" />
            <text x={me.x + 14} y={me.y - 10} fill="var(--color-scarlet-600)" fontSize="16" fontWeight="700">
              You
            </text>
          </g>

          {placed.map(({ task, x, y }) => {
            const selected = active?.id === task.id;
            const label = task.price_type === "open" ? "$?" : `$${Math.round((task.price_max || task.price_min) / 100)}`;
            const width = 20 + label.length * 11;
            return (
              <g
                key={task.id}
                onClick={() => setActive(task)}
                style={{ cursor: "pointer" }}
                role="button"
                aria-label={`${task.title}, ${priceLabel(task)}`}
              >
                <rect
                  x={x - width / 2}
                  y={y - 15}
                  width={width}
                  height="30"
                  rx="15"
                  fill={selected ? "var(--ink)" : "var(--color-scarlet-600)"}
                  stroke="var(--surface)"
                  strokeWidth="3"
                />
                <text
                  x={x}
                  y={y + 6}
                  textAnchor="middle"
                  fill={selected ? "var(--bg)" : "#fff"}
                  fontSize="16"
                  fontWeight="700"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {active ? (
        <div className="card mt-3 animate-rise p-4">
          <div className="flex items-start gap-3">
            <span className="price text-[22px] text-scarlet-600 dark:text-scarlet-400">{priceLabel(active)}</span>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold leading-snug">{active.title}</h3>
              <p className="muted mt-1 text-[12px]">
                {categoryOf(active.category).emoji} {active.place_label} ·{" "}
                {active.distance_mi !== null ? `${active.distance_mi.toFixed(1)} mi` : "Remote"} ·{" "}
                {dueLabel(active.due_at)}
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
          {placed.length} {placed.length === 1 ? "task" : "tasks"} on campus · tap a price to see it
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
