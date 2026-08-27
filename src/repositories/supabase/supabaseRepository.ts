import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from './client'
import {
  fromActivity,
  fromDailyReport,
  fromDelivery,
  fromMeeting,
  fromMeetingLog,
  fromProject,
  fromRequester,
  fromSettings,
  fromTag,
  fromTask,
  toActivity,
  toDailyReport,
  toDelivery,
  toMeeting,
  toMeetingLog,
  toProject,
  toRequester,
  toSettings,
  toTag,
  toTask,
  type ActivityRow,
  type DailyReportRow,
  type DeliveryRow,
  type MeetingLogRow,
  type MeetingRow,
  type ProjectRow,
  type RequesterRow,
  type SettingsRow,
  type TagRow,
  type TaskRow,
} from './mappers'
import { deliveryMatchesFilter, taskMatchesFilter } from '../filters'
import type {
  ActivityRepository,
  DailyReportRepository,
  DeliveryRepository,
  MaintenanceRepository,
  MeetingLogRepository,
  MeetingRepository,
  ProjectRepository,
  RequesterRepository,
  SettingsRepository,
  TagRepository,
  TaskRepository,
  WorklogRepository,
} from '../types'
import type {
  ActivityLog,
  AppSettings,
  DailyReport,
  Delivery,
  DeliveryFilter,
  ID,
  ISODate,
  Meeting,
  MeetingLog,
  Project,
  Requester,
  Tag,
  Task,
  TaskFilter,
} from '@/types/domain'

/**
 * Postgres driver.
 *
 * Tag membership lives in the `task_tags` / `delivery_tags` join tables — a
 * proper many-to-many — and is flattened into `tagIds` on read so the domain
 * shape is identical to the local driver.
 */

const TASKS = 'tasks'
const TASK_TAGS = 'task_tags'
const DELIVERIES = 'deliveries'
const DELIVERY_TAGS = 'delivery_tags'
const REPORTS = 'daily_reports'
const MEETINGS = 'meetings'
const MEETING_LOGS = 'meeting_logs'
const PROJECTS = 'projects'
const REQUESTERS = 'requesters'
const TAGS = 'tags'
const ACTIVITY = 'activity_log'
const SETTINGS = 'settings'

function assertOk(error: PostgrestError | null, context: string): void {
  if (error) throw new Error(`${context}: ${error.message}`)
}

/** Read the join table once and index it by owner id — avoids N+1 on list views. */
async function loadTagMap(
  client: SupabaseClient,
  table: string,
  ownerColumn: string,
  ownerIds: ID[],
): Promise<Map<ID, ID[]>> {
  const map = new Map<ID, ID[]>()
  if (ownerIds.length === 0) return map

  const { data, error } = await client
    .from(table)
    .select(`${ownerColumn}, tag_id`)
    .in(ownerColumn, ownerIds)
  assertOk(error, `load ${table}`)

  for (const row of (data ?? []) as unknown as Array<Record<string, string>>) {
    const ownerId = row[ownerColumn]
    const tagId = row.tag_id
    if (!ownerId || !tagId) continue
    const existing = map.get(ownerId)
    if (existing) existing.push(tagId)
    else map.set(ownerId, [tagId])
  }
  return map
}

async function replaceTags(
  client: SupabaseClient,
  table: string,
  ownerColumn: string,
  ownerId: ID,
  tagIds: ID[],
): Promise<void> {
  const { error: deleteError } = await client.from(table).delete().eq(ownerColumn, ownerId)
  assertOk(deleteError, `clear ${table}`)
  if (tagIds.length === 0) return

  const rows = tagIds.map((tagId) => ({ [ownerColumn]: ownerId, tag_id: tagId }))
  const { error: insertError } = await client.from(table).insert(rows)
  assertOk(insertError, `insert ${table}`)
}

/* -------------------------------- Tasks ---------------------------------- */

