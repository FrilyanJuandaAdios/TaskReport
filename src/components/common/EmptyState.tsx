import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  /** For an empty section inside a populated page, where a full-page void reads as a bug. */
  compact?: boolean
  className?: string
}

/**
 * Text-first empty state — one muted line, one sentence, and the single action
 * that resolves the emptiness. No illustrations.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  compact,
  className,
}: EmptyStateProps) {
  if (compact) {
    return <p className={cn('px-2 py-3 text-sm text-muted-foreground', className)}>{title}</p>
  }

  return (
    <div
      className={cn(
        'flex animate-fade flex-col items-center justify-center gap-3 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && <Icon className="h-5 w-5 text-muted-foreground/40" strokeWidth={1.6} aria-hidden />}
      <div className="space-y-1">
        <p className="text-sm text-foreground/80">{title}</p>
        {description && (
          <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  )
}
