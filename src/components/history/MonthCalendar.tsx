import { Link } from 'react-router-dom'
import { isSameMonth } from 'date-fns'
import { monthGridDays, toISODate, today } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { cn } from '@/lib/utils'
import type { DaySummary, ISODate } from '@/types/domain'

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

interface MonthCalendarProps {
  anchor: Date
  summaries: DaySummary[]
}

/**
 * Month grid where each cell carries its own density.
 *
 * The completion bar is the point: you should be able to read a month's shape
 * without reading a single number. Counts are there for when you do.
 */
export function MonthCalendar({ anchor, summaries }: MonthCalendarProps) {
  const byDate = new Map<ISODate, DaySummary>(summaries.map((summary) => [summary.date, summary]))
  const days = monthGridDays(anchor)
  const todayKey = today()

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/70">
      <div className="grid grid-cols-7 border-b border-border/70 bg-muted/40">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-0.5 py-2 text-center text-[10px] font-medium uppercase tracking-[0.04em] text-muted-foreground sm:px-2 sm:text-[11px]"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = toISODate(day)
          const summary = byDate.get(key)
          const inMonth = isSameMonth(day, anchor)
          const isToday = key === todayKey
          const percent = summary && summary.total > 0
            ? Math.round((summary.completed / summary.total) * 100)
            : 0

          return (
            <Link
              key={key}
              to={ROUTES.historyDay(key)}
              className={cn(
                'group flex min-h-[64px] min-w-0 flex-col gap-1 border-b border-r border-border/60 p-1 text-left transition-colors duration-200 ease-fluid last:border-r-0 hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60 sm:min-h-[92px] sm:p-2',
                !inMonth && 'bg-muted/20',
              )}
              aria-label={`${key}${
                summary
                  ? `, ${summary.total} tasks, ${summary.completed} completed`
                  : ', no work logged'
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs tabular-nums sm:text-[13px]',
                    isToday && 'bg-primary font-semibold text-primary-foreground',
                    !isToday && (inMonth ? 'text-foreground' : 'text-muted-foreground/50'),
                  )}
                >
                  {day.getDate()}
                </span>
                <span className="flex items-center gap-1">
                  {summary && summary.meetings > 0 && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-brand/60"
                      title={`${summary.meetings} meetings`}
                      aria-hidden
                    />
                  )}
                  {summary?.hasReport && (
                    <span
                      className="h-1.5 w-1.5 rounded-full bg-emerald-500"
                      title="Daily report written"
                      aria-hidden
                    />
                  )}
                </span>
              </div>

              {summary && summary.total > 0 && (
                <>
                  <div className="h-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500/80"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="hidden text-[11px] leading-tight text-muted-foreground min-[390px]:block">
                    <span className="font-medium text-foreground/80">{summary.completed}</span>
                    <span className="text-muted-foreground/70">/{summary.total}</span>
                    {summary.unplanned > 0 && (
                      <span className="ml-1 text-amber-600 dark:text-amber-400">
                        +{summary.unplanned}
                      </span>
                    )}
                  </p>
                </>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
