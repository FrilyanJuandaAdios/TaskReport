import * as React from 'react'
import { Bell, Eye, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TaskStatusPicker } from '@/components/common/StatusChip'
import { TaskMetadata } from './TaskMetadata'
import { IMPLIED_TASK_STATUSES } from '@/constants/status'
import { cn } from '@/lib/utils'
import type { TaskStatus, TaskWithRelations } from '@/types/domain'

interface TaskRowProps {
  task: TaskWithRelations
  onStatusChange: (status: TaskStatus) => void
  onRename: (title: string) => void
  onEdit: () => void
  onDelete: () => void
  /** Renders the planned-time gutter. Off in views grouped by something else. */
  showTime?: boolean
  className?: string
  style?: React.CSSProperties
}

/**
 * A single task line.
 *
 * No card, no per-row border — a hover tint and generous line height, so a day
 * reads as one block of text. The status chip is hidden when the checkbox
 * already says the same thing, which keeps most rows chip-free.
 */
export function TaskRow({
  task,
  onStatusChange,
  onRename,
  onEdit,
  onDelete,
  showTime = true,
  className,
  style,
}: TaskRowProps) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(task.title)

  React.useEffect(() => setDraft(task.title), [task.title])

  const completed = task.status === 'completed'
  const cancelled = task.status === 'cancelled'
  const showStatus = !IMPLIED_TASK_STATUSES.includes(task.status)

  const commit = () => {
    const trimmed = draft.trim()
    setEditing(false)
    if (trimmed && trimmed !== task.title) onRename(trimmed)
    else setDraft(task.title)
  }

  return (
    <div
      style={style}
      onClick={(event) => {
        const target = event.target as HTMLElement
        if (target.closest('button, input, textarea, select, a, [role="button"], [role="menuitem"]')) return
        onEdit()
      }}
      className={cn(
        'group flex cursor-pointer animate-rise items-start gap-3 rounded-lg px-2 py-2.5 transition-colors duration-200 ease-fluid hover:bg-muted/50',
        className,
      )}
    >
      {showTime && (
        <span className="w-10 shrink-0 pt-0.5 text-[13px] tabular-nums text-muted-foreground/70">
          {task.plannedTime ?? ''}
        </span>
      )}

      <Checkbox
        checked={completed}
        onCheckedChange={(checked) => onStatusChange(checked ? 'completed' : 'planned')}
        aria-label={completed ? `Mark "${task.title}" as not done` : `Complete "${task.title}"`}
        className="mt-[3px]"
      />

      <div className="min-w-0 flex-1 space-y-0.5">
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commit()
              if (event.key === 'Escape') {
                setDraft(task.title)
                setEditing(false)
              }
            }}
            className="h-7 max-w-md text-[15px]"
            aria-label="Task name"
          />
        ) : (
          <button
            type="button"
            onClick={onEdit}
            className={cn(
              'block rounded-sm text-left text-[15px] leading-snug transition-colors duration-200 ease-fluid focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
              completed || cancelled
                ? 'text-muted-foreground line-through decoration-muted-foreground/40'
                : 'text-foreground',
            )}
          >
            {task.title}
          </button>
        )}

        <TaskMetadata task={task} />
      </div>

      <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
        {task.reminderTime && (
          <span className="mr-1 inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground" title={`Reminder at ${task.reminderTime}`}>
            <Bell className="h-3.5 w-3.5" />
            {task.reminderTime}
          </span>
        )}
        {showStatus && (
          <TaskStatusPicker value={task.status} onChange={onStatusChange} />
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-200 ease-fluid hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label={`Actions for ${task.title}`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {!showStatus && (
              <>
                <div className="px-2 py-1.5">
                  <TaskStatusPicker value={task.status} onChange={onStatusChange} />
                </div>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuItem onSelect={onEdit}>
              <Eye className="h-4 w-4" />
              View details
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setEditing(true)}>
              <Pencil className="h-4 w-4" />
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
