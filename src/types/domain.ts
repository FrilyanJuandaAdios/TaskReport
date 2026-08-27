/**
 * Domain model — the single source of truth for every entity in the app.
 *
 * Conventions:
 * - `ISODate`     = calendar day, `YYYY-MM-DD`, always in the user's local timezone.
 *                   Used as the natural key for "which day did this happen".
 * - `ISODateTime` = full instant, `new Date().toISOString()`. Used for audit stamps.
 * - `HHmm`        = wall-clock time of day, `"09:00"`. Never a Date, never a timezone.
 *
 * Every entity is a plain, serialisable object so that the exact same shape can be
 * stored in IndexedDB, sent to Postgres, or written to a JSON backup file.
 */

export type ID = string
export type ISODate = string
export type ISODateTime = string
export type HHmm = string

/* -------------------------------------------------------------------------- */
/* Enums                                                                       */
/* -------------------------------------------------------------------------- */

export const TASK_STATUSES = [
  'planned',
  'in_progress',
  'completed',
  'blocked',
  'cancelled',
] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const DELIVERY_STATUSES = [
  'not_started',
  'in_progress',
  'waiting_feedback',
  'revision',
  'ready_to_deliver',
  'delivered',
  'on_hold',
] as const
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number]

export const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const
export type Priority = (typeof PRIORITIES)[number]

