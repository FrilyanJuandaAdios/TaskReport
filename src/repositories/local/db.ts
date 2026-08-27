import Dexie, { type EntityTable } from 'dexie'
import type {
  ActivityLog,
  AppSettings,
  DailyReport,
  Delivery,
  Meeting,
  MeetingLog,
  Project,
  Requester,
  Tag,
  Task,
} from '@/types/domain'

/**
 * IndexedDB schema (Dexie).
 *
 * Indexes are chosen for the three hot paths:
 *  - Today page          -> tasks by `date`
 *  - History / reports   -> tasks by `date` range, reports by `date`
 *  - Delivery detail     -> tasks by `deliveryId`
 *
 * `*tagIds` is a multi-entry index so tag filtering stays O(matches).
 */
export class WorklogDatabase extends Dexie {
  tasks!: EntityTable<Task, 'id'>
  deliveries!: EntityTable<Delivery, 'id'>
  reports!: EntityTable<DailyReport, 'id'>
  projects!: EntityTable<Project, 'id'>
  requesters!: EntityTable<Requester, 'id'>
  tags!: EntityTable<Tag, 'id'>
  meetings!: EntityTable<Meeting, 'id'>
  meetingLogs!: EntityTable<MeetingLog, 'id'>
  activity!: EntityTable<ActivityLog, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('worklog')

    this.version(1).stores({
      tasks: 'id, date, status, projectId, requesterId, deliveryId, isPlanned, *tagIds',
      deliveries:
        'id, status, projectId, requesterId, requestedDate, targetDeliveryDate, actualDeliveryDate, *tagIds',
      reports: 'id, &date',
      projects: 'id, name, status',
      requesters: 'id, name, team',
      tags: 'id, &name',
      activity: 'id, entity, entityId, at',
      settings: 'id',
    })

    // v2 adds the meeting schedule and its per-day log. Dexie migrates existing
    // databases in place; no data is touched.
    // Booleans are not valid IndexedDB keys, so `isActive` is filtered in memory
    // rather than indexed — the schedule table is a handful of rows either way.
    this.version(2).stores({
      meetings: 'id, recurrence, date, projectId, requesterId',
      meetingLogs: 'id, meetingId, date, status',
    })
  }
}

export const db = new WorklogDatabase()
