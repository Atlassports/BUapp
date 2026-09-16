import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { get, run } from "@/lib/db";
import { MAX_BYTES, MAX_PER_TASK, photosForTask, savePhoto, sniffImage } from "@/lib/photos";
import type { Task } from "@/lib/types";

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image is too large. Keep it under 4MB." }, { status: 413 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Trust the bytes, not the declared type.
  const mime = sniffImage(buffer);
  if (!mime) {
    return NextResponse.json({ error: "That file isn't an image." }, { status: 415 });
  }

  const kind = String(form?.get("kind") ?? "task");
  const taskId = form?.get("taskId") ? String(form.get("taskId")) : null;

  if (kind === "avatar") {
    const photo = savePhoto({ ownerId: user.id, taskId: null, kind: "avatar", buffer, mime });
    run(`UPDATE users SET avatar_photo_id = ? WHERE id = ?`, photo.id, user.id);
    return NextResponse.json({ id: photo.id, url: `/api/photos/${photo.id}` });
  }

  // Task and proof photos have to belong to a task the uploader is part of.
  if (!taskId) return NextResponse.json({ error: "Missing task." }, { status: 400 });
  const task = get<Task>(`SELECT * FROM tasks WHERE id = ?`, taskId);
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });

  if (kind === "proof") {
    if (task.assignee_id !== user.id) {
      return NextResponse.json({ error: "Only the person doing the task can add proof." }, { status: 403 });
    }
  } else if (task.poster_id !== user.id) {
    return NextResponse.json({ error: "Not your task." }, { status: 403 });
  }

  if (photosForTask(taskId, kind === "proof" ? "proof" : "task").length >= MAX_PER_TASK) {
    return NextResponse.json({ error: `That's the limit of ${MAX_PER_TASK} photos.` }, { status: 409 });
  }

  const photo = savePhoto({
    ownerId: user.id,
    taskId,
    kind: kind === "proof" ? "proof" : "task",
    buffer,
    mime,
  });
  return NextResponse.json({ id: photo.id, url: `/api/photos/${photo.id}` });
}