class SupabaseTaskRepository implements TaskRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async hydrate(rows: TaskRow[]): Promise<Task[]> {
    const tagMap = await loadTagMap(
      this.client,
      TASK_TAGS,
      'task_id',
      rows.map((row) => row.id),
    )
    return rows.map((row) => toTask(row, tagMap.get(row.id) ?? []))
  }

  async list(): Promise<Task[]> {
    const { data, error } = await this.client.from(TASKS).select('*').order('date', {
      ascending: false,
    })
    assertOk(error, 'list tasks')
    return this.hydrate((data ?? []) as TaskRow[])
  }

  async getById(id: ID): Promise<Task | null> {
    const { data, error } = await this.client.from(TASKS).select('*').eq('id', id).maybeSingle()
    assertOk(error, 'get task')
    if (!data) return null
    const [task] = await this.hydrate([data as TaskRow])
    return task ?? null
  }

  async listByDate(date: ISODate): Promise<Task[]> {
    const { data, error } = await this.client.from(TASKS).select('*').eq('date', date)
    assertOk(error, 'list tasks by date')
    return this.hydrate((data ?? []) as TaskRow[])
  }

  async listByDateRange(from: ISODate, to: ISODate): Promise<Task[]> {
    const { data, error } = await this.client
      .from(TASKS)
      .select('*')
      .gte('date', from)
      .lte('date', to)
    assertOk(error, 'list tasks by range')
    return this.hydrate((data ?? []) as TaskRow[])
  }

  async listByDelivery(deliveryId: ID): Promise<Task[]> {
    const { data, error } = await this.client
      .from(TASKS)
      .select('*')
      .eq('delivery_id', deliveryId)
      .order('date', { ascending: true })
    assertOk(error, 'list tasks by delivery')
    return this.hydrate((data ?? []) as TaskRow[])
  }

  async search(filter: TaskFilter): Promise<Task[]> {
    // Push the indexable predicates into SQL, then reuse the shared in-memory
    // predicate so both drivers agree on edge cases (tags, free text).
    let query = this.client.from(TASKS).select('*')
    if (filter.from) query = query.gte('date', filter.from)
    if (filter.to) query = query.lte('date', filter.to)
    if (filter.statuses?.length) query = query.in('status', filter.statuses)
    if (filter.projectIds?.length) query = query.in('project_id', filter.projectIds)
    if (filter.requesterIds?.length) query = query.in('requester_id', filter.requesterIds)
    if (filter.deliveryId) query = query.eq('delivery_id', filter.deliveryId)
    if (filter.isPlanned !== undefined) query = query.eq('is_planned', filter.isPlanned)

    const { data, error } = await query
    assertOk(error, 'search tasks')
    const tasks = await this.hydrate((data ?? []) as TaskRow[])
    return tasks.filter((task) => taskMatchesFilter(task, filter))
  }

  async create(entity: Task): Promise<Task> {
    const { error } = await this.client.from(TASKS).insert(fromTask(entity))
    assertOk(error, 'create task')
    await replaceTags(this.client, TASK_TAGS, 'task_id', entity.id, entity.tagIds)
    return entity
  }

  async update(id: ID, patch: Partial<Task>): Promise<Task> {
    const row = fromTask(patch)
    if (Object.keys(row).length > 0) {
      const { error } = await this.client.from(TASKS).update(row).eq('id', id)
      assertOk(error, 'update task')
    }
    if (patch.tagIds) {
      await replaceTags(this.client, TASK_TAGS, 'task_id', id, patch.tagIds)
    }
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Task ${id} not found after update`)
    return updated
  }

  async remove(id: ID): Promise<void> {
    const { error } = await this.client.from(TASKS).delete().eq('id', id)
    assertOk(error, 'delete task')
  }

  async bulkCreate(entities: Task[]): Promise<void> {
    if (entities.length === 0) return
    const { error } = await this.client.from(TASKS).insert(entities.map(fromTask))
    assertOk(error, 'bulk create tasks')
    const joins = entities.flatMap((task) =>
      task.tagIds.map((tagId) => ({ task_id: task.id, tag_id: tagId })),
    )
    if (joins.length > 0) {
      const { error: joinError } = await this.client.from(TASK_TAGS).insert(joins)
      assertOk(joinError, 'bulk create task tags')
    }
  }
}

/* ------------------------------ Deliveries -------------------------------- */

class SupabaseDeliveryRepository implements DeliveryRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async hydrate(rows: DeliveryRow[]): Promise<Delivery[]> {
    const tagMap = await loadTagMap(
      this.client,
      DELIVERY_TAGS,
      'delivery_id',
      rows.map((row) => row.id),
    )
    return rows.map((row) => toDelivery(row, tagMap.get(row.id) ?? []))
  }

  async list(): Promise<Delivery[]> {
    const { data, error } = await this.client
      .from(DELIVERIES)
      .select('*')
      .order('requested_date', { ascending: false })
    assertOk(error, 'list deliveries')
    return this.hydrate((data ?? []) as DeliveryRow[])
  }

  async getById(id: ID): Promise<Delivery | null> {
    const { data, error } = await this.client
      .from(DELIVERIES)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    assertOk(error, 'get delivery')
    if (!data) return null
    const [delivery] = await this.hydrate([data as DeliveryRow])
    return delivery ?? null
  }

  async search(filter: DeliveryFilter): Promise<Delivery[]> {
    let query = this.client.from(DELIVERIES).select('*')
    if (filter.statuses?.length) query = query.in('status', filter.statuses)
    if (filter.projectIds?.length) query = query.in('project_id', filter.projectIds)
    if (filter.requesterIds?.length) query = query.in('requester_id', filter.requesterIds)
    if (filter.from) query = query.gte('requested_date', filter.from)
    if (filter.to) query = query.lte('requested_date', filter.to)

    const { data, error } = await query
    assertOk(error, 'search deliveries')
    const deliveries = await this.hydrate((data ?? []) as DeliveryRow[])
    return deliveries.filter((delivery) => deliveryMatchesFilter(delivery, filter))
  }

  async create(entity: Delivery): Promise<Delivery> {
    const { error } = await this.client.from(DELIVERIES).insert(fromDelivery(entity))
    assertOk(error, 'create delivery')
    await replaceTags(this.client, DELIVERY_TAGS, 'delivery_id', entity.id, entity.tagIds)
    return entity
  }

  async update(id: ID, patch: Partial<Delivery>): Promise<Delivery> {
    const row = fromDelivery(patch)
    if (Object.keys(row).length > 0) {
      const { error } = await this.client.from(DELIVERIES).update(row).eq('id', id)
      assertOk(error, 'update delivery')
    }
    if (patch.tagIds) {
      await replaceTags(this.client, DELIVERY_TAGS, 'delivery_id', id, patch.tagIds)
    }
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Delivery ${id} not found after update`)
    return updated
  }

  async remove(id: ID): Promise<void> {
    const { error } = await this.client.from(DELIVERIES).delete().eq('id', id)
    assertOk(error, 'delete delivery')
  }

  async bulkCreate(entities: Delivery[]): Promise<void> {
    if (entities.length === 0) return
    const { error } = await this.client.from(DELIVERIES).insert(entities.map(fromDelivery))
    assertOk(error, 'bulk create deliveries')
    const joins = entities.flatMap((delivery) =>
      delivery.tagIds.map((tagId) => ({ delivery_id: delivery.id, tag_id: tagId })),
    )
    if (joins.length > 0) {
      const { error: joinError } = await this.client.from(DELIVERY_TAGS).insert(joins)
      assertOk(joinError, 'bulk create delivery tags')
    }
  }
}

