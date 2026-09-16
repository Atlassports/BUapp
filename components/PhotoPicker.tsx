"use client";

import { useRef, useState } from "react";

/**
 * Photo capture.
 *
 * Inside the App Store build this calls Capacitor's Camera plugin, which is
 * genuine native functionality — the iOS camera, not a web file dialog. On the
 * web it falls back to a file input with `capture`, which still opens the
 * camera on a phone browser. Same component, same upload path.
 *
 * Images are downscaled in the browser before upload: a modern iPhone photo is
 * 4MB and nobody needs that to see a couch.
 */

const MAX_EDGE = 1600;
const QUALITY = 0.82;

type CapacitorCamera = {
  getPhoto: (options: Record<string, unknown>) => Promise<{ dataUrl?: string }>;
};

function nativeCamera(): CapacitorCamera | null {
  const cap = (window as unknown as {
    Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Camera?: CapacitorCamera } };
  }).Capacitor;
  if (!cap?.isNativePlatform?.()) return null;
  return cap.Plugins?.Camera ?? null;
}

async function downscale(source: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && source.size < 1_500_000) return source;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  // JPEG also strips the EXIF block, which carries GPS coordinates on an
  // iPhone photo — not something to hand to a stranger with a task.
  return new Promise((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? source), "image/jpeg", QUALITY),
  );
}

export type UploadedPhoto = { id: string; url: string };

export function PhotoPicker({
  kind,
  taskId,
  photos,
  onChange,
  max = 4,
  label = "Add photos",
  hint,
}: {
  kind: "task" | "proof" | "avatar";
  taskId?: string;
  photos: UploadedPhoto[];
  onChange: (next: UploadedPhoto[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(blob: Blob) {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", new File([await downscale(blob)], "photo.jpg", { type: "image/jpeg" }));
      form.append("kind", kind);
      if (taskId) form.append("taskId", taskId);

      const res = await fetch("/api/uploads", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Couldn't upload that.");
        return;
      }
      onChange([...photos, { id: data.id, url: data.url }]);
    } catch {
      setError("Upload failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function capture() {
    const camera = nativeCamera();
    if (!camera) {
      input.current?.click();
      return;
    }
    try {
      const photo = await camera.getPhoto({
        quality: 85,
        allowEditing: false,
        resultType: "dataUrl",
        source: "PROMPT",
        promptLabelHeader: "Add a photo",
        promptLabelPhoto: "Choose from library",
        promptLabelPicture: "Take a photo",
      });
      if (!photo.dataUrl) return;
      await upload(await (await fetch(photo.dataUrl)).blob());
    } catch {
      // The person cancelled the native sheet; not an error worth showing.
    }
  }

  async function remove(photo: UploadedPhoto) {
    onChange(photos.filter((p) => p.id !== photo.id));
    await fetch(`/api/photos/${photo.id}`, { method: "DELETE" });
  }

  return (
    <div>
      {hint && <p className="faint mb-2 text-[12px] leading-relaxed">{hint}</p>}

      <div className="flex flex-wrap gap-2">
        {photos.map((photo) => (
          <div key={photo.id} className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt=""
              className="h-20 w-20 rounded-xl border object-cover hairline"
              loading="lazy"
            />
            <button
              type="button"
              onClick={() => remove(photo)}
              aria-label="Remove photo"
              className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--ink)] text-[13px] font-bold text-[var(--bg)]"
            >
              ×
            </button>
          </div>
        ))}

        {photos.length < max && (
          <button
            type="button"
            onClick={capture}
            disabled={busy}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-[11px] font-semibold hairline"
          >
            {busy ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L17 6h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <circle cx="12" cy="12.5" r="3.5" />
                </svg>
                {label}
              </>
            )}
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
          e.target.value = "";
        }}
      />

      {error && <p className="mt-2 text-[12px] text-scarlet-600 dark:text-scarlet-400">{error}</p>}
    </div>
  );
}
