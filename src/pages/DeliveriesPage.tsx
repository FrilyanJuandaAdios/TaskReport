import * as React from 'react'
import { AlertTriangle, CheckCircle2, Clock, Download, Plus, Truck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { FilterBar, type DateRangeValue } from '@/components/common/FilterBar'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { DeliveryTable } from '@/components/deliveries/DeliveryTable'
import { DeliveryFormSheet } from '@/components/deliveries/DeliveryFormSheet'
import { useDeliveries } from '@/hooks/useDeliveries'
import { useProjects, useRequesters } from '@/hooks/useCatalog'
import { useDebouncedValue } from '@/hooks/useAppData'
import { exportDeliveriesExcel } from '@/services/exportService'
import { isDeliveryLate } from '@/services/deliveryService'
import { ACTIVE_DELIVERY_STATUSES, DELIVERY_STATUS_META } from '@/constants/status'
import { DELIVERY_STATUSES } from '@/types/domain'
import { groupBy, pluralize } from '@/lib/utils'
import { toastError } from '@/hooks/useToast'
import type { DeliveryFilter, DeliveryStatus, DeliveryWithRelations } from '@/types/domain'

type GroupBy = 'none' | 'project' | 'requester' | 'status'

/**
 * Delivery tracker: what is in flight, for whom, and whether it is late.
 * Grouping is a view concern, so it happens here rather than in the service.
 */
export function DeliveriesPage() {
  const [query, setQuery] = React.useState('')
  const [statuses, setStatuses] = React.useState<DeliveryStatus[]>([])
  const [projectIds, setProjectIds] = React.useState<string[]>([])
  const [requesterIds, setRequesterIds] = React.useState<string[]>([])
  const [overdueOnly, setOverdueOnly] = React.useState(false)
  const [range, setRange] = React.useState<DateRangeValue>({ from: null, to: null })
  const [grouping, setGrouping] = React.useState<GroupBy>('none')
  const [formOpen, setFormOpen] = React.useState(false)

  const debouncedQuery = useDebouncedValue(query, 200)
  const { data: projects = [] } = useProjects()
  const { data: requesters = [] } = useRequesters()

  const filter = React.useMemo<DeliveryFilter>(
    () => ({
      query: debouncedQuery.trim() || undefined,
      statuses: statuses.length > 0 ? statuses : undefined,
      projectIds: projectIds.length > 0 ? projectIds : undefined,
      requesterIds: requesterIds.length > 0 ? requesterIds : undefined,
      overdueOnly: overdueOnly || undefined,
      from: range.from ?? undefined,
      to: range.to ?? undefined,
    }),
    [debouncedQuery, statuses, projectIds, requesterIds, overdueOnly, range],
  )

  const { data: deliveries = [], isLoading } = useDeliveries(filter)
  // Counters describe the whole tracker, not the current filter — otherwise
  // they would change every keystroke and stop being a reference point.
  const { data: allDeliveries = [] } = useDeliveries({})

  const counts = React.useMemo(
    () => ({
      active: allDeliveries.filter((item) => ACTIVE_DELIVERY_STATUSES.includes(item.status)).length,
      waiting: allDeliveries.filter((item) => item.status === 'waiting_feedback').length,
      late: allDeliveries.filter(isDeliveryLate).length,
      delivered: allDeliveries.filter((item) => item.status === 'delivered').length,
    }),
    [allDeliveries],
  )

  const groups = React.useMemo(() => {
    if (grouping === 'none') return null
    const keyFor = (delivery: DeliveryWithRelations) => {
      if (grouping === 'project') return delivery.project?.name ?? 'No project'
      if (grouping === 'requester') return delivery.requester?.name ?? 'No requester'
      return DELIVERY_STATUS_META[delivery.status].label
    }
    const grouped = groupBy(deliveries, keyFor)
    return Object.keys(grouped)
      .sort((a, b) => a.localeCompare(b))
      .map((key) => ({ key, items: grouped[key] }))
  }, [deliveries, grouping])

  const reset = () => {
    setStatuses([])
    setProjectIds([])
    setRequesterIds([])
    setOverdueOnly(false)
    setRange({ from: null, to: null })
  }

  const exportAll = async () => {
    try {
      await exportDeliveriesExcel(filter)
    } catch (error) {
      toastError(error, 'Export failed.')
    }
  }

  return (
    <Page className="space-y-4">
      <PageHeader
        title="Deliveries"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={exportAll}
              disabled={deliveries.length === 0}
            >
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" />
              New delivery
            </Button>
          </>
        }
      />

      <WidgetGrid columns={4} align="stretch">
        <StatTile
          label="Active"
          value={counts.active}
          icon={Truck}
          tone="brand"
          onClick={() => {
            reset()
            setStatuses([...ACTIVE_DELIVERY_STATUSES])
          }}
        />
        <StatTile
          label="Waiting feedback"
          value={counts.waiting}
          icon={Clock}
          onClick={() => {
            reset()
            setStatuses(['waiting_feedback'])
          }}
        />
        <StatTile
          label="Late"
          value={counts.late}
          icon={AlertTriangle}
          tone={counts.late > 0 ? 'amber' : 'default'}
          onClick={() => {
            reset()
            setOverdueOnly(true)
          }}
        />
        <StatTile
          label="Delivered"
          value={counts.delivered}
          icon={CheckCircle2}
          tone="emerald"
          onClick={() => {
            reset()
            setStatuses(['delivered'])
          }}
        />
      </WidgetGrid>

      <Widget
        title="Tracker"
        description={pluralize(deliveries.length, 'delivery', 'deliveries')}
        icon={Truck}
        contentClassName="space-y-4"
      >
        <FilterBar
          query={query}
          onQueryChange={setQuery}
          searchPlaceholder="Search deliveries…"
          onReset={reset}
          dateRange={{ value: range, onChange: setRange }}
          facets={[
            {
              key: 'status',
              label: 'Status',
              selected: statuses,
              onChange: (values) => setStatuses(values as DeliveryStatus[]),
              options: DELIVERY_STATUSES.map((status) => ({
                value: status,
                label: DELIVERY_STATUS_META[status].label,
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
          ]}
        >
          <Button
            variant={overdueOnly ? 'secondary' : 'outline'}
            onClick={() => setOverdueOnly((value) => !value)}
            aria-pressed={overdueOnly}
          >
            Late only
          </Button>

          <Select value={grouping} onValueChange={(value) => setGrouping(value as GroupBy)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Group by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No grouping</SelectItem>
              <SelectItem value="project">By project</SelectItem>
              <SelectItem value="requester">By requester</SelectItem>
              <SelectItem value="status">By status</SelectItem>
            </SelectContent>
          </Select>
        </FilterBar>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : deliveries.length === 0 ? (
          <EmptyState
            icon={Truck}
            title="No deliveries here"
            description="Create one when a stakeholder asks for something, then link your daily tasks to it."
            action={
              <Button variant="outline" size="sm" onClick={() => setFormOpen(true)}>
                <Plus className="h-4 w-4" />
                New delivery
              </Button>
            }
          />
        ) : groups ? (
          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.key} className="space-y-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                  {group.key} · {group.items.length}
                </p>
                <DeliveryTable deliveries={group.items} />
              </section>
            ))}
          </div>
        ) : (
          <DeliveryTable deliveries={deliveries} />
        )}
      </Widget>

      <DeliveryFormSheet delivery={null} open={formOpen} onOpenChange={setFormOpen} />
    </Page>
  )
}