/* -------------------------------- Reports --------------------------------- */

class SupabaseDailyReportRepository implements DailyReportRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<DailyReport[]> {
    const { data, error } = await this.client
      .from(REPORTS)
      .select('*')
      .order('date', { ascending: false })
    assertOk(error, 'list reports')
    return ((data ?? []) as DailyReportRow[]).map(toDailyReport)
  }

  async getById(id: ID): Promise<DailyReport | null> {
    const { data, error } = await this.client.from(REPORTS).select('*').eq('id', id).maybeSingle()
    assertOk(error, 'get report')
    return data ? toDailyReport(data as DailyReportRow) : null
  }

  async getByDate(date: ISODate): Promise<DailyReport | null> {
    const { data, error } = await this.client
      .from(REPORTS)
      .select('*')
      .eq('date', date)
      .maybeSingle()
    assertOk(error, 'get report by date')
    return data ? toDailyReport(data as DailyReportRow) : null
  }

  async listByDateRange(from: ISODate, to: ISODate): Promise<DailyReport[]> {
    const { data, error } = await this.client
      .from(REPORTS)
      .select('*')
      .gte('date', from)
      .lte('date', to)
    assertOk(error, 'list reports by range')
    return ((data ?? []) as DailyReportRow[]).map(toDailyReport)
  }

  async create(entity: DailyReport): Promise<DailyReport> {
    const { error } = await this.client.from(REPORTS).insert(fromDailyReport(entity))
    assertOk(error, 'create report')
    return entity
  }

  async update(id: ID, patch: Partial<DailyReport>): Promise<DailyReport> {
    const { error } = await this.client.from(REPORTS).update(fromDailyReport(patch)).eq('id', id)
    assertOk(error, 'update report')
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Report ${id} not found after update`)
    return updated
  }

  async remove(id: ID): Promise<void> {
    const { error } = await this.client.from(REPORTS).delete().eq('id', id)
    assertOk(error, 'delete report')
  }

  async bulkCreate(entities: DailyReport[]): Promise<void> {
    if (entities.length === 0) return
    const { error } = await this.client.from(REPORTS).insert(entities.map(fromDailyReport))
    assertOk(error, 'bulk create reports')
  }
}

/* --------------------------- Simple lookup tables -------------------------- */

interface SimpleTableConfig<TDomain, TRow> {
  table: string
  toDomain: (row: TRow) => TDomain
  toRow: (patch: Partial<TDomain>) => Partial<TRow>
  orderBy: string
}

class SupabaseSimpleRepository<TDomain extends { id: ID }, TRow> {
  constructor(
    private readonly client: SupabaseClient,
    private readonly config: SimpleTableConfig<TDomain, TRow>,
  ) {}

  async list(): Promise<TDomain[]> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select('*')
      .order(this.config.orderBy, { ascending: true })
    assertOk(error, `list ${this.config.table}`)
    return ((data ?? []) as TRow[]).map(this.config.toDomain)
  }

  async getById(id: ID): Promise<TDomain | null> {
    const { data, error } = await this.client
      .from(this.config.table)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    assertOk(error, `get ${this.config.table}`)
    return data ? this.config.toDomain(data as TRow) : null
  }

  async create(entity: TDomain): Promise<TDomain> {
    // The client is untyped (no generated Database types), so rows go in as never.
    const { error } = await this.client
      .from(this.config.table)
      .insert(this.config.toRow(entity) as never)
    assertOk(error, `create ${this.config.table}`)
    return entity
  }

  async update(id: ID, patch: Partial<TDomain>): Promise<TDomain> {
    const { error } = await this.client
      .from(this.config.table)
      .update(this.config.toRow(patch) as never)
      .eq('id', id)
    assertOk(error, `update ${this.config.table}`)
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Record ${id} not found after update`)
    return updated
  }

  async remove(id: ID): Promise<void> {
    const { error } = await this.client.from(this.config.table).delete().eq('id', id)
    assertOk(error, `delete ${this.config.table}`)
  }

  async bulkCreate(entities: TDomain[]): Promise<void> {
    if (entities.length === 0) return
    const { error } = await this.client
      .from(this.config.table)
      .insert(entities.map((entity) => this.config.toRow(entity)) as never)
    assertOk(error, `bulk create ${this.config.table}`)
  }
}

