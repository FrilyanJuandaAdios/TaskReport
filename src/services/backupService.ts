import { getRepository } from '@/repositories'
import { backupSchema, type BackupFile } from '@/schemas'
import { downloadBlob, nowISO } from '@/lib/utils'
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
 * Data portability.
 *
 * The backup is the full relational graph in dependency order, so a restore can
 * replay it as-is. Ids are preserved, which makes a backup round-trip lossless
 * and lets the same file be replayed into a *different* driver (local -> Postgres).
 */

export interface BackupPayload {
  version: 1
  exportedAt: string
  driver: string
  data: {
    projects: Project[]
    requesters: Requester[]
    tags: Tag[]
    deliveries: Delivery[]
    tasks: Task[]
    reports: DailyReport[]
    meetings: Meeting[]
    meetingLogs: MeetingLog[]
    activity: ActivityLog[]
    settings: AppSettings | null
  }
}

export async function buildBackup(): Promise<BackupPayload> {
  const repository = getRepository()

  const [
    projects,
    requesters,
    tags,
    deliveries,
    tasks,
    reports,
    meetings,
    meetingLogs,
    activity,
    settings,
  ] = await Promise.all([
    repository.projects.list(),
    repository.requesters.list(),
    repository.tags.list(),
    repository.deliveries.list(),
    repository.tasks.list(),
    repository.reports.list(),
    repository.meetings.list(),
    repository.meetingLogs.list(),
    repository.activity.list(100_000),
    repository.settings.get(),
  ])

  return {
    version: 1,
    exportedAt: nowISO(),
    driver: repository.driver,
    data: {
      projects,
      requesters,
      tags,
      deliveries,
      tasks,
      reports,
      meetings,
      meetingLogs,
      activity,
      settings,
    },
  }
}

export async function downloadBackup(): Promise<void> {
  const backup = await buildBackup()
  const filename = `worklog-backup-${backup.exportedAt.slice(0, 10)}.json`
  downloadBlob(
    new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
    filename,
  )
}

export interface RestoreResult {
  projects: number
  requesters: number
  tags: number
  deliveries: number
  tasks: number
  reports: number
  meetings: number
  activity: number
}

/**
 * Replace the whole database with the contents of a backup file.
 * Destructive by design — the UI must confirm before calling this.
 */
export async function restoreBackup(fileContents: string): Promise<RestoreResult> {
  const parsed: BackupFile = backupSchema.parse(JSON.parse(fileContents))
  const payload = parsed as unknown as BackupPayload
  const repository = getRepository()

  await repository.maintenance.clearAll()

  // Parents before children: tasks reference projects, requesters and deliveries.
  await repository.projects.bulkCreate(payload.data.projects)
  await repository.requesters.bulkCreate(payload.data.requesters)
  await repository.tags.bulkCreate(payload.data.tags)
  await repository.deliveries.bulkCreate(payload.data.deliveries)
  await repository.tasks.bulkCreate(payload.data.tasks)
  await repository.reports.bulkCreate(payload.data.reports)
  await repository.meetings.bulkCreate(payload.data.meetings ?? [])
  await repository.meetingLogs.bulkCreate(payload.data.meetingLogs ?? [])
  await repository.activity.bulkCreate(payload.data.activity)

  if (payload.data.settings) {
    await repository.settings.save(payload.data.settings)
  }

  return {
    projects: payload.data.projects.length,
    requesters: payload.data.requesters.length,
    tags: payload.data.tags.length,
    deliveries: payload.data.deliveries.length,
    tasks: payload.data.tasks.length,
    reports: payload.data.reports.length,
    meetings: (payload.data.meetings ?? []).length,
    activity: payload.data.activity.length,
  }
}

/**
 * Wipe everything except settings.
 *
 * Destructive and irreversible — the UI must confirm, and should offer a backup
 * first. Settings survive because a reset is about the work log, not the setup.
 */
export async function resetAllData(): Promise<void> {
  await getRepository().maintenance.clearAll()
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('Could not read the selected file.'))
    reader.readAsText(file)
  })
}
