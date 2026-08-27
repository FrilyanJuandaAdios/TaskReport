import type { Table } from 'dexie'
import { db } from './db'
import { deliveryMatchesFilter, taskMatchesFilter } from '../filters'
import type {
  ActivityRepository,
  CrudRepository,
  DailyReportRepository,
  DeliveryRepository,
  MaintenanceRepository,
  MeetingLogRepository,
  SettingsRepository,
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
 * Dexie's `EntityTable<T, 'id'>` resolves its key type through a conditional
 * that cannot be evaluated for an unresolved generic `T`, so the shared base
 * class works against `Table<T, ID>` and each concrete table is narrowed here.
 */
function asTable<T extends { id: ID }>(table: unknown): Table<T, ID> {
  return table as Table<T, ID>
}

/** Generic Dexie-backed CRUD, reused by the five simple tables. */
class DexieCrudRepository<T extends { id: ID }> implements CrudRepository<T> {
  constructor(protected readonly table: Table<T, ID>) {}

  list(): Promise<T[]> {
    return this.table.toArray()
  }

  async getById(id: ID): Promise<T | null> {
    return (await this.table.get(id)) ?? null
  }

  async create(entity: T): Promise<T> {
    await this.table.add(entity)
    return entity
  }

  async update(id: ID, patch: Partial<T>): Promise<T> {
    await this.table.update(id, patch as never)
    const updated = await this.table.get(id)
    if (!updated) throw new Error(`Record ${id} not found after update`)
    return updated
  }

  async remove(id: ID): Promise<void> {
    await this.table.delete(id)
  }

  async bulkCreate(entities: T[]): Promise<void> {
    await this.table.bulkAdd(entities)
  }
}

class LocalTaskRepository extends DexieCrudRepository<Task> implements TaskRepository {
  constructor() {
    super(asTable<Task>(db.tasks))
  }

  listByDate(date: ISODate): Promise<Task[]> {
    return this.table.where('date').equals(date).toArray()
  }

  listByDateRange(from: ISODate, to: ISODate): Promise<Task[]> {
    return this.table.where('date').between(from, to, true, true).toArray()
  }

  listByDelivery(deliveryId: ID): Promise<Task[]> {
    return this.table.where('deliveryId').equals(deliveryId).toArray()
  }

  async search(filter: TaskFilter): Promise<Task[]> {
    // Narrow with the date index first when we have a range — that is the only
    // dimension large enough to matter after a few years of daily use.
    const candidates =
      filter.from && filter.to
        ? await this.listByDateRange(filter.from, filter.to)
        : await this.table.toArray()

    return candidates.filter((task) => taskMatchesFilter(task, filter))
  }
}

class LocalDeliveryRepository
  extends DexieCrudRepository<Delivery>
  implements DeliveryRepository
{
  constructor() {
    super(asTable<Delivery>(db.deliveries))
  }

  async search(filter: DeliveryFilter): Promise<Delivery[]> {
    const all = await this.table.toArray()
    return all.filter((delivery) => deliveryMatchesFilter(delivery, filter))
  }
}

class LocalDailyReportRepository
  extends DexieCrudRepository<DailyReport>
  implements DailyReportRepository
{
  constructor() {
    super(asTable<DailyReport>(db.reports))
  }

  async getByDate(date: ISODate): Promise<DailyReport | null> {
    return (await this.table.where('date').equals(date).first()) ?? null
  }

  listByDateRange(from: ISODate, to: ISODate): Promise<DailyReport[]> {
    return this.table.where('date').between(from, to, true, true).toArray()
  }
}

class LocalMeetingLogRepository
  extends DexieCrudRepository<MeetingLog>
  implements MeetingLogRepository
{
  constructor() {
    super(asTable<MeetingLog>(db.meetingLogs))
  }

  listByDate(date: ISODate): Promise<MeetingLog[]> {
    return this.table.where('date').equals(date).toArray()
  }

  listByDateRange(from: ISODate, to: ISODate): Promise<MeetingLog[]> {
    return this.table.where('date').between(from, to, true, true).toArray()
  }

  listByMeeting(meetingId: ID): Promise<MeetingLog[]> {
    return this.table.where('meetingId').equals(meetingId).toArray()
  }
}

class LocalActivityRepository implements ActivityRepository {
  async list(limit = 100): Promise<ActivityLog[]> {
    return db.activity.orderBy('at').reverse().limit(limit).toArray()
  }

  async listByEntity(entity: ActivityLog['entity'], entityId: ID): Promise<ActivityLog[]> {
    const rows = await db.activity.where('entityId').equals(entityId).toArray()
    return rows.filter((row) => row.entity === entity).sort((a, b) => b.at.localeCompare(a.at))
  }

  async append(entry: ActivityLog): Promise<void> {
    await db.activity.add(entry)
  }

  async bulkCreate(entries: ActivityLog[]): Promise<void> {
    await db.activity.bulkAdd(entries)
  }
}

class LocalSettingsRepository implements SettingsRepository {
  async get(): Promise<AppSettings | null> {
    return (await db.settings.get('settings')) ?? null
  }

  async save(settings: AppSettings): Promise<AppSettings> {
    await db.settings.put(settings)
    return settings
  }
}

class LocalMaintenanceRepository implements MaintenanceRepository {
  async clearAll(): Promise<void> {
    await db.transaction(
      'rw',
      [
        db.tasks,
        db.deliveries,
        db.reports,
        db.projects,
        db.requesters,
        db.tags,
        db.meetings,
        db.meetingLogs,
        db.activity,
      ],
      async () => {
        await Promise.all([
          db.tasks.clear(),
          db.deliveries.clear(),
          db.reports.clear(),
          db.projects.clear(),
          db.requesters.clear(),
          db.tags.clear(),
          db.meetings.clear(),
          db.meetingLogs.clear(),
          db.activity.clear(),
        ])
      },
    )
  }

  async isEmpty(): Promise<boolean> {
    const [taskCount, projectCount] = await Promise.all([db.tasks.count(), db.projects.count()])
    return taskCount === 0 && projectCount === 0
  }
}

/** IndexedDB driver — the zero-configuration default. */
export function createLocalRepository(): WorklogRepository {
  return {
    driver: 'local',
    tasks: new LocalTaskRepository(),
    deliveries: new LocalDeliveryRepository(),
    reports: new LocalDailyReportRepository(),
    meetings: new DexieCrudRepository<Meeting>(asTable<Meeting>(db.meetings)),
    meetingLogs: new LocalMeetingLogRepository(),
    projects: new DexieCrudRepository<Project>(asTable<Project>(db.projects)),
    requesters: new DexieCrudRepository<Requester>(asTable<Requester>(db.requesters)),
    tags: new DexieCrudRepository<Tag>(asTable<Tag>(db.tags)),
    activity: new LocalActivityRepository(),
    settings: new LocalSettingsRepository(),
    maintenance: new LocalMaintenanceRepository(),
  }
}
