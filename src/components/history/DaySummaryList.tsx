import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight, FileText } from 'lucide-react'
import { ROUTES } from '@/constants/navigation'
import { formatLongDate } from '@/lib/date'
import { pluralize } from '@/lib/utils'
import type { DaySummary } from '@/types/domain'

interface DaySummaryListProps {
  summaries: DaySummary[]
}

/** Dense list view of History — one row per day worked, with its completion bar. */
export function DaySummaryList({ summaries }: DaySummaryListProps) {
  return (
    <ul className="-mx-2">
      {summaries.map((summary) => {
        const percent =
          summary.total > 0 ? Math.round((summary.completed / summary.total) * 100) : 0

        return (
          <li key={summary.date}>
            <Link
              to={ROUTES.historyDay(summary.date)}
              className="group flex items-center gap-4 rounded-lg px-2 py-3 transition-colors duration-200 ease-fluid hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/60"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <p className="flex items-center gap-2 text-[15px]">
                  {formatLongDate(summary.date)}
                  {summary.hasReport && (
                    <FileText
                      className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400"
                      aria-label="Daily report written"
                    />
                  )}
                  {summary.meetings > 0 && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden />
                      {summary.meetings}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {pluralize(summary.total, 'task')} · {summary.completed} done
                  {summary.blocked > 0 && ` · ${summary.blocked} blocked`}
                  {summary.unplanned > 0 && ` · ${summary.unplanned} unplanned`}
                </p>
              </div>

              <div className="hidden w-32 shrink-0 sm:block">
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500/80 transition-[width] duration-500 ease-fluid"
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>

              <ChevronRight
                className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 ease-fluid group-hover:translate-x-0.5"
                aria-hidden
              />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
