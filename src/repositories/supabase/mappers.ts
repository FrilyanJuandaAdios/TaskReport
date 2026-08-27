import type {
  ActivityLog,
  AppSettings,
  DailyReport,
  DailyReportSummary,
  Delivery,
  DeliveryStatus,
  Meeting,
  MeetingLog,
  MeetingRecurrence,
  MeetingStatus,
  Project,
  ProjectStatus,
  Requester,
  Tag,
  Task,
  TaskStatus,
} from '@/types/domain'

/**
 * Row <-> domain mapping for the Postgres driver.
 *
 * Postgres columns are snake_case (SQL convention), the domain is camelCase
 * (TS convention). Keeping the translation in one file means a column rename is
 * a one-line change instead of a repo-wide find/replace.
 */

export interface TaskRow {
  id: string
  title: string
  description: string | null
  date: string
  planned_time: string | null
  start_time: string | null
  end_time: string | null
  status: TaskStatus
  target_date: string | null
  is_planned: boolean
  priority: Task['priority']
  project_id: string | null
  requester_id: string | null
  delivery_id: string | null
  notes: string | null
  started_at: string | null
  completed_at: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

export interface DeliveryRow {
  id: string
  title: string
  description: string | null
  project_id: string | null
  requester_id: string | null
  requested_date: string
  target_delivery_date: string | null
  actual_delivery_date: string | null
  status: DeliveryStatus
  figma_url: string | null
  ticket_url: string | null
  reference_url: string | null
  notes: string | null
  delivered_at: string | null
  revision_count: number
  created_at: string
  updated_at: string
}

export interface DailyReportRow {
  id: string
  date: string
  issues: string
  next_steps: string
  notes: string
  summary: DailyReportSummary
  body_override: string | null
  synced_to_notion_at: string | null
  notion_page_url: string | null
  created_at: string
  updated_at: string
}

export interface MeetingRow {
  id: string
  title: string
  time: string
  duration_minutes: number
  recurrence: MeetingRecurrence
  weekdays: number[]
  date: string | null
  start_date: string | null
  end_date: string | null
  project_id: string | null
  requester_id: string | null
  link: string | null
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface MeetingLogRow {
  id: string
  meeting_id: string
  date: string
  status: MeetingStatus
  notes: string | null
  created_at: string
  updated_at: string
}

export interface ProjectRow {
  id: string
  name: string
  code: string
  description: string | null
  color: string
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface RequesterRow {
  id: string
  name: string
  team: string | null
  email: string | null
  notes: string | null
  is_self: boolean
  created_at: string
  updated_at: string
}

export interface TagRow {
  id: string
  name: string
  color: string | null
  created_at: string
  updated_at: string
}

export interface ActivityRow {
  id: string
  entity: ActivityLog['entity']
  entity_id: string
  action: ActivityLog['action']
  message: string
  at: string
  meta: ActivityLog['meta'] | null
}

export interface SettingsRow {
  id: string
  user_name: string
  workday_start: string
  workday_end: string
  theme: AppSettings['theme']
  morning_reminder_enabled: boolean
  morning_reminder_time: string
  evening_reminder_enabled: boolean
  evening_reminder_time: string
  updated_at: string
}

/* ----------------------------- Row -> domain ------------------------------ */

export function toTask(row: TaskRow, tagIds: string[] = []): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    date: row.date,
    plannedTime: row.planned_time,
    startTime: row.start_time,
    endTime: row.end_time,
    status: row.status,
    targetDate: row.target_date,
    isPlanned: row.is_planned,
    priority: row.priority,
    projectId: row.project_id,
    requesterId: row.requester_id,
    deliveryId: row.delivery_id,
    tagIds,
    notes: row.notes ?? undefined,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toDelivery(row: DeliveryRow, tagIds: string[] = []): Delivery {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    projectId: row.project_id,
    requesterId: row.requester_id,
    requestedDate: row.requested_date,
    targetDeliveryDate: row.target_delivery_date,
    actualDeliveryDate: row.actual_delivery_date,
    status: row.status,
    figmaUrl: row.figma_url ?? undefined,
    ticketUrl: row.ticket_url ?? undefined,
    referenceUrl: row.reference_url ?? undefined,
    notes: row.notes ?? undefined,
    tagIds,
    deliveredAt: row.delivered_at,
    revisionCount: row.revision_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toDailyReport(row: DailyReportRow): DailyReport {
  return {
    id: row.id,
    date: row.date,
    issues: row.issues,
    nextSteps: row.next_steps,
    notes: row.notes,
    summary: row.summary,
    bodyOverride: row.body_override ?? undefined,
    syncedToNotionAt: row.synced_to_notion_at,
    notionPageUrl: row.notion_page_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toMeeting(row: MeetingRow): Meeting {
  return {
    id: row.id,
    title: row.title,
    time: row.time,
    durationMinutes: row.duration_minutes,
    recurrence: row.recurrence,
    weekdays: row.weekdays ?? [],
    date: row.date,
    startDate: row.start_date,
    endDate: row.end_date,
    projectId: row.project_id,
    requesterId: row.requester_id,
    link: row.link ?? undefined,
    notes: row.notes ?? undefined,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toMeetingLog(row: MeetingLogRow): MeetingLog {
  return {
    id: row.id,
    meetingId: row.meeting_id,
    date: row.date,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description ?? undefined,
    color: row.color,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toRequester(row: RequesterRow): Requester {
  return {
    id: row.id,
    name: row.name,
    team: row.team ?? undefined,
    email: row.email ?? undefined,
    notes: row.notes ?? undefined,
    isSelf: row.is_self,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toTag(row: TagRow): Tag {
  return {
    id: row.id,
    name: row.name,
    color: row.color ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toActivity(row: ActivityRow): ActivityLog {
  return {
    id: row.id,
    entity: row.entity,
    entityId: row.entity_id,
    action: row.action,
    message: row.message,
    at: row.at,
    meta: row.meta ?? undefined,
  }
}

export function toSettings(row: SettingsRow): AppSettings {
  return {
    id: 'settings',
    userName: row.user_name,
    workdayStart: row.workday_start,
    workdayEnd: row.workday_end,
    theme: row.theme,
    morningReminderEnabled: row.morning_reminder_enabled,
    morningReminderTime: row.morning_reminder_time,
    eveningReminderEnabled: row.evening_reminder_enabled,
    eveningReminderTime: row.evening_reminder_time,
    updatedAt: row.updated_at,
  }
}

/* ----------------------------- Domain -> row ------------------------------ */

/** Only the keys present in `patch` are emitted, so partial updates stay partial. */
export function fromTask(patch: Partial<Task>): Partial<TaskRow> {
  const row: Partial<TaskRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('title' in patch) row.title = patch.title
  if ('description' in patch) row.description = patch.description ?? null
  if ('date' in patch) row.date = patch.date
  if ('plannedTime' in patch) row.planned_time = patch.plannedTime ?? null
  if ('startTime' in patch) row.start_time = patch.startTime ?? null
  if ('endTime' in patch) row.end_time = patch.endTime ?? null
  if ('status' in patch) row.status = patch.status
  if ('targetDate' in patch) row.target_date = patch.targetDate ?? null
  if ('isPlanned' in patch) row.is_planned = patch.isPlanned
  if ('priority' in patch) row.priority = patch.priority
  if ('projectId' in patch) row.project_id = patch.projectId ?? null
  if ('requesterId' in patch) row.requester_id = patch.requesterId ?? null
  if ('deliveryId' in patch) row.delivery_id = patch.deliveryId ?? null
  if ('notes' in patch) row.notes = patch.notes ?? null
  if ('startedAt' in patch) row.started_at = patch.startedAt ?? null
  if ('completedAt' in patch) row.completed_at = patch.completedAt ?? null
  if ('order' in patch) row.sort_order = patch.order
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromDelivery(patch: Partial<Delivery>): Partial<DeliveryRow> {
  const row: Partial<DeliveryRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('title' in patch) row.title = patch.title
  if ('description' in patch) row.description = patch.description ?? null
  if ('projectId' in patch) row.project_id = patch.projectId ?? null
  if ('requesterId' in patch) row.requester_id = patch.requesterId ?? null
  if ('requestedDate' in patch) row.requested_date = patch.requestedDate
  if ('targetDeliveryDate' in patch) row.target_delivery_date = patch.targetDeliveryDate ?? null
  if ('actualDeliveryDate' in patch) row.actual_delivery_date = patch.actualDeliveryDate ?? null
  if ('status' in patch) row.status = patch.status
  if ('figmaUrl' in patch) row.figma_url = patch.figmaUrl ?? null
  if ('ticketUrl' in patch) row.ticket_url = patch.ticketUrl ?? null
  if ('referenceUrl' in patch) row.reference_url = patch.referenceUrl ?? null
  if ('notes' in patch) row.notes = patch.notes ?? null
  if ('deliveredAt' in patch) row.delivered_at = patch.deliveredAt ?? null
  if ('revisionCount' in patch) row.revision_count = patch.revisionCount
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromDailyReport(patch: Partial<DailyReport>): Partial<DailyReportRow> {
  const row: Partial<DailyReportRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('date' in patch) row.date = patch.date
  if ('issues' in patch) row.issues = patch.issues
  if ('nextSteps' in patch) row.next_steps = patch.nextSteps
  if ('notes' in patch) row.notes = patch.notes
  if ('summary' in patch) row.summary = patch.summary
  if ('bodyOverride' in patch) row.body_override = patch.bodyOverride ?? null
  if ('syncedToNotionAt' in patch) row.synced_to_notion_at = patch.syncedToNotionAt ?? null
  if ('notionPageUrl' in patch) row.notion_page_url = patch.notionPageUrl ?? null
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromMeeting(patch: Partial<Meeting>): Partial<MeetingRow> {
  const row: Partial<MeetingRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('title' in patch) row.title = patch.title
  if ('time' in patch) row.time = patch.time
  if ('durationMinutes' in patch) row.duration_minutes = patch.durationMinutes
  if ('recurrence' in patch) row.recurrence = patch.recurrence
  if ('weekdays' in patch) row.weekdays = patch.weekdays
  if ('date' in patch) row.date = patch.date ?? null
  if ('startDate' in patch) row.start_date = patch.startDate ?? null
  if ('endDate' in patch) row.end_date = patch.endDate ?? null
  if ('projectId' in patch) row.project_id = patch.projectId ?? null
  if ('requesterId' in patch) row.requester_id = patch.requesterId ?? null
  if ('link' in patch) row.link = patch.link ?? null
  if ('notes' in patch) row.notes = patch.notes ?? null
  if ('isActive' in patch) row.is_active = patch.isActive
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromMeetingLog(patch: Partial<MeetingLog>): Partial<MeetingLogRow> {
  const row: Partial<MeetingLogRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('meetingId' in patch) row.meeting_id = patch.meetingId
  if ('date' in patch) row.date = patch.date
  if ('status' in patch) row.status = patch.status
  if ('notes' in patch) row.notes = patch.notes ?? null
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromProject(patch: Partial<Project>): Partial<ProjectRow> {
  const row: Partial<ProjectRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('name' in patch) row.name = patch.name
  if ('code' in patch) row.code = patch.code
  if ('description' in patch) row.description = patch.description ?? null
  if ('color' in patch) row.color = patch.color
  if ('status' in patch) row.status = patch.status
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromRequester(patch: Partial<Requester>): Partial<RequesterRow> {
  const row: Partial<RequesterRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('name' in patch) row.name = patch.name
  if ('team' in patch) row.team = patch.team ?? null
  if ('email' in patch) row.email = patch.email ?? null
  if ('notes' in patch) row.notes = patch.notes ?? null
  if ('isSelf' in patch) row.is_self = patch.isSelf ?? false
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromTag(patch: Partial<Tag>): Partial<TagRow> {
  const row: Partial<TagRow> = {}
  if ('id' in patch) row.id = patch.id
  if ('name' in patch) row.name = patch.name
  if ('color' in patch) row.color = patch.color ?? null
  if ('createdAt' in patch) row.created_at = patch.createdAt
  if ('updatedAt' in patch) row.updated_at = patch.updatedAt
  return row
}

export function fromActivity(entry: ActivityLog): ActivityRow {
  return {
    id: entry.id,
    entity: entry.entity,
    entity_id: entry.entityId,
    action: entry.action,
    message: entry.message,
    at: entry.at,
    meta: entry.meta ?? null,
  }
}

export function fromSettings(settings: AppSettings): SettingsRow {
  return {
    id: settings.id,
    user_name: settings.userName,
    workday_start: settings.workdayStart,
    workday_end: settings.workdayEnd,
    theme: settings.theme,
    morning_reminder_enabled: settings.morningReminderEnabled,
    morning_reminder_time: settings.morningReminderTime,
    evening_reminder_enabled: settings.eveningReminderEnabled,
    evening_reminder_time: settings.eveningReminderTime,
    updated_at: settings.updatedAt,
  }
}
