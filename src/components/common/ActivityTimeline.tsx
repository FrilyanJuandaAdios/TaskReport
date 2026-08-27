import { formatDateTime } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { ActivityLog } from '@/types/domain'
import { EmptyState } from './EmptyState'
import { History } from 'lucide-react'

const ACTION_TINT: Record<string, string> = {
  'task.completed': 'bg-emerald-500',
  'delivery.delivered': 'bg-emerald-500',
  'task.started': 'bg-blue-500',
  'task.blocked': 'bg-amber-500',
  'delivery.revised': 'bg-orange-500',
  'task.cancelled': 'bg-zinc-400',
  'task.deleted': 'bg-zinc-400',
  'delivery.deleted': 'bg-zinc-400',
}

interface ActivityTimelineProps {
  entries: ActivityLog[]
  className?: string
  emptyText?: string
}

/** Vertical audit trail. Pre-rendered messages mean no joins at render time. */
export function ActivityTimeline({ entries, className, emptyText }: ActivityTimelineProps) {
  if (entries.length === 0) {
    return <EmptyState icon={History} title={emptyText ?? 'No activity recorded yet.'} />
  }

  return (
    <ol className={cn('space-y-0', className)}>
      {entries.map((entry, index) => (
        <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
          <div className="flex flex-col items-center">
            <span
              className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', ACTION_TINT[entry.action] ?? 'bg-muted-foreground/40')}
              aria-hidden
            />
            {index < entries.length - 1 && <span className="w-px flex-1 bg-border" aria-hidden />}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <p className="text-sm leading-snug">{entry.message}</p>
            <p className="text-xs text-muted-foreground">{formatDateTime(entry.at)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
