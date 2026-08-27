import type { DeliveryStatus, Priority, TaskStatus } from '@/types/domain'

/**
 * Every status label, colour and ordering lives here — never inline a status
 * string or a colour class inside a component.
 *
 * Colour budget: four families total.
 *   neutral  nothing to do yet, or closed without action
 *   brand    actively moving
 *   amber    needs someone / stuck
 *   emerald  done
 * Anything beyond that turns a work list into a colour chart.
 */

/** Chip recipes, so a tint is defined once and reused across both enums. */
const TINT = {
  neutral: 'bg-muted text-muted-foreground',
  faint: 'bg-transparent text-muted-foreground/70',
  brand: 'bg-brand/10 text-brand',
  amber: 'bg-amber-500/12 text-amber-700 dark:text-amber-400',
  emerald: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-400',
} as const

const DOT = {
  neutral: 'bg-muted-foreground/40',
  faint: 'bg-muted-foreground/25',
  brand: 'bg-brand',
  amber: 'bg-amber-500',
  emerald: 'bg-emerald-500',
} as const

export interface StatusMeta<T extends string> {
  value: T
  label: string
  chip: string
  dot: string
}

export const TASK_STATUS_META: Record<TaskStatus, StatusMeta<TaskStatus>> = {
  planned: { value: 'planned', label: 'Planned', chip: TINT.neutral, dot: DOT.neutral },
  in_progress: { value: 'in_progress', label: 'In progress', chip: TINT.brand, dot: DOT.brand },
  completed: { value: 'completed', label: 'Done', chip: TINT.emerald, dot: DOT.emerald },
  blocked: { value: 'blocked', label: 'Blocked', chip: TINT.amber, dot: DOT.amber },
  cancelled: { value: 'cancelled', label: 'Cancelled', chip: TINT.faint, dot: DOT.faint },
}

export const DELIVERY_STATUS_META: Record<DeliveryStatus, StatusMeta<DeliveryStatus>> = {
  not_started: { value: 'not_started', label: 'Not started', chip: TINT.neutral, dot: DOT.neutral },
  in_progress: { value: 'in_progress', label: 'In progress', chip: TINT.brand, dot: DOT.brand },
  waiting_feedback: {
    value: 'waiting_feedback',
    label: 'Waiting feedback',
    chip: TINT.amber,
    dot: DOT.amber,
  },
  revision: { value: 'revision', label: 'Revision', chip: TINT.amber, dot: DOT.amber },
  ready_to_deliver: {
    value: 'ready_to_deliver',
    label: 'Ready to deliver',
    chip: TINT.brand,
    dot: DOT.brand,
  },
  delivered: { value: 'delivered', label: 'Delivered', chip: TINT.emerald, dot: DOT.emerald },
  on_hold: { value: 'on_hold', label: 'On hold', chip: TINT.faint, dot: DOT.faint },
}

export const PRIORITY_META: Record<Priority, StatusMeta<Priority>> = {
  low: { value: 'low', label: 'Low', chip: TINT.faint, dot: DOT.faint },
  normal: { value: 'normal', label: 'Normal', chip: TINT.neutral, dot: DOT.neutral },
  high: { value: 'high', label: 'High', chip: TINT.amber, dot: DOT.amber },
  urgent: { value: 'urgent', label: 'Urgent', chip: TINT.amber, dot: DOT.amber },
}

/**
 * Statuses whose chip carries no information a glance at the row does not
 * already give. Hiding these is what keeps a day's list quiet.
 */
export const IMPLIED_TASK_STATUSES: TaskStatus[] = ['planned', 'completed']

/** Statuses that count as "still open" for dashboards and carry-over prompts. */
export const OPEN_TASK_STATUSES: TaskStatus[] = ['planned', 'in_progress', 'blocked']

/** Delivery statuses that still need attention from the designer. */
export const ACTIVE_DELIVERY_STATUSES: DeliveryStatus[] = [
  'not_started',
  'in_progress',
  'waiting_feedback',
  'revision',
  'ready_to_deliver',
]

/** Accent tokens available to projects — one dot per project, nothing louder. */
export const PROJECT_COLORS = [
  'slate',
  'blue',
  'emerald',
  'violet',
  'amber',
  'rose',
  'teal',
  'orange',
] as const
export type ProjectColor = (typeof PROJECT_COLORS)[number]

export const PROJECT_COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-slate-400',
  blue: 'bg-blue-400',
  emerald: 'bg-emerald-400',
  violet: 'bg-violet-400',
  amber: 'bg-amber-400',
  rose: 'bg-rose-400',
  teal: 'bg-teal-400',
  orange: 'bg-orange-400',
}
