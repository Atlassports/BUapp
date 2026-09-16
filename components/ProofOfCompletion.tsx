"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoPicker, type UploadedPhoto } from "./PhotoPicker";
import { Banner } from "./ui";
import { ActionButton } from "./Sheet";

/**
 * A photo from the person who did the work.
 *
 * Most payment disputes are one person saying it was done and the other saying
 * it wasn't, with nothing in between. A timestamped photo of the package at the
 * door settles that before it becomes a frozen payment and a moderation ticket.
 */
export function ProofOfCompletion({ taskId, existing }: { taskId: string; existing: UploadedPhoto[] }) {
  const router = useRouter();
  const [photos, setPhotos] = useState<UploadedPhoto[]>(existing);
  const [done, setDone] = useState(false);

  if (done || (existing.length > 0 && photos.length === existing.length && existing.length > 0)) {
    return (
      <div className="card p-4">
        <p className="text-[14px] font-semibold">Proof added</p>
        <p className="faint mt-1 text-[12px] leading-relaxed">
          They can see this when they confirm. Keep it up until the payment clears.
        </p>
        <div className="mt-3">
          <PhotoPicker kind="proof" taskId={taskId} photos={photos} onChange={setPhotos} label="Add another" max={4} />
        </div>
      </div>
    );
  }

  return (
    <div className="card space-y-3 p-4">
      <p className="text-[14px] font-semibold">Show it's done</p>
      <Banner>
        A photo protects you. If they say the work wasn't done, this is what settles it — and it
        usually means the payment is confirmed straight away instead of frozen.
      </Banner>
      <PhotoPicker
        kind="proof"
        taskId={taskId}
        photos={photos}
        onChange={setPhotos}
        label="Take photo"
        max={4}
      />
      {photos.length > 0 && (
        <ActionButton
          className="btn btn-primary w-full py-2.5 text-[14px]"
          onClick={() => {
            setDone(true);
            router.refresh();
          }}
        >
          Mark it done
        </ActionButton>
      )}
    </div>
  );
}
