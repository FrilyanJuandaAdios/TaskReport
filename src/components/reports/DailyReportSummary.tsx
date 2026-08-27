import { cn } from '@/lib/utils'
import type { DailyReportSummary as Summary } from '@/types/domain'

interface DailyReportSummaryProps {
  summary: Summary
  className?: string
}

/**
 * The optional counter strip from the brief. Plain numbers on a divided row —
 * no cards, no charts; at five values a chart would carry less information than
 * the digits themselves.
 */
export function DailyReportSummaryStrip({ summary, className }: DailyReportSummaryProps) {
  const items = [
    { label: 'Planned', value: summary.planned },
    { label: 'Completed', value: summary.completed },
    { label: 'In progress', value: summary.inProgress },
    { label: 'Blocked', value: summary.blocked },
    { label: 'Unplanned', value: summary.unplanned },
  ]

  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-border/70 sm:grid-cols-5',
        className,
      )}
    >
      {items.map((item) => (
        <div key={item.label} className="bg-background px-4 py-3.5">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
