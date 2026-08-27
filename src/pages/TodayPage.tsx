import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  CornerDownLeft,
  ListTodo,
  Plus,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/common/EmptyState'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { TaskQuickAdd } from '@/components/tasks/TaskQuickAdd'
import { TaskList } from '@/components/tasks/TaskList'
import { MeetingList } from '@/components/meetings/MeetingList'
import { DeliveryStatusChip } from '@/components/common/StatusChip'
import { useCarryOverTasks, useTasksForDate } from '@/hooks/useTasks'
import { useMeetingsForDate } from '@/hooks/useMeetings'
import { useDashboard, useSettings } from '@/hooks/useAppData'
import { useScrollContainer, useScrollProgress } from '@/hooks/useScrollContainer'
import { addDaysISO, describeRelativeDay, formatLongDate, greetingFor, today } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { cn, pluralize } from '@/lib/utils'
import { OPEN_TASK_STATUSES } from '@/constants/status'

/**
 * The default page, in two acts.
 *
 *   Act 1 — the greeting and one oversized field. Nothing to read, nothing to
 *           decide: open the app, type, press Enter.
 *   Act 2 — scroll down and the day is laid out as widgets: the plan, the
 *           meetings, what is due, how far along you are.
 *
 * The hero drifts and fades as the plan comes into view, so the two acts feel
 * like one surface rather than two pages.
 */
