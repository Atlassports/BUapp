"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const ITEMS = [
  { href: "/feed", label: "Home", icon: HomeIcon },
  { href: "/now", label: "Now", icon: BoltIcon },
  { href: "/post", label: "Post", icon: PlusIcon, primary: true },
  { href: "/messages", label: "Inbox", icon: ChatIcon },
  { href: "/me", label: "You", icon: UserIcon },
] as const;

export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();

  // Every page here is server-rendered against the database, so a tap has a
  // round trip before the route actually changes. Highlighting the tapped tab
  // immediately — rather than waiting for that to land — is what removes the
  // "did it register?" feeling.
  const [tapped, setTapped] = useState<string | null>(null);
  useEffect(() => setTapped(null), [pathname]);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl hairline"
      style={{
        background: "color-mix(in srgb, var(--surface) 88%, transparent)",
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {ITEMS.map(({ href, label, icon: Icon, ...rest }) => {
          const onRoute = pathname === href || pathname.startsWith(`${href}/`);
          // A pending tap wins, so exactly one tab ever looks selected.
          const active = tapped ? tapped === href : onRoute;
          const primary = "primary" in rest && rest.primary;

          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                prefetch
                onClick={() => setTapped(href)}
                className="flex flex-1 flex-col items-center justify-center py-2"
                aria-label="Post a task"
              >
                <span className="flex h-9 w-12 items-center justify-center rounded-xl bg-scarlet-600 text-white shadow-sm transition-transform active:scale-95">
                  <Icon active />
                </span>
              </Link>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              prefetch
              onClick={() => setTapped(href)}
              className="relative flex flex-1 flex-col items-center gap-1 py-2.5 transition-colors duration-150"
              style={{ color: active ? "var(--color-scarlet-600)" : "var(--ink-3)" }}
              aria-current={onRoute ? "page" : undefined}
            >
              <span
                className="relative transition-transform duration-200"
                style={{ transform: active ? "translateY(-1px) scale(1.06)" : "none" }}
              >
                <Icon active={active} />
                {href === "/messages" && unread > 0 && (
                  <span className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-scarlet-600 px-1 text-[10px] font-bold text-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </span>
              <span className="text-[10px] font-semibold">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

type IconProps = { active?: boolean };
const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function HomeIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0}>
      <path d="M3 10.2 12 3l9 7.2V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />
    </svg>
  );
}
function BoltIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0}>
      <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}
function PlusIcon(_: IconProps) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" {...stroke} strokeWidth={2.4}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function ChatIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0}>
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9.5 9.5 0 0 1-2.8-.4L3 21l1.6-4.8A8.2 8.2 0 0 1 3 11.5 8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
    </svg>
  );
}
function UserIcon({ active }: IconProps) {
  return (
    <svg width="21" height="21" viewBox="0 0 24 24" {...stroke} fill={active ? "currentColor" : "none"} fillOpacity={active ? 0.14 : 0}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" />
    </svg>
  );
}
