"use client";

import { useEffect } from "react";

/**
 * Bottom sheet. One implementation so every modal in the app opens the same
 * way — the inconsistency between hand-rolled ones is what makes an app feel
 * assembled rather than designed.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  // Escape closes, and the page behind must not scroll while it's open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center animate-fade" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Close" />
      <div
        className="relative mx-auto flex max-h-[88dvh] w-full max-w-lg animate-sheet flex-col rounded-t-3xl border-t surface hairline"
        style={{ paddingBottom: "calc(0.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-center justify-between border-b px-5 py-4 hairline">
          <span className="w-16" />
          <h2 className="text-[15px] font-bold">{title}</h2>
          <button onClick={onClose} className="muted w-16 text-right text-[13px] font-medium">
            Done
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-5">{children}</div>
        {footer && <div className="border-t px-5 py-3.5 hairline">{footer}</div>}
      </div>
    </div>
  );
}

/** A button that shows it's working, so a slow action never looks ignored. */
export function ActionButton({
  busy,
  children,
  className = "btn btn-primary w-full",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean }) {
  return (
    <button className={className} disabled={busy || rest.disabled} {...rest}>
      {busy && (
        <span
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden
        />
      )}
      {children}
    </button>
  );
}
