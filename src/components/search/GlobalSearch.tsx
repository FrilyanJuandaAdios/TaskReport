import * as React from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarDays, CheckSquare, FileText, Search, Truck } from 'lucide-react'
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useGlobalSearch } from '@/hooks/useAppData'
import { ROUTES } from '@/constants/navigation'
import { formatMediumDate } from '@/lib/date'
import { TASK_STATUS_META, DELIVERY_STATUS_META } from '@/constants/status'
import { truncate } from '@/lib/utils'

interface GlobalSearchProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * ⌘K palette. Searches tasks, deliveries and reports at once and jumps straight
 * to the day or the delivery — the fast path for "what did I do on 14 August?".
 */
export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const [query, setQuery] = React.useState('')
  const navigate = useNavigate()
  const { data, isFetching } = useGlobalSearch(query)

  React.useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  const go = (to: string) => {
    onOpenChange(false)
    navigate(to)
  }

  const hasResults =
    (data?.tasks.length ?? 0) + (data?.deliveries.length ?? 0) + (data?.reports.length ?? 0) > 0

  return (
    /* Results are already filtered by the search service; cmdk must not re-filter. */
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Search tasks, deliveries, reports, people, dates…"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {query.trim().length <= 1 ? (
          <CommandGroup heading="Try">
            <CommandItem onSelect={() => go(ROUTES.today)}>
              <CalendarDays className="h-4 w-4" />
              Go to today
            </CommandItem>
            <CommandItem onSelect={() => go(ROUTES.review)}>
              <FileText className="h-4 w-4" />
              Review my day
            </CommandItem>
            <CommandItem onSelect={() => go(ROUTES.deliveries)}>
              <Truck className="h-4 w-4" />
              Open delivery tracker
            </CommandItem>
            <CommandItem onSelect={() => go(ROUTES.search)}>
              <Search className="h-4 w-4" />
              Advanced search and filters
            </CommandItem>
          </CommandGroup>
        ) : !hasResults ? (
          <CommandEmpty>{isFetching ? 'Searching…' : 'Nothing found.'}</CommandEmpty>
        ) : null}

        {data && data.tasks.length > 0 && (
          <CommandGroup heading={`Tasks (${data.tasks.length})`}>
            {data.tasks.slice(0, 8).map((task) => (
              <CommandItem
                key={task.id}
                value={`task-${task.id}`}
                onSelect={() => go(ROUTES.historyDay(task.date))}
              >
                <CheckSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 truncate">{task.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatMediumDate(task.date)} · {TASK_STATUS_META[task.status].label}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {data && data.deliveries.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Deliveries (${data.deliveries.length})`}>
              {data.deliveries.slice(0, 6).map((delivery) => (
                <CommandItem
                  key={delivery.id}
                  value={`delivery-${delivery.id}`}
                  onSelect={() => go(ROUTES.delivery(delivery.id))}
                >
                  <Truck className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{delivery.title}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {DELIVERY_STATUS_META[delivery.status].label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data && data.reports.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={`Daily reports (${data.reports.length})`}>
              {data.reports.slice(0, 6).map((report) => (
                <CommandItem
                  key={report.id}
                  value={`report-${report.id}`}
                  onSelect={() => go(ROUTES.historyDay(report.date))}
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    {formatMediumDate(report.date)}
                    {report.issues && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        {truncate(report.issues.replace(/\n/g, ' '), 60)}
                      </span>
                    )}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {data && data.total > 20 && (
          <>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem value="__all__" onSelect={() => go(`${ROUTES.search}?q=${encodeURIComponent(query)}`)}>
                <Search className="h-4 w-4" />
                See all {data.total} results with filters
              </CommandItem>
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  )
}