class SupabaseMeetingLogRepository implements MeetingLogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<MeetingLog[]> {
    const { data, error } = await this.client
      .from(MEETING_LOGS)
      .select('*')
      .order('date', { ascending: false })
    assertOk(error, 'list meeting logs')
    return ((data ?? []) as MeetingLogRow[]).map(toMeetingLog)
  }

  async getById(id: ID): Promise<MeetingLog | null> {
    const { data, error } = await this.client
      .from(MEETING_LOGS)
      .select('*')
      .eq('id', id)
      .maybeSingle()
    assertOk(error, 'get meeting log')
    return data ? toMeetingLog(data as MeetingLogRow) : null
  }

  async listByDate(date: ISODate): Promise<MeetingLog[]> {
    const { data, error } = await this.client.from(MEETING_LOGS).select('*').eq('date', date)
    assertOk(error, 'list meeting logs by date')
    return ((data ?? []) as MeetingLogRow[]).map(toMeetingLog)
  }

  async listByDateRange(from: ISODate, to: ISODate): Promise<MeetingLog[]> {
    const { data, error } = await this.client
      .from(MEETING_LOGS)
      .select('*')
      .gte('date', from)
      .lte('date', to)
    assertOk(error, 'list meeting logs by range')
    return ((data ?? []) as MeetingLogRow[]).map(toMeetingLog)
  }

  async listByMeeting(meetingId: ID): Promise<MeetingLog[]> {
    const { data, error } = await this.client
      .from(MEETING_LOGS)
      .select('*')
      .eq('meeting_id', meetingId)
    assertOk(error, 'list meeting logs by meeting')
    return ((data ?? []) as MeetingLogRow[]).map(toMeetingLog)
  }

  async create(entity: MeetingLog): Promise<MeetingLog> {
    const { error } = await this.client.from(MEETING_LOGS).insert(fromMeetingLog(entity) as never)
    assertOk(error, 'create meeting log')
    return entity
  }

  async update(id: ID, patch: Partial<MeetingLog>): Promise<MeetingLog> {
    const { error } = await this.client
      .from(MEETING_LOGS)
      .update(fromMeetingLog(patch) as never)
      .eq('id', id)
    assertOk(error, 'update meeting log')
    const updated = await this.getById(id)
    if (!updated) throw new Error(`Meeting log ${id} not found after update`)
    return updated
  }

  async remove(id: ID): Promise<void> {
    const { error } = await this.client.from(MEETING_LOGS).delete().eq('id', id)
    assertOk(error, 'delete meeting log')
  }

  async bulkCreate(entities: MeetingLog[]): Promise<void> {
    if (entities.length === 0) return
    const { error } = await this.client
      .from(MEETING_LOGS)
      .insert(entities.map(fromMeetingLog) as never)
    assertOk(error, 'bulk create meeting logs')
  }
}

