import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PROJECT_COLOR_CLASSES } from '@/constants/status'
import { ROUTES } from '@/constants/navigation'
import { describeRelativeDay, isOverdue } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/types/domain'

interface TaskMetadataProps {
  task: TaskWithRelations
  className?: string
  /** Hides the delivery link in contexts that already show it (delivery detail). */
  hideDelivery?: boolean
}

/** Metadata is capped at three items — past that a list stops being scannable. */
const MAX_ITEMS = 3

/**
 * The muted second line under a task title.
 *
 * Everything here is `text-xs text-muted-foreground` on purpose: metadata must
 * never compete with the task name. Anything that does not fit collapses into a
 * `+N` badge rather than wrapping the row onto a third line.
 */
export function TaskMetadata({ task, className, hideDelivery }: TaskMetadataProps) {
  const dueDate = task.delivery?.targetDeliveryDate ?? task.targetDate ?? null
  const deliveredOn = task.delivery?.actualDeliveryDate
  // A delivery that already shipped is never late, whatever its target date said.
  const settled = Boolean(deliveredOn) || task.status === 'completed'
  const overdue = Boolean(dueDate) && !settled && isOverdue(dueDate)

  const items: ReactNode[] = []

  if (task.project) {
    items.push(
      <span key="project" className="inline-flex items-center gap-1.5">
        <span
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            PROJECT_COLOR_CLASSES[task.project.color] ?? 'bg-muted-foreground',
          )}
          aria-hidden
        />
        {task.project.name}
      </span>,
    )
  }

  if (task.requester && !task.requester.isSelf) {
    items.push(<span key="requester">{task.requester.name}</span>)
  }

  if (dueDate && !settled) {
    items.push(
      <span key="due" className={cn(overdue && 'text-destructive')}>
        {overdue ? 'Late · ' : ''}
        {describeRelativeDay(dueDate)}
      </span>,
    )
  }

  if (task.delivery && !hideDelivery) {
    items.push(
      <Link
        key="delivery"
        to={ROUTES.delivery(task.delivery.id)}
        className="underline-offset-2 transition-colors duration-200 ease-fluid hover:text-foreground hover:underline"
      >
        {task.delivery.title}
      </Link>,
    )
  }

  task.tags.forEach((tag) => items.push(<span key={`tag-${tag.id}`}>#{tag.name}</span>))

  if (items.length === 0) return null

  const visible = items.slice(0, MAX_ITEMS)
  const overflow = items.length - visible.length

  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground',
        className,
      )}
    >
      {visible.map((item, index) => (
        <span key={index} className="inline-flex items-center gap-1.5">
          {index > 0 && (
            <span aria-hidden className="text-muted-foreground/40">
              ·
            </span>
          )}
          {item}
        </span>
      ))}
      {overflow > 0 && (
        <span className="text-muted-foreground/60" title="More details in the task panel">
          +{overflow}
        </span>
      )}
    </div>
  )
}