export const PROJECT_STATUSES = ['active', 'archived'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

/**
 * How often a meeting repeats.
 *  daily     every calendar day
 *  weekdays  Monday–Friday
 *  weekly    the ISO weekdays listed in `Meeting.weekdays`
 *  once      a single `Meeting.date`
 */
export const MEETING_RECURRENCES = ['daily', 'weekdays', 'weekly', 'once'] as const
export type MeetingRecurrence = (typeof MEETING_RECURRENCES)[number]

export const MEETING_STATUSES = ['scheduled', 'attended', 'skipped', 'cancelled'] as const
export type MeetingStatus = (typeof MEETING_STATUSES)[number]

export const ACTIVITY_ACTIONS = [
  'task.created',
  'task.started',
  'task.completed',
  'task.reopened',
  'task.blocked',
  'task.cancelled',
  'task.updated',
  'task.deleted',
  'delivery.created',
  'delivery.updated',
  'delivery.status_changed',
  'delivery.delivered',
  'delivery.revised',
  'delivery.deleted',
  'report.created',
  'report.updated',
  'report.exported',
  'report.synced_notion',
  'meeting.created',
  'meeting.updated',
  'meeting.deleted',
  'meeting.attended',
  'meeting.skipped',
] as const
export type ActivityAction = (typeof ACTIVITY_ACTIONS)[number]

export type ActivityEntity =
  | 'task'
  | 'delivery'
  | 'report'
  | 'project'
  | 'requester'
  | 'meeting'

/* -------------------------------------------------------------------------- */
/* Entities                                                                    */
/* -------------------------------------------------------------------------- */

/** Fields every persisted row carries, for audit + conflict resolution. */
export interface BaseEntity {
  id: ID
  createdAt: ISODateTime
  updatedAt: ISODateTime
}

export interface Project extends BaseEntity {
  name: string
  /** Short code shown in dense metadata rows, e.g. "CSM". */
  code: string
  description?: string
  /** Tailwind-safe pastel token key, see PROJECT_COLORS. */
  color: string
  status: ProjectStatus
}

export interface Requester extends BaseEntity {
  name: string
  team?: string
  email?: string
  notes?: string
  /** Marks the built-in "Self Initiated" pseudo-requester so it cannot be deleted. */
  isSelf?: boolean
}

export interface Tag extends BaseEntity {
  name: string
  color?: string
}

export interface Task extends BaseEntity {
  title: string
  description?: string
  /** The work-day this task belongs to. Drives Today, History and reports. */
  date: ISODate
  /** Optional intended start, e.g. "09:00". Null => "Anytime today". */
  plannedTime?: HHmm | null
  startTime?: HHmm | null
  endTime?: HHmm | null
  status: TaskStatus
  /**
   * Lightweight per-task due date ("Deliver Aug 28" in the Today list).
   * Independent of `deliveryId`: not every task worth a due date deserves a
   * full Delivery record. When both exist the Delivery target wins in the UI.
   */
  targetDate?: ISODate | null
  /**
   * true  = written down during the morning check-in.
   * false = arrived mid-day (the "Added during the day" bucket).
   */
  isPlanned: boolean
  priority: Priority
  projectId?: ID | null
  requesterId?: ID | null
  deliveryId?: ID | null
  tagIds: ID[]
  notes?: string
  /** Audit stamps — kept even if the status later changes again. */
  startedAt?: ISODateTime | null
  completedAt?: ISODateTime | null
  /** Manual ordering inside a day. Lower sorts first. */
  order: number
}

export interface Delivery extends BaseEntity {
  title: string
  description?: string
  projectId?: ID | null
  requesterId?: ID | null
  requestedDate: ISODate
  targetDeliveryDate?: ISODate | null
  actualDeliveryDate?: ISODate | null
  status: DeliveryStatus
  figmaUrl?: string
  ticketUrl?: string
  referenceUrl?: string
  notes?: string
  tagIds: ID[]
  deliveredAt?: ISODateTime | null
  /** Incremented every time the delivery goes back to `revision`. */
  revisionCount: number
}

/**
 * A recurring (or one-off) meeting in the working week — the daily stand-up, a
 * weekly design sync, a client call.
 *
 * A Meeting is a *schedule*, not an event: it holds the rule, and
 * `MeetingLog` records what actually happened on a given day. That split is
 * what keeps "every weekday at 09:15" as one row instead of 250 a year.
 */
export interface Meeting extends BaseEntity {
  title: string
  time: HHmm
  durationMinutes: number
  recurrence: MeetingRecurrence
  /** ISO weekdays (1 = Monday … 7 = Sunday). Only read when recurrence is `weekly`. */
  weekdays: number[]
  /** The single occurrence, when recurrence is `once`. */
  date?: ISODate | null
  /** Optional window; the schedule does not apply outside it. */
  startDate?: ISODate | null
  endDate?: ISODate | null
  projectId?: ID | null
  requesterId?: ID | null
  /** Meet / Zoom / Teams link. */
  link?: string
  notes?: string
  /** Paused schedules keep their history but stop appearing on Today. */
  isActive: boolean
}

/** What happened on one date for one meeting. Absent means "not touched yet". */
export interface MeetingLog extends BaseEntity {
  meetingId: ID
  date: ISODate
  status: MeetingStatus
  notes?: string
}

export interface DailyReport extends BaseEntity {
  /** One report per calendar day — `date` is unique. */
  date: ISODate
  issues: string
  nextSteps: string
  notes: string
  /**
   * Snapshot of the counters at generation time, so a report stays truthful even
   * if tasks are edited later. Recomputed on demand when the report is re-opened.
   */
  summary: DailyReportSummary
  /** Free-text override of the generated body. Empty => render from live tasks. */
  bodyOverride?: string
  syncedToNotionAt?: ISODateTime | null
  notionPageUrl?: string | null
}

export interface DailyReportSummary {
  planned: number
  completed: number
  inProgress: number
  blocked: number
  cancelled: number
  unplanned: number
  total: number
}

export interface ActivityLog {
  id: ID
  entity: ActivityEntity
  entityId: ID
  action: ActivityAction
  /** Human-readable one-liner, pre-rendered so the timeline needs no joins. */
  message: string
  at: ISODateTime
  meta?: Record<string, string | number | boolean | null>
}

export interface AppSettings {
  id: 'settings'
  userName: string
  workdayStart: HHmm
  workdayEnd: HHmm
  theme: 'light' | 'dark' | 'system'
  morningReminderEnabled: boolean
  morningReminderTime: HHmm
  eveningReminderEnabled: boolean
  eveningReminderTime: HHmm
  updatedAt: ISODateTime
}

/* -------------------------------------------------------------------------- */
/* Read models (entities joined for display)                                   */
/* -------------------------------------------------------------------------- */

export interface TaskWithRelations extends Task {
  project: Project | null
  requester: Requester | null
  delivery: Delivery | null
  tags: Tag[]
}

export interface DeliveryWithRelations extends Delivery {
  project: Project | null
  requester: Requester | null
  tags: Tag[]
  taskCount: number
}

export interface MeetingWithRelations extends Meeting {
  project: Project | null
  requester: Requester | null
}

/** One meeting resolved against one calendar day. */
export interface MeetingOccurrence {
  date: ISODate
  meeting: MeetingWithRelations
  status: MeetingStatus
  log: MeetingLog | null
}

export interface DaySummary {
  date: ISODate
  total: number
  completed: number
  inProgress: number
  blocked: number
  unplanned: number
  meetings: number
  hasReport: boolean
}

/* -------------------------------------------------------------------------- */
/* Input payloads                                                              */
/* -------------------------------------------------------------------------- */

export type CreateTaskInput = {
  title: string
  date: ISODate
} & Partial<
  Pick<
    Task,
    | 'description'
    | 'plannedTime'
    | 'targetDate'
    | 'status'
    | 'isPlanned'
    | 'priority'
    | 'projectId'
    | 'requesterId'
    | 'deliveryId'
    | 'tagIds'
    | 'notes'
    | 'order'
  >
>

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>

export type CreateDeliveryInput = {
  title: string
  requestedDate: ISODate
} & Partial<Omit<Delivery, 'id' | 'createdAt' | 'updatedAt' | 'title' | 'requestedDate'>>

export type UpdateDeliveryInput = Partial<Omit<Delivery, 'id' | 'createdAt' | 'updatedAt'>>

export type UpsertDailyReportInput = {
  date: ISODate
  issues: string
  nextSteps: string
  notes: string
  bodyOverride?: string
}

export type CreateProjectInput = Pick<Project, 'name'> &
  Partial<Pick<Project, 'code' | 'description' | 'color' | 'status'>>

export type CreateRequesterInput = Pick<Requester, 'name'> &
  Partial<Pick<Requester, 'team' | 'email' | 'notes'>>

export type CreateMeetingInput = Pick<Meeting, 'title' | 'time'> &
  Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt' | 'title' | 'time'>>

export type UpdateMeetingInput = Partial<Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>>

/* -------------------------------------------------------------------------- */
/* Query filters                                                               */
/* -------------------------------------------------------------------------- */

export interface TaskFilter {
  from?: ISODate
  to?: ISODate
  projectIds?: ID[]
  requesterIds?: ID[]
  statuses?: TaskStatus[]
  tagIds?: ID[]
  deliveryId?: ID
  isPlanned?: boolean
  /** Case-insensitive match against title, description and notes. */
  query?: string
}

export interface DeliveryFilter {
  statuses?: DeliveryStatus[]
  projectIds?: ID[]
  requesterIds?: ID[]
  tagIds?: ID[]
  from?: ISODate
  to?: ISODate
  /** Only deliveries whose target date passed without an actual delivery date. */
  overdueOnly?: boolean
  query?: string
}
