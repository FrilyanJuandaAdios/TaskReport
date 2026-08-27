import { Check, ChevronDown } from 'lucide-react'
import {
  DELIVERY_STATUS_META,
  PRIORITY_META,
  TASK_STATUS_META,
} from '@/constants/status'
import {
  DELIVERY_STATUSES,
  TASK_STATUSES,
  type DeliveryStatus,
  type Priority,
  type TaskStatus,
} from '@/types/domain'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

/* --------------------------- Read-only chips ------------------------------ */

export function TaskStatusChip({ status, className }: { status: TaskStatus; className?: string }) {
  const meta = TASK_STATUS_META[status]
  return (
    <Badge variant="status" className={cn(meta.chip, className)}>
      {meta.label}
    </Badge>
  )
}

export function DeliveryStatusChip({
  status,
  className,
}: {
  status: DeliveryStatus
  className?: string
}) {
  const meta = DELIVERY_STATUS_META[status]
  return (
    <Badge variant="status" className={cn(meta.chip, className)}>
      {meta.label}
    </Badge>
  )
}

export function PriorityChip({ priority, className }: { priority: Priority; className?: string }) {
  if (priority === 'normal') return null
  const meta = PRIORITY_META[priority]
  return (
    <Badge variant="status" className={cn(meta.chip, className)}>
      {meta.label}
    </Badge>
  )
}

/* --------------------------- Editable chips ------------------------------- */

interface StatusPickerProps<T extends string> {
  value: T
  onChange: (value: T) => void
  disabled?: boolean
  className?: string
}

/**
 * Click the chip, pick a status — the brief's "never open an edit form just to
 * change status". Keyboard accessible via the underlying Radix menu.
 */
export function TaskStatusPicker({
  value,
  onChange,
  disabled,
  className,
}: StatusPickerProps<TaskStatus>) {
  const meta = TASK_STATUS_META[value]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Status: ${meta.label}. Change status`}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-200 ease-fluid hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
          meta.chip,
          className,
        )}
      >
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {TASK_STATUSES.map((status) => (
          <DropdownMenuItem key={status} onSelect={() => onChange(status)}>
            <span className={cn('h-2 w-2 rounded-full', TASK_STATUS_META[status].dot)} />
            <span className="flex-1">{TASK_STATUS_META[status].label}</span>
            {status === value && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export function DeliveryStatusPicker({
  value,
  onChange,
  disabled,
  className,
}: StatusPickerProps<DeliveryStatus>) {
  const meta = DELIVERY_STATUS_META[value]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        aria-label={`Delivery status: ${meta.label}. Change status`}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-medium transition-all duration-200 ease-fluid hover:brightness-95 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50',
          meta.chip,
          className,
        )}
      >
        {meta.label}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {DELIVERY_STATUSES.map((status) => (
          <DropdownMenuItem key={status} onSelect={() => onChange(status)}>
            <span className={cn('h-2 w-2 rounded-full', DELIVERY_STATUS_META[status].dot)} />
            <span className="flex-1">{DELIVERY_STATUS_META[status].label}</span>
            {status === value && <Check className="h-3.5 w-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
