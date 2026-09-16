import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TaskEditor } from "@/components/TaskEditor";
import { requireUser } from "@/lib/auth";
import { getTask } from "@/lib/queries";
import type { CategoryId } from "@/lib/taxonomy";

export const dynamic = "force-dynamic";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const task = getTask(id, user);
  if (!task) notFound();
  if (task.poster_id !== user.id) redirect(`/tasks/${id}`);
  if (task.status !== "open") redirect(`/tasks/${id}`);

  return (
    <>
      <header className="flex items-center gap-3 px-3 py-3">
        <Link href={`/tasks/${id}`} className="flex h-8 w-8 items-center justify-center rounded-lg border hairline" aria-label="Back">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m14 6-6 6 6 6" />
          </svg>
        </Link>
        <h1 className="text-[19px] font-bold tracking-tight">Edit task</h1>
      </header>
      <TaskEditor
        taskId={id}
        initial={{
          title: task.title,
          body: task.body,
          category: task.category as CategoryId,
          tags: task.tag_list,
          priceType: task.price_type,
          priceMin: task.price_min,
          priceMax: task.price_max,
          estMinutes: task.est_minutes,
        }}
      />
    </>
  );
}
