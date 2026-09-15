import Link from "next/link";
import { Avatar, Stars, VerifiedBadge } from "./ui";
import { categoryOf, TRANSPORT_BY_ID } from "@/lib/taxonomy";
import { formatDistance } from "@/lib/geo";
import { dueLabel, duration, isUrgent, priceLabel, timeAgo } from "@/lib/format";
import type { TaskCard as TaskCardType } from "@/lib/types";

export function TaskCard({ task, showPoster = true }: { task: TaskCardType; showPoster?: boolean }) {
  const cat = categoryOf(task.category);
  const transport = task.transport_req ? TRANSPORT_BY_ID.get(task.transport_req) : null;
  const urgent = isUrgent(task.due_at);

  return (
    <Link href={`/tasks/${task.id}`} className="card block animate-rise p-3.5" prefetch={false}>
      <div className="flex gap-3">
        <div className="flex w-[62px] shrink-0 flex-col items-center gap-1 pt-0.5">
          <span className="price text-[19px] leading-none text-scarlet-600 dark:text-scarlet-400">
            {priceLabel(task)}
          </span>
          <span className="faint text-[10px] font-medium">{duration(task.est_minutes)}</span>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-semibold leading-snug">{task.title}</h3>

          <div className="muted mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12px]">
            <span className="inline-flex items-center gap-1">
              {task.is_remote ? "💻" : "📍"}
              {task.is_remote ? "Remote" : `${formatDistance(task.distance_mi)} · ${task.place_label}`}
            </span>
            {transport && (
              <span className="inline-flex items-center gap-1">
                {transport.emoji} {transport.label}
              </span>
            )}
            <span
              className={
                urgent
                  ? "inline-flex items-center gap-1 font-semibold text-scarlet-600 dark:text-scarlet-400"
                  : "inline-flex items-center gap-1"
              }
            >
              ⏰ {dueLabel(task.due_at)}
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <span className="chip">
              {cat.emoji} {cat.label}
            </span>
            {task.tag_list.slice(0, 2).map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
            {task.tag_list.length > 2 && (
              <span className="chip">+{task.tag_list.length - 2}</span>
            )}
          </div>

          {showPoster && (
            <div className="mt-3 flex items-center gap-2 border-t pt-2.5 hairline">
              <Avatar user={task.poster} size={20} />
              <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                {task.poster.name}
              </span>
              <span className="shrink-0">{task.poster.verified && <VerifiedBadge compact />}</span>
              <span className="shrink-0">
                <Stars value={task.poster.rating} size={11} />
              </span>
              <span className="faint shrink-0 text-[11px]">
                {task.offer_count > 0 && (
                  <span className="mr-2 font-medium text-[var(--ink-2)]">
                    {task.offer_count} {task.offer_count === 1 ? "offer" : "offers"}
                  </span>
                )}
                {timeAgo(task.created_at)}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}

/** Compact row used in "Available Now" plans and profile lists. */
export function TaskRow({ task, trailing }: { task: TaskCardType; trailing?: string }) {
  return (
    <Link href={`/tasks/${task.id}`} className="flex items-center gap-3 px-4 py-3" prefetch={false}>
      <span className="price w-14 shrink-0 text-[16px] text-scarlet-600 dark:text-scarlet-400">
        {priceLabel(task)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium">{task.title}</span>
        <span className="muted block truncate text-[12px]">
          {task.is_remote ? "Remote" : formatDistance(task.distance_mi)} · {duration(task.est_minutes)}
          {trailing ? ` · ${trailing}` : ""}
        </span>
      </span>
      <span className="faint text-lg">›</span>
    </Link>
  );
}
