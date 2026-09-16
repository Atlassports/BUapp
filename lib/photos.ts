import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { all, get, id, run } from "./db";

/**
 * Photo storage.
 *
 * Files go on the mounted volume next to the database, not into it: a database
 * holding megabytes of JPEGs makes every backup and migration slower for no
 * benefit. Only metadata is stored in SQLite.
 *
 * Moving to S3 or R2 later means changing `write` and `read` and nothing else.
 */

const ROOT = process.env.SIDEKICK_UPLOADS ?? ".data/uploads";

export const MAX_BYTES = 4 * 1024 * 1024;
export const MAX_PER_TASK = 4;

export type Photo = {
  id: string;
  owner_id: string;
  task_id: string | null;
  kind: "task" | "proof" | "avatar";
  filename: string;
  mime: string;
  bytes: number;
  created_at: number;
};

/**
 * Trusts the file's own bytes rather than its declared type. A client can
 * claim any Content-Type, and this endpoint accepts uploads from anyone with
 * an account.
 */
export function sniffImage(buffer: Buffer): string | null {
  if (buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") {
    return "image/webp";
  }
  // HEIC, which is what an iPhone produces unless the browser converts it.
  if (buffer.subarray(4, 8).toString() === "ftyp") {
    const brand = buffer.subarray(8, 12).toString();
    if (["heic", "heix", "hevc", "mif1"].includes(brand)) return "image/heic";
  }
  return null;
}

function pathFor(photoId: string, filename: string): string {
  // Shard by prefix so one directory never holds tens of thousands of files.
  return join(ROOT, photoId.slice(4, 6), `${photoId}-${filename}`);
}

export function savePhoto(input: {
  ownerId: string;
  taskId: string | null;
  kind: Photo["kind"];
  buffer: Buffer;
  mime: string;
}): Photo {
  const photoId = id("pho");
  const extension = input.mime.split("/")[1] ?? "jpg";
  const filename = `image.${extension}`;
  const target = pathFor(photoId, filename);

  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, input.buffer);

  run(
    `INSERT INTO photos (id, owner_id, task_id, kind, filename, mime, bytes, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    photoId,
    input.ownerId,
    input.taskId,
    input.kind,
    filename,
    input.mime,
    input.buffer.length,
    Date.now(),
  );

  return get<Photo>(`SELECT * FROM photos WHERE id = ?`, photoId)!;
}

export function readPhoto(photoId: string): { photo: Photo; bytes: Buffer } | null {
  const photo = get<Photo>(`SELECT * FROM photos WHERE id = ?`, photoId);
  if (!photo) return null;
  try {
    return { photo, bytes: readFileSync(pathFor(photo.id, photo.filename)) };
  } catch {
    // The row outlived its file — a restore that missed the volume, say.
    return null;
  }
}

export function photosForTask(taskId: string, kind?: Photo["kind"]): Photo[] {
  return kind
    ? all<Photo>(`SELECT * FROM photos WHERE task_id = ? AND kind = ? ORDER BY created_at`, taskId, kind)
    : all<Photo>(`SELECT * FROM photos WHERE task_id = ? ORDER BY created_at`, taskId);
}

export function deletePhoto(photoId: string, requesterId: string): boolean {
  const photo = get<Photo>(`SELECT * FROM photos WHERE id = ?`, photoId);
  if (!photo || photo.owner_id !== requesterId) return false;
  try {
    rmSync(pathFor(photo.id, photo.filename), { force: true });
  } catch {
    // Removing the row still matters even if the file is already gone.
  }
  run(`DELETE FROM photos WHERE id = ?`, photoId);
  return true;
}

export function avatarFor(userId: string): string | null {
  return (
    get<{ avatar_photo_id: string | null }>(`SELECT avatar_photo_id FROM users WHERE id = ?`, userId)
      ?.avatar_photo_id ?? null
  );
}
