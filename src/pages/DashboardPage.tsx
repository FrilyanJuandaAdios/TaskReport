import { Link } from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDot,
  Clock,
  PieChart,
  Truck,
  Zap,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ActivityTimeline } from '@/components/common/ActivityTimeline'
import { DeliveryStatusChip } from '@/components/common/StatusChip'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { useDashboard } from '@/hooks/useAppData'
import { ROUTES } from '@/constants/navigation'
import { describeRelativeDay, formatMediumDate } from '@/lib/date'
import { PROJECT_COLOR_CLASSES } from '@/constants/status'
import { cn, pluralize } from '@/lib/utils'
import type { DeliveryWithRelations } from '@/types/domain'

/**
 * Secondary overview — deliberately not the landing page.
 * Every block answers "what needs my attention", not "how productive am I".
 */
export function DashboardPage() {
  const { data, isLoading } = useDashboard()

  if (isLoading || !data) {
    return (
      <Page className="space-y-4">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-72 w-full" />
      </Page>
    )
  }

  const maxWorkload = Math.max(1, ...data.workload.map((slice) => slice.total))

  return (
    <Page className="space-y-4">
      <PageHeader
        title="Dashboard"
        description={`${formatMediumDate(data.week.from)} – ${formatMediumDate(data.week.to)}`}
      />

      <WidgetGrid columns={4} align="stretch" className="glass-soft rounded-[22px] px-2 py-1">
        <StatTile
          label="Completed"
          value={data.counters.completed}
          icon={CheckCircle2}
          tone="emerald"
          hint="This week"
        />
        <StatTile
          label="In progress"
          value={data.counters.inProgress}
          icon={CircleDot}
          tone="brand"
          hint="This week"
        />
        <StatTile
          label="Unplanned"
          value={data.counters.unplanned}
          icon={Zap}
          tone={data.counters.unplanned > 0 ? 'amber' : 'default'}
          hint="Arrived mid-day"
        />
        <StatTile
          label="Deliveries due"
          value={data.counters.deliveriesDue}
          icon={Truck}
          hint="Next 14 days"
        />
      </WidgetGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {data.overdueDeliveries.length > 0 && (
            <Widget
              title="Overdue"
              description={pluralize(data.overdueDeliveries.length, 'delivery', 'deliveries')}
              icon={AlertTriangle}
              padded={false}
              contentClassName="px-3 pb-3"
            >
              <DeliveryLines deliveries={data.overdueDeliveries} overdue />
            </Widget>
          )}

          <Widget
            title="Upcoming delivery"
            description="Next 14 days"
            icon={Truck}
            padded={false}
            contentClassName="px-3 pb-3"
          >
            {data.upcomingDeliveries.length === 0 ? (
              <EmptyState compact title="Nothing due in the next two weeks." />
            ) : (
              <DeliveryLines deliveries={data.upcomingDeliveries} />
            )}
          </Widget>

          <Widget title="Waiting feedback" icon={Clock} padded={false} contentClassName="px-3 pb-3">
            {data.waitingFeedback.length === 0 ? (
              <EmptyState compact title="Nothing is waiting on someone else." />
            ) : (
              <DeliveryLines deliveries={data.waitingFeedback} />
            )}
          </Widget>
        </div>

        <div className="space-y-4">
          <Widget title="Workload by project" description="This week" icon={PieChart}>
            {data.workload.length === 0 ? (
              <EmptyState compact title="No tasks logged this week yet." />
            ) : (
              <ul className="space-y-3">
                {data.workload.map((slice) => (
                  <li key={slice.project?.id ?? 'none'} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className={cn(
                            'h-2 w-2 shrink-0 rounded-full',
                            slice.project
                              ? (PROJECT_COLOR_CLASSES[slice.project.color] ??
                                'bg-muted-foreground')
                              : 'bg-muted-foreground/40',
                          )}
                          aria-hidden
                        />
                        <span className="truncate">{slice.project?.name ?? 'No project'}</span>
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {slice.completed}/{slice.total}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-foreground/25 transition-[width] duration-500 ease-fluid"
                        style={{ width: `${(slice.total / maxWorkload) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Widget>

          <Widget title="Recent activity" icon={Activity}>
            <ActivityTimeline entries={data.recentActivity} />
          </Widget>
        </div>
      </div>
    </Page>
  )
}

function DeliveryLines({
  deliveries,
  overdue,
}: {
  deliveries: DeliveryWithRelations[]
  overdue?: boolean
}) {
  return (
    <ul className="-mx-2">
      {deliveries.map((delivery) => (
        <li key={delivery.id}>
          <Link
            to={ROUTES.delivery(delivery.id)}
            className="group flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-200 ease-fluid hover:bg-muted/50"
          >
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="break-words text-[15px] leading-snug">{delivery.title}</p>
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                {delivery.project && <span>{delivery.project.name}</span>}
                {delivery.requester && <span>· {delivery.requester.name}</span>}
                {delivery.targetDeliveryDate && (
                  <span className={cn(overdue && 'text-destructive')}>
                    · {overdue ? 'Late · ' : 'Target '}
                    {describeRelativeDay(delivery.targetDeliveryDate)}
                  </span>
                )}
              </p>
            </div>
            <DeliveryStatusChip status={delivery.status} />
            <ArrowRight
              className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 ease-fluid group-hover:translate-x-0.5"
              aria-hidden
            />
          </Link>
        </li>
      ))}
    </ul>
  )
}