/* ------------------------------- Activity --------------------------------- */

class SupabaseActivityRepository implements ActivityRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(limit = 100): Promise<ActivityLog[]> {
    const { data, error } = await this.client
      .from(ACTIVITY)
      .select('*')
      .order('at', { ascending: false })
      .limit(limit)
    assertOk(error, 'list activity')
    return ((data ?? []) as ActivityRow[]).map(toActivity)
  }

  async listByEntity(entity: ActivityLog['entity'], entityId: ID): Promise<ActivityLog[]> {
    const { data, error } = await this.client
      .from(ACTIVITY)
      .select('*')
      .eq('entity', entity)
      .eq('entity_id', entityId)
      .order('at', { ascending: false })
    assertOk(error, 'list activity by entity')
    return ((data ?? []) as ActivityRow[]).map(toActivity)
  }

  async append(entry: ActivityLog): Promise<void> {
    const { error } = await this.client.from(ACTIVITY).insert(fromActivity(entry))
    assertOk(error, 'append activity')
  }

  async bulkCreate(entries: ActivityLog[]): Promise<void> {
    if (entries.length === 0) return
    const { error } = await this.client.from(ACTIVITY).insert(entries.map(fromActivity))
    assertOk(error, 'bulk create activity')
  }
}

class SupabaseSettingsRepository implements SettingsRepository {
  constructor(private readonly client: SupabaseClient) {}

  async get(): Promise<AppSettings | null> {
    const { data, error } = await this.client
      .from(SETTINGS)
      .select('*')
      .eq('id', 'settings')
      .maybeSingle()
    assertOk(error, 'get settings')
    return data ? toSettings(data as SettingsRow) : null
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    const { error } = await this.client.from(SETTINGS).upsert(fromSettings(settings))
    assertOk(error, 'save settings')
    return settings
  }
}

class SupabaseMaintenanceRepository implements MaintenanceRepository {
  constructor(private readonly client: SupabaseClient) {}

  async clearAll(): Promise<void> {
    // Ordered child-first; FKs are ON DELETE CASCADE but explicit order keeps the
    // intent obvious and works even if a future migration drops the cascade.
    const tables = [
      TASK_TAGS,
      DELIVERY_TAGS,
      ACTIVITY,
      MEETING_LOGS,
      MEETINGS,
      TASKS,
      REPORTS,
      DELIVERIES,
      TAGS,
      PROJECTS,
      REQUESTERS,
    ]
    for (const table of tables) {
      const { error } = await this.client.from(table).delete().neq('id', '')
      assertOk(error, `clear ${table}`)
    }
  }

  async isEmpty(): Promise<boolean> {
    const { count, error } = await this.client
      .from(PROJECTS)
      .select('id', { count: 'exact', head: true })
    assertOk(error, 'count projects')
    return (count ?? 0) === 0
  }
}

export function createSupabaseRepository(): WorklogRepository {
  const client = getSupabaseClient()

  return {
    driver: 'supabase',
    tasks: new SupabaseTaskRepository(client),
    deliveries: new SupabaseDeliveryRepository(client),
    reports: new SupabaseDailyReportRepository(client),
    meetings: new SupabaseSimpleRepository<Meeting, MeetingRow>(client, {
      table: MEETINGS,
      toDomain: toMeeting,
      toRow: fromMeeting,
      orderBy: 'time',
    }) as MeetingRepository,
    meetingLogs: new SupabaseMeetingLogRepository(client),
    projects: new SupabaseSimpleRepository<Project, ProjectRow>(client, {
      table: PROJECTS,
      toDomain: toProject,
      toRow: fromProject,
      orderBy: 'name',
    }) as ProjectRepository,
    requesters: new SupabaseSimpleRepository<Requester, RequesterRow>(client, {
      table: REQUESTERS,
      toDomain: toRequester,
      toRow: fromRequester,
      orderBy: 'name',
    }) as RequesterRepository,
    tags: new SupabaseSimpleRepository<Tag, TagRow>(client, {
      table: TAGS,
      toDomain: toTag,
      toRow: fromTag,
      orderBy: 'name',
    }) as TagRepository,
    activity: new SupabaseActivityRepository(client),
    settings: new SupabaseSettingsRepository(client),
    maintenance: new SupabaseMaintenanceRepository(client),
  }
}
