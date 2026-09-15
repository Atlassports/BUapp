import Link from "next/link";
import type { ReactNode } from "react";
import type { PublicUser } from "@/lib/types";

/** Deterministic gradient avatar keyed off the user's stored hue. */
export function Avatar({
  user,
  size = 40,
}: {
  user: { name: string; avatar_hue: number };
  size?: number;
}) {
  const initials = user.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        background: `linear-gradient(140deg, hsl(${user.avatar_hue} 62% 52%), hsl(${(user.avatar_hue + 40) % 360} 58% 38%))`,
      }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function VerifiedBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-scarlet-600/10 px-1.5 py-0.5 text-[11px] font-semibold text-scarlet-600 dark:bg-scarlet-500/15 dark:text-scarlet-400"
      title="Verified with a bu.edu email"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
        <path d="M8 0l1.9 1.4 2.3-.3 1 2.1 2.1 1-.3 2.3L16 8l-1.4 1.9.3 2.3-2.1 1-1 2.1-2.3-.3L8 16l-1.9-1.4-2.3.3-1-2.1-2.1-1 .3-2.3L0 8l1.4-1.9-.3-2.3 2.1-1 1-2.1 2.3.3z" />
        <path d="M6.9 10.8L4.4 8.3l1-1 1.5 1.5L11 4.7l1 1z" fill="var(--surface)" />
      </svg>
      {compact ? "BU" : "BU Verified"}
    </span>
  );
}

export function Stars({ value, size = 13 }: { value: number | null; size?: number }) {
  if (value === null) {
    return <span className="faint text-xs">No reviews yet</span>;
  }
  return (
    <span className="inline-flex items-center gap-0.5" title={`${value} out of 5`}>
      <svg width={size} height={size} viewBox="0 0 20 20" fill="#f5a524" aria-hidden>
        <path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9 4.8 17.6l1-5.8L1.5 7.7l5.9-.9z" />
      </svg>
      <span className="text-xs font-semibold tabular-nums">{value.toFixed(1)}</span>
    </span>
  );
}

export function UserLine({
  user,
  size = 28,
  showRating = true,
}: {
  user: PublicUser;
  size?: number;
  showRating?: boolean;
}) {
  return (
    <Link
      href={`/u/${user.handle}`}
      className="inline-flex min-w-0 items-center gap-2"
      prefetch={false}
    >
      <Avatar user={user} size={size} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-semibold">{user.name}</span>
          {user.verified && <VerifiedBadge compact />}
        </span>
        {showRating && (
          <span className="flex items-center gap-2">
            <Stars value={user.rating} />
            <span className="faint text-[11px]">
              {user.review_count} {user.review_count === 1 ? "review" : "reviews"}
            </span>
          </span>
        )}
      </span>
    </Link>
  );
}

export function EmptyState({
  emoji,
  title,
  body,
  action,
}: {
  emoji: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <span className="text-4xl">{emoji}</span>
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="muted max-w-xs text-sm leading-relaxed">{body}</p>
      {action}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="faint px-4 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.08em]">
      {children}
    </h2>
  );
}

export function Banner({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "warn" | "scarlet";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-[var(--surface-2)] text-[var(--ink-2)] border-[var(--line)]",
    warn: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/25",
    scarlet: "bg-scarlet-600/8 text-scarlet-700 dark:text-scarlet-400 border-scarlet-600/20",
  } as const;
  return (
    <div className={`rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function TrustMeter({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div
          className="h-full rounded-full bg-scarlet-600 transition-[width] duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="price text-sm">{score}</span>
    </div>
  );
}
