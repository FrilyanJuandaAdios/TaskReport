import { AlertTriangle, Ban, Check, CircleDashed, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { SectionHeading } from '@/components/common/PageHeader'
import { TaskStatusPicker } from '@/components/common/StatusChip'
import { TaskMetadata } from '@/components/tasks/TaskMetadata'
import { useSetTaskStatus } from '@/hooks/useTasks'
import { cn, pluralize } from '@/lib/utils'
import type { TaskStatus, TaskWithRelations } from '@/types/domain'

const STATUS_ICON: Record<TaskStatus, LucideIcon> = {
  completed: Check,
  in_progress: Loader2,
  blocked: AlertTriangle,
  planned: CircleDashed,
  cancelled: Ban,
}

const STATUS_ICON_TINT: Record<TaskStatus, string> = {
  completed: 'text-emerald-600 dark:text-emerald-400',
  in_progress: 'text-blue-600 dark:text-blue-400',
  blocked: 'text-amber-600 dark:text-amber-400',
  planned: 'text-muted-foreground',
  cancelled: 'text-muted-foreground',
}

interface DailyReviewChecklistProps {
  planned: TaskWithRelations[]
  unplanned: TaskWithRelations[]
}

/**
 * End-of-day pass over the day's tasks.
 *
 * The user does not write anything here — they confirm or correct statuses that
 * are already recorded. Every row is a status picker, so a whole review is a few
 * clicks rather than a form.
 */
export function DailyReviewChecklist({ planned, unplanned }: DailyReviewChecklistProps) {
  return (
    <div className="space-y-6">
      <section>
        <SectionHeading title="Planned tasks" meta={pluralize(planned.length, 'task')} />
        <ReviewRows tasks={planned} emptyText="Nothing was planned for this day." />
      </section>

      {unplanned.length > 0 && (
        <section>
          <SectionHeading title="Added during the day" meta={pluralize(unplanned.length, 'task')} />
          <ReviewRows tasks={unplanned} emptyText="" />
        </section>
      )}
    </div>
  )
}

function ReviewRows({ tasks, emptyText }: { tasks: TaskWithRelations[]; emptyText: string }) {
  const setStatus = useSetTaskStatus()

  if (tasks.length === 0) {
    return emptyText ? <p className="px-2 py-3 text-sm text-muted-foreground">{emptyText}</p> : null
  }

  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => {
        const Icon = STATUS_ICON[task.status]
        return (
          <li key={task.id} className="flex items-start gap-3 px-2 py-2.5">
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', STATUS_ICON_TINT[task.status])} aria-hidden />
            <div className="min-w-0 flex-1 space-y-1">
              <p
                className={cn(
                  'text-sm font-medium leading-snug',
                  (task.status === 'completed' || task.status === 'cancelled') &&
                    'text-muted-foreground line-through decoration-muted-foreground/50',
                )}
              >
                {task.title}
              </p>
              <TaskMetadata task={task} />
            </div>
            <TaskStatusPicker
              value={task.status}
              onChange={(status) => setStatus.mutate({ id: task.id, status })}
            />
          </li>
        )
      })}
    </ul>
  )
}
