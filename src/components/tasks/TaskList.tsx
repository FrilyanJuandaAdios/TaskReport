import * as React from 'react'
import { TaskRow } from './TaskRow'
import { TaskDetailsSheet } from './TaskDetailsSheet'
import { useDeleteTask, useSetTaskStatus, useUpdateTask } from '@/hooks/useTasks'
import { cn } from '@/lib/utils'
import type { TaskWithRelations } from '@/types/domain'

interface TaskListProps {
  tasks: TaskWithRelations[]
  /** Splits the list into timed and untimed tasks. */
  groupByTime?: boolean
  showTimeGutter?: boolean
  emptyState?: React.ReactNode
  className?: string
}

/**
 * Renders tasks and owns the mutations every row needs, so a page only has to
 * pass data in. Keeps the details sheet local: exactly one is mounted at a time.
 */
export function TaskList({
  tasks,
  groupByTime = false,
  showTimeGutter = true,
  emptyState,
  className,
}: TaskListProps) {
  const [editingTask, setEditingTask] = React.useState<TaskWithRelations | null>(null)
  const setStatus = useSetTaskStatus()
  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()

  // Keep the open sheet in sync with refetched data after a mutation.
  React.useEffect(() => {
    if (!editingTask) return
    const fresh = tasks.find((task) => task.id === editingTask.id)
    if (fresh && fresh !== editingTask) setEditingTask(fresh)
  }, [tasks, editingTask])

  if (tasks.length === 0) return <>{emptyState ?? null}</>

  const renderRow = (task: TaskWithRelations, index: number) => (
    <TaskRow
      key={task.id}
      task={task}
      showTime={showTimeGutter}
      style={{ '--rise-delay': `${Math.min(index, 8) * 30}ms` } as React.CSSProperties}
      onStatusChange={(status) => setStatus.mutate({ id: task.id, status })}
      onRename={(title) => updateTask.mutate({ id: task.id, patch: { title } })}
      onEdit={() => setEditingTask(task)}
      onDelete={() => deleteTask.mutate(task.id)}
    />
  )

  const scheduled = tasks.filter((task) => Boolean(task.plannedTime))
  const anytime = tasks.filter((task) => !task.plannedTime)
  const split = groupByTime && scheduled.length > 0 && anytime.length > 0

  return (
    <div className={cn('space-y-0.5', className)}>
      {split ? (
        <>
          <div>{scheduled.map(renderRow)}</div>
          <div className="pt-5">
            <Divider>Anytime</Divider>
            {anytime.map(renderRow)}
          </div>
        </>
      ) : (
        tasks.map(renderRow)
      )}

      <TaskDetailsSheet
        task={editingTask}
        open={Boolean(editingTask)}
        onOpenChange={(open) => !open && setEditingTask(null)}
      />
    </div>
  )
}

/** A hairline with a word on it — quieter than a heading for an in-list split. */
function Divider({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1 flex items-center gap-3 px-2">
      <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
        {children}
      </span>
      <span className="h-px flex-1 bg-border/70" aria-hidden />
    </div>
  )
}