export function TodayPage() {
  const date = today()
  const yesterday = addDaysISO(date, -1)

  const { data: tasks = [], isLoading } = useTasksForDate(date)
  const { data: yesterdayTasks = [] } = useTasksForDate(yesterday)
  const { data: meetings = [] } = useMeetingsForDate(date)
  const { data: dashboard } = useDashboard()
  const { data: settings } = useSettings()
  const carryOver = useCarryOverTasks()

  const inputRef = React.useRef<HTMLInputElement>(null)
  const planRef = React.useRef<HTMLElement>(null)
  const scrollContainer = useScrollContainer()
  const fade = useScrollProgress(360)

  const [carriedOver, setCarriedOver] = React.useState(false)

  const planned = tasks.filter((task) => task.isPlanned)
  const unplanned = tasks.filter((task) => !task.isPlanned)
  const completed = tasks.filter((task) => task.status === 'completed').length
  const inProgress = tasks.filter((task) => task.status === 'in_progress').length
  const progress = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0

  const openYesterday = yesterdayTasks.filter((task) => OPEN_TASK_STATUSES.includes(task.status))
  const showCarryOver = !carriedOver && openYesterday.length > 0 && tasks.length === 0

  const dueSoon = (dashboard?.upcomingDeliveries ?? []).slice(0, 4)
  const overdue = dashboard?.overdueDeliveries ?? []

  const name = settings?.userName?.trim()
  const greeting = name && name !== 'Designer' ? `${greetingFor()}, ${name}` : greetingFor()

  const scrollToPlan = () => {
    const container = scrollContainer?.current
    const plan = planRef.current
    if (container && plan) container.scrollTo({ top: plan.offsetTop, behavior: 'smooth' })
  }

  const focusInput = () => {
    scrollContainer?.current?.scrollTo({ top: 0, behavior: 'smooth' })
    window.setTimeout(() => inputRef.current?.focus(), 320)
  }

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      {/* ------------------------------- Act 1 ------------------------------ */}
      <section
        className="relative flex min-h-[calc(100dvh-4rem)] snap-start flex-col items-center justify-center pb-20 md:min-h-[100dvh] md:pb-24"
        aria-label="Daily check-in"
      >
        <div
          className="w-full"
          style={{
            opacity: 1 - fade * 0.85,
            transform: `translateY(${fade * -24}px) scale(${1 - fade * 0.03})`,
          }}
        >
          <div className="animate-rise text-center">
            <p className="text-sm text-muted-foreground">{formatLongDate(date)}</p>
            <h1 className="mt-3 text-display font-semibold">{greeting}</h1>
          </div>

          <div className="mx-auto mt-10 w-full max-w-xl animate-rise [--rise-delay:90ms]">
            <TaskQuickAdd ref={inputRef} date={date} variant="hero" autoFocus />
          </div>

          {showCarryOver && (
            <div className="mt-4 flex animate-rise justify-center [--rise-delay:160ms]">
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                disabled={carryOver.isPending}
                onClick={async () => {
                  await carryOver.mutateAsync({ from: yesterday, to: date })
                  setCarriedOver(true)
                }}
              >
                <CornerDownLeft className="h-3.5 w-3.5" />
                Carry over {pluralize(openYesterday.length, 'task')} from yesterday
              </Button>
            </div>
          )}

          {meetings.length > 0 && (
            <p className="mt-6 animate-rise text-center text-sm text-muted-foreground [--rise-delay:220ms]">
              First up · {meetings[0].meeting.time} {meetings[0].meeting.title}
            </p>
          )}
        </div>

        {/* Scroll affordance — also the day's status at a glance. */}
        <button
          type="button"
          onClick={scrollToPlan}
          className={cn(
            'absolute bottom-24 left-1/2 -translate-x-1/2 rounded-full px-3 py-2 text-xs text-muted-foreground transition-opacity duration-300 ease-fluid hover:text-foreground md:bottom-10',
            fade > 0.1 ? 'pointer-events-none opacity-0' : 'opacity-100',
          )}
        >
          <span className="flex flex-col items-center gap-1">
            {tasks.length > 0
              ? `${pluralize(tasks.length, 'task')} · ${completed} done`
              : 'Nothing planned yet'}
            <ChevronDown className="h-4 w-4 animate-hint-bob" aria-hidden />
          </span>
        </button>
      </section>

      {/* ------------------------------- Act 2 ------------------------------ */}
      <section
        ref={planRef}
        // Full viewport height so the plan can always be scrolled to the top of the
        // screen — a short section would clamp and leave the hero half-visible.
        className="min-h-[100dvh] snap-start pb-28 md:pb-14"
        aria-label="Today's plan"
      >
        <div className="sticky top-0 z-20 -mx-5 mb-4 flex items-center gap-3 bg-background/85 px-5 py-4 backdrop-blur-xl sm:-mx-8 sm:px-8">
          <h2 className="text-lg font-semibold tracking-tight">Today</h2>
          <ProgressPill completed={completed} total={tasks.length} percent={progress} />
          <Button
            variant="ghost"
            size="sm"
            onClick={focusInput}
            className="ml-auto text-muted-foreground"
          >
            <Plus className="h-4 w-4" />
            Add
          </Button>
        </div>

        <WidgetGrid columns={4} align="stretch" className="mb-4">
          <StatTile label="Planned" value={planned.length} icon={ListTodo} />
          <StatTile label="Done" value={completed} icon={CheckCircle2} tone="emerald" />
          <StatTile label="In progress" value={inProgress} icon={CircleDot} tone="brand" />
          <StatTile
            label="Unplanned"
            value={unplanned.length}
            icon={Zap}
            tone={unplanned.length > 0 ? 'amber' : 'default'}
          />
        </WidgetGrid>

        <div className="grid items-start gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <Widget
              title="Plan"
              description={tasks.length > 0 ? pluralize(planned.length, 'task') : undefined}
              icon={ListTodo}
              padded={false}
              contentClassName="px-3 pb-3"
            >
              {isLoading ? (
                <TaskListSkeleton />
              ) : (
                <TaskList
                  tasks={planned}
                  groupByTime
                  emptyState={
                    <EmptyState
                      title="Nothing planned yet"
                      description="Scroll up and type your first task."
                      action={
                        <Button variant="outline" size="sm" onClick={focusInput}>
                          Add a task
                        </Button>
                      }
                    />
                  }
                />
              )}
            </Widget>

            {unplanned.length > 0 && (
              <Widget
                title="Added during the day"
                description={pluralize(unplanned.length, 'task')}
                icon={Zap}
                padded={false}
                contentClassName="px-3 pb-3"
              >
                <TaskList tasks={unplanned} />
              </Widget>
            )}
          </div>

          <div className="space-y-4">
            <Widget
              title="Meetings"
              description={meetings.length > 0 ? pluralize(meetings.length, 'meeting') : undefined}
              icon={CalendarClock}
              padded={false}
              contentClassName="px-3 pb-3"
              action={
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                  <Link to={ROUTES.meetings}>Manage</Link>
                </Button>
              }
            >
              <MeetingList occurrences={meetings} emptyText="Nothing scheduled today." />
            </Widget>

            <Widget
              title="Deliveries"
              description={overdue.length > 0 ? `${overdue.length} late` : 'Next 14 days'}
              icon={Truck}
              padded={false}
              contentClassName="px-3 pb-3"
              action={
                <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
                  <Link to={ROUTES.deliveries}>All</Link>
                </Button>
              }
            >
              {overdue.length === 0 && dueSoon.length === 0 ? (
                <EmptyState compact title="Nothing due soon." />
              ) : (
                <ul className="-mx-2">
                  {[...overdue, ...dueSoon].slice(0, 5).map((delivery) => {
                    const late = overdue.some((item) => item.id === delivery.id)
                    return (
                      <li key={delivery.id}>
                        <Link
                          to={ROUTES.delivery(delivery.id)}
                          className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors duration-200 ease-fluid hover:bg-muted/50"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[15px] leading-snug">{delivery.title}</p>
                            <p
                              className={cn(
                                'text-xs text-muted-foreground',
                                late && 'text-destructive',
                              )}
                            >
                              {late ? 'Late · ' : 'Due '}
                              {delivery.targetDeliveryDate
                                ? describeRelativeDay(delivery.targetDeliveryDate)
                                : '—'}
                            </p>
                          </div>
                          <DeliveryStatusChip status={delivery.status} />
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </Widget>

            {tasks.length > 0 && (
              <Widget bare>
                <Button asChild className="w-full" size="lg">
                  <Link to={ROUTES.review}>
                    <Sparkles className="h-4 w-4" />
                    Review my day
                  </Link>
                </Button>
              </Widget>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

/** Compact progress readout for the sticky header. */
function ProgressPill({
  completed,
  total,
  percent,
}: {
  completed: number
  total: number
  percent: number
}) {
  if (total === 0) return null

  return (
    <span className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-emerald-500 transition-[width] duration-500 ease-fluid"
          style={{ width: `${percent}%` }}
        />
      </span>
      {completed}/{total}
    </span>
  )
}

function TaskListSkeleton() {
  return (
    <div className="space-y-4 p-2">
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex items-start gap-3">
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-[18px] w-[18px] rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
