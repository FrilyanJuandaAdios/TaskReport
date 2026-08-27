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
 * The persistence contract.
 *
 * Every UI path goes: component -> hook -> service -> repository -> driver.
 * Swapping IndexedDB for Postgres means writing one more class that satisfies
 * this interface — no component, hook or service changes.
 *
 * Rules for implementers:
 * - Methods take and return plain domain objects only. No driver types leak out.
 * - `create` receives a fully-formed entity (id + timestamps already assigned by
 *   the service layer) so that ids are stable across drivers and offline queues.
 * - Filtering happens in the driver where the engine can use an index; the
 *   in-memory fallback in the local driver is acceptable at personal-app scale.
 */

export interface CrudRepository<T extends { id: ID }> {
  list(): Promise<T[]>
  getById(id: ID): Promise<T | null>
  create(entity: T): Promise<T>
  update(id: ID, patch: Partial<T>): Promise<T>
  remove(id: ID): Promise<void>
}

export interface TaskRepository extends CrudRepository<Task> {
  listByDate(date: ISODate): Promise<Task[]>
  listByDateRange(from: ISODate, to: ISODate): Promise<Task[]>
  listByDelivery(deliveryId: ID): Promise<Task[]>
  search(filter: TaskFilter): Promise<Task[]>
  /** Bulk insert used by import/restore. */
  bulkCreate(entities: Task[]): Promise<void>
}

export interface DeliveryRepository extends CrudRepository<Delivery> {
  search(filter: DeliveryFilter): Promise<Delivery[]>
  bulkCreate(entities: Delivery[]): Promise<void>
}

export interface DailyReportRepository extends CrudRepository<DailyReport> {
  getByDate(date: ISODate): Promise<DailyReport | null>
  listByDateRange(from: ISODate, to: ISODate): Promise<DailyReport[]>
  bulkCreate(entities: DailyReport[]): Promise<void>
}

export interface MeetingRepository extends CrudRepository<Meeting> {
  bulkCreate(entities: Meeting[]): Promise<void>
}

export interface MeetingLogRepository extends CrudRepository<MeetingLog> {
  listByDate(date: ISODate): Promise<MeetingLog[]>
  listByDateRange(from: ISODate, to: ISODate): Promise<MeetingLog[]>
  listByMeeting(meetingId: ID): Promise<MeetingLog[]>
  bulkCreate(entities: MeetingLog[]): Promise<void>
}

export interface ProjectRepository extends CrudRepository<Project> {
  bulkCreate(entities: Project[]): Promise<void>
}

export interface RequesterRepository extends CrudRepository<Requester> {
  bulkCreate(entities: Requester[]): Promise<void>
}

export interface TagRepository extends CrudRepository<Tag> {
  bulkCreate(entities: Tag[]): Promise<void>
}

export interface ActivityRepository {
  list(limit?: number): Promise<ActivityLog[]>
  listByEntity(entity: ActivityLog['entity'], entityId: ID): Promise<ActivityLog[]>
  append(entry: ActivityLog): Promise<void>
  bulkCreate(entries: ActivityLog[]): Promise<void>
}

export interface SettingsRepository {
  get(): Promise<AppSettings | null>
  save(settings: AppSettings): Promise<AppSettings>
}

export interface MaintenanceRepository {
  /** Wipe every table. Used before restoring a backup. */
  clearAll(): Promise<void>
  /** True when the database has never been populated. Drives demo seeding. */
  isEmpty(): Promise<boolean>
}

export interface WorklogRepository {
  readonly driver: 'local' | 'supabase'
  tasks: TaskRepository
  deliveries: DeliveryRepository
  reports: DailyReportRepository
  meetings: MeetingRepository
  meetingLogs: MeetingLogRepository
  projects: ProjectRepository
  requesters: RequesterRepository
  tags: TagRepository
  activity: ActivityRepository
  settings: SettingsRepository
  maintenance: MaintenanceRepository
}
