import * as React from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, Download, ListTodo, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { FilterBar, type DateRangeValue } from '@/components/common/FilterBar'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { TaskList } from '@/components/tasks/TaskList'
import { useTaskSearch } from '@/hooks/useTasks'
import { useProjects, useRequesters, useTags } from '@/hooks/useCatalog'
import { useDebouncedValue } from '@/hooks/useAppData'
import { exportTasksCsv } from '@/services/exportService'
import { TASK_STATUSES } from '@/types/domain'
import { TASK_STATUS_META } from '@/constants/status'
import { formatLongDate, today } from '@/lib/date'
import { groupBy, pluralize } from '@/lib/utils'
import { toastError } from '@/hooks/useToast'
import type { TaskFilter, TaskStatus } from '@/types/domain'

/**
 * Structured archive search.
 *
 * Answers the audit questions directly:
 *   "Show everything requested by David"    -> requester facet
 *   "Show all CSM work this month"          -> project facet + date range
 *   "Show work that was added unexpectedly" -> the Unplanned preset
 */
export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()

  const [query, setQuery] = React.useState(searchParams.get('q') ?? '')
  const [statuses, setStatuses] = React.useState<TaskStatus[]>([])
  const [projectIds, setProjectIds] = React.useState<string[]>([])
  const [requesterIds, setRequesterIds] = React.useState<string[]>([])
  const [tagIds, setTagIds] = React.useState<string[]>([])
  const [planned, setPlanned] = React.useState<'all' | 'planned' | 'unplanned'>('all')
  const [range, setRange] = React.useState<DateRangeValue>({ from: null, to: null })

  const debouncedQuery = useDebouncedValue(query, 200)

  const { data: projects = [] } = useProjects()
  const { data: requesters = [] } = useRequesters()
  const { data: tags = [] } = useTags()

  const filter = React.useMemo<TaskFilter>(
    () => ({
      query: debouncedQuery.trim() || undefined,
      statuses: statuses.length > 0 ? statuses : undefined,
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      requesterIds: requesterIds.length > 0 ? requesterIds : undefined,
      tagIds: tagIds.length > 0 ? tagIds : undefined,
      isPlanned: planned === 'all' ? undefined : planned === 'planned',
      from: range.from ?? undefined,
      to: range.to ?? undefined,
    }),
    [debouncedQuery, statuses, projectIds, requesterIds, tagIds, planned, range],
  )

  const hasCriteria =
    Boolean(filter.query) ||
    Boolean(filter.statuses ?? filter.projectIds ?? filter.requesterIds ?? filter.tagIds) ||
    filter.isPlanned !== undefined ||
    Boolean(filter.from ?? filter.to)

  const { data: tasks = [], isFetching } = useTaskSearch(filter, hasCriteria)

  React.useEffect(() => {
    setSearchParams(debouncedQuery ? { q: debouncedQuery } : {}, { replace: true })
  }, [debouncedQuery, setSearchParams])

  const byDate = React.useMemo(() => groupBy(tasks, (task) => task.date), [tasks])
  const dates = React.useMemo(
    () => Object.keys(byDate).sort((a, b) => b.localeCompare(a)),
    [byDate],
  )

  const reset = () => {
    setStatuses([])
    setProjectIds([])
    setRequesterIds([])
    setTagIds([])
    setPlanned('all')
    setRange({ from: null, to: null })
  }

  const exportResults = async () => {
    try {
      const from = range.from ?? dates[dates.length - 1] ?? today()
      const to = range.to ?? dates[0] ?? today()
      await exportTasksCsv(from, to)
    } catch (error) {
      toastError(error, 'Export failed.')
    }
  }

  return (
    <Page className="space-y-4">
      <PageHeader
        title="Search"
        actions={
          <Button variant="outline" size="sm" onClick={exportResults} disabled={tasks.length === 0}>
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        }
      />

      {hasCriteria && tasks.length > 0 && (
        <WidgetGrid columns={4} align="stretch">
          <StatTile label="Matches" value={tasks.length} icon={ListTodo} />
          <StatTile label="Days" value={dates.length} icon={CalendarDays} />
          <StatTile
            label="Completed"
            value={tasks.filter((task) => task.status === 'completed').length}
            tone="emerald"
          />
          <StatTile
            label="Unplanned"
            value={tasks.filter((task) => !task.isPlanned).length}
            tone="amber"
          />
        </WidgetGrid>
      )}

      <Widget contentClassName="space-y-4 pt-4">
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search titles, notes, dates…"
          onReset={reset}
          dateRange={{ value: range, onChange: setRange }}
          facets={[
            {
              key: 'status',
              label: 'Status',
              selected: statuses,
              onChange: (values) => setStatuses(values as TaskStatus[]),
              options: TASK_STATUSES.map((status) => ({
                value: status,
                label: TASK_STATUS_META[status].label,
              })),
            },
            {
              key: 'project',
              label: 'Project',
              selected: projectIds,
              onChange: setProjectIds,
              options: projects.map((project) => ({ value: project.id, label: project.name })),
            },
            {
              key: 'requester',
              label: 'Requester',
              selected: requesterIds,
              onChange: setRequesterIds,
              options: requesters.map((requester) => ({
                value: requester.id,
                label: requester.name,
              })),
            },
            {
              key: 'tag',
              label: 'Tag',
              selected: tagIds,
              onChange: setTagIds,
              options: tags.map((tag) => ({ value: tag.id, label: `#${tag.name}` })),
            },
          ]}
        >
          <div className="flex items-center gap-0.5 rounded-md border border-border p-0.5">
            {(['all', 'planned', 'unplanned'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setPlanned(option)}
                aria-pressed={planned === option}
                className={`rounded-[7px] px-2.5 py-1.5 text-xs capitalize transition-colors duration-200 ease-fluid ${
                  planned === option
                    ? 'bg-secondary font-medium text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </FilterBar>

        {!hasCriteria ? (
          <EmptyState
            icon={SearchX}
            title="Start typing, or pick a filter"
            description="Try a project, a person's name, or a date range."
          />
        ) : isFetching && tasks.length === 0 ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No work logs found"
            description="Widen the date range or clear a filter."
          />
        ) : (
          <div className="-mx-2 divide-y divide-border/60">
            {dates.map((date) => (
              <section key={date} className="py-2 first:pt-0">
                <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                  {formatLongDate(date)} · {pluralize(byDate[date].length, 'task')}
                </p>
                <TaskList tasks={byDate[date]} showTimeGutter={false} />
              </section>
            ))}
          </div>
        )}
      </Widget>
    </Page>
  )
}
