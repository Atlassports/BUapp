"use client";

import { usePathname } from "next/navigation";

/**
 * Replays the enter animation on each navigation.
 *
 * Layouts persist across route changes, so an animation class sitting on a
 * layout element runs once on first mount and never again. Keying on the path
 * remounts this wrapper when the route changes, which is what makes the
 * transition actually play.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="page-in">
      {children}
    </div>
  );
}
