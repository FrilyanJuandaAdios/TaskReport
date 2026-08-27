import * as React from 'react'
import { Link } from 'react-router-dom'
import { AlertCircle, ArrowUpDown, ExternalLink } from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DeliveryStatusPicker } from '@/components/common/StatusChip'
import { useSetDeliveryStatus } from '@/hooks/useDeliveries'
import { isDeliveryLate } from '@/services/deliveryService'
import { formatShortDate } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { PROJECT_COLOR_CLASSES } from '@/constants/status'
import { byNullableString, cn, sortBy } from '@/lib/utils'
import type { DeliveryWithRelations } from '@/types/domain'

export type DeliverySortKey = 'title' | 'requested' | 'target' | 'status' | 'delivered'

interface DeliveryTableProps {
  deliveries: DeliveryWithRelations[]
}

const COLUMNS: Array<{ key: DeliverySortKey; label: string; className?: string }> = [
  { key: 'title', label: 'Task' },
  { key: 'requested', label: 'Requested', className: 'hidden md:table-cell' },
  { key: 'target', label: 'Target', className: 'hidden sm:table-cell' },
  { key: 'status', label: 'Status' },
  { key: 'delivered', label: 'Delivered', className: 'hidden lg:table-cell' },
]

/**
 * The delivery tracker table.
 *
 * Project and requester ride along under the title instead of taking their own
 * columns — that keeps the row readable on a laptop without horizontal scroll,
 * which is the difference between a table you use and one you avoid.
 */
export function DeliveryTable({ deliveries }: DeliveryTableProps) {
  const [sortKey, setSortKey] = React.useState<DeliverySortKey>('target')
  const [ascending, setAscending] = React.useState(true)
  const setStatus = useSetDeliveryStatus()

  const sorted = React.useMemo(() => {
    const direction = ascending ? 1 : -1
    const comparators: Record<DeliverySortKey, (a: DeliveryWithRelations, b: DeliveryWithRelations) => number> = {
      title: (a, b) => a.title.localeCompare(b.title),
      requested: (a, b) => a.requestedDate.localeCompare(b.requestedDate),
      target: byNullableString<DeliveryWithRelations>((item) => item.targetDeliveryDate),
      status: (a, b) => a.status.localeCompare(b.status),
      delivered: byNullableString<DeliveryWithRelations>((item) => item.actualDeliveryDate),
    }
    return sortBy(deliveries, (a, b) => comparators[sortKey](a, b) * direction)
  }, [deliveries, sortKey, ascending])

  const toggleSort = (key: DeliverySortKey) => {
    if (key === sortKey) setAscending((value) => !value)
    else {
      setSortKey(key)
      setAscending(true)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {COLUMNS.map((column) => (
            <TableHead key={column.key} className={column.className}>
              <button
                type="button"
                onClick={() => toggleSort(column.key)}
                className="inline-flex items-center gap-1 hover:text-foreground"
                aria-label={`Sort by ${column.label}`}
              >
                {column.label}
                <ArrowUpDown
                  className={cn('h-3 w-3', sortKey === column.key ? 'opacity-100' : 'opacity-30')}
                />
              </button>
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {sorted.map((delivery) => {
          const late = isDeliveryLate(delivery)
          return (
            <TableRow key={delivery.id}>
              <TableCell className="max-w-[420px]">
                <Link
                  to={ROUTES.delivery(delivery.id)}
                  className="block truncate text-sm font-medium hover:underline"
                >
                  {delivery.title}
                </Link>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                  {delivery.project && (
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          PROJECT_COLOR_CLASSES[delivery.project.color] ?? 'bg-muted-foreground',
                        )}
                        aria-hidden
                      />
                      {delivery.project.name}
                    </span>
                  )}
                  {delivery.requester && <span>· {delivery.requester.name}</span>}
                  {delivery.taskCount > 0 && <span>· {delivery.taskCount} work logs</span>}
                  {delivery.figmaUrl && (
                    <a
                      href={delivery.figmaUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-0.5 hover:text-foreground"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Figma
                    </a>
                  )}
                </div>
              </TableCell>

              <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground md:table-cell">
                {formatShortDate(delivery.requestedDate)}
              </TableCell>

              <TableCell className="hidden whitespace-nowrap text-sm sm:table-cell">
                <span className={cn('inline-flex items-center gap-1', late && 'text-destructive')}>
                  {late && <AlertCircle className="h-3 w-3" aria-hidden />}
                  {formatShortDate(delivery.targetDeliveryDate)}
                </span>
              </TableCell>

              <TableCell>
                <DeliveryStatusPicker
                  value={delivery.status}
                  onChange={(status) => setStatus.mutate({ id: delivery.id, status })}
                />
              </TableCell>

              <TableCell className="hidden whitespace-nowrap text-sm text-muted-foreground lg:table-cell">
                {formatShortDate(delivery.actualDeliveryDate)}
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
