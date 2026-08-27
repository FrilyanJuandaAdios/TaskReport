import { getRepository } from '@/repositories'
import { logActivity } from './activityService'
import { getTasksForDate, hydrateTasks } from './taskService'
import { countMeetingsPerDay, getMeetingsForDate } from './meetingService'
import { newId, nowISO, parseLines } from '@/lib/utils'
import { formatReportDate } from '@/lib/date'
import type {
  DailyReport,
  DailyReportSummary,
  ID,
  ISODate,
  DaySummary,
  MeetingOccurrence,
  TaskWithRelations,
  UpsertDailyReportInput,
} from '@/types/domain'

/**
 * Daily report generation.
 *
 * The report is *derived*, never re-typed: tasks already carry the status, the
 * requester and the project, so "Generate report" is a grouping operation plus
 * three free-text fields the user actually has to think about.
 *
 * `bodyOverride` lets the user hand-edit the generated markdown without losing
 * the underlying structured data.
 */

export interface DailyReportView {
  date: ISODate
  report: DailyReport | null
  tasks: TaskWithRelations[]
  /** Meetings scheduled that day, with whatever was recorded against them. */
  meetings: MeetingOccurrence[]
  summary: DailyReportSummary
  groups: {
    completed: TaskWithRelations[]
    inProgress: TaskWithRelations[]
    blocked: TaskWithRelations[]
    planned: TaskWithRelations[]
    cancelled: TaskWithRelations[]
    unplanned: TaskWithRelations[]
  }
}

export function summarizeTasks(tasks: TaskWithRelations[]): DailyReportSummary {
  return {
    planned: tasks.filter((task) => task.isPlanned).length,
    completed: tasks.filter((task) => task.status === 'completed').length,
    inProgress: tasks.filter((task) => task.status === 'in_progress').length,
    blocked: tasks.filter((task) => task.status === 'blocked').length,
    cancelled: tasks.filter((task) => task.status === 'cancelled').length,
    unplanned: tasks.filter((task) => !task.isPlanned).length,
    total: tasks.length,
  }
}

export async function getDailyReportView(date: ISODate): Promise<DailyReportView> {
  const repository = getRepository()
  const [tasks, report, meetings] = await Promise.all([
    getTasksForDate(date),
    repository.reports.getByDate(date),
    getMeetingsForDate(date),
  ])

  return {
    date,
    report,
    tasks,
    meetings,
    summary: summarizeTasks(tasks),
    groups: {
      completed: tasks.filter((task) => task.status === 'completed'),
      inProgress: tasks.filter((task) => task.status === 'in_progress'),
      blocked: tasks.filter((task) => task.status === 'blocked'),
      planned: tasks.filter((task) => task.status === 'planned'),
      cancelled: tasks.filter((task) => task.status === 'cancelled'),
      unplanned: tasks.filter((task) => !task.isPlanned),
    },
  }
}

/** Creates the report on first save, updates it every time after. */
export async function upsertDailyReport(input: UpsertDailyReportInput): Promise<DailyReport> {
  const repository = getRepository()
  const tasks = await getTasksForDate(input.date)
  const summary = summarizeTasks(tasks)
  const timestamp = nowISO()

  const existing = await repository.reports.getByDate(input.date)

  if (existing) {
    const updated = await repository.reports.update(existing.id, {
      issues: input.issues,
      nextSteps: input.nextSteps,
      notes: input.notes,
      bodyOverride: input.bodyOverride,
      summary,
      updatedAt: timestamp,
    })
    await logActivity('report', updated.id, 'report.updated', `Updated report for ${input.date}`)
    return updated
  }

  const report: DailyReport = {
    id: newId(),
    date: input.date,
    issues: input.issues,
    nextSteps: input.nextSteps,
    notes: input.notes,
    bodyOverride: input.bodyOverride,
    summary,
    syncedToNotionAt: null,
    notionPageUrl: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const created = await repository.reports.create(report)
  await logActivity('report', created.id, 'report.created', `Generated report for ${input.date}`)
  return created
}

export function getReport(id: ID): Promise<DailyReport | null> {
  return getRepository().reports.getById(id)
}

export function listReportsInRange(from: ISODate, to: ISODate): Promise<DailyReport[]> {
  return getRepository().reports.listByDateRange(from, to)
}

export async function deleteReport(id: ID): Promise<void> {
  await getRepository().reports.remove(id)
}

/**
 * Per-day counters for the History calendar and list. One range read of each
 * table, then an in-memory group — no query per day.
 */
export async function getDaySummaries(from: ISODate, to: ISODate): Promise<DaySummary[]> {
  const repository = getRepository()
  const [tasks, reports, meetingCounts] = await Promise.all([
    repository.tasks.listByDateRange(from, to),
    repository.reports.listByDateRange(from, to),
    countMeetingsPerDay(from, to),
  ])

  const reportDates = new Set(reports.map((report) => report.date))
  const byDate = new Map<ISODate, DaySummary>()

  for (const task of tasks) {
    const summary = byDate.get(task.date) ?? {
      date: task.date,
      total: 0,
      completed: 0,
      inProgress: 0,
      blocked: 0,
      unplanned: 0,
      meetings: meetingCounts.get(task.date) ?? 0,
      hasReport: reportDates.has(task.date),
    }

    summary.total += 1
    if (task.status === 'completed') summary.completed += 1
    if (task.status === 'in_progress') summary.inProgress += 1
    if (task.status === 'blocked') summary.blocked += 1
    if (!task.isPlanned) summary.unplanned += 1

    byDate.set(task.date, summary)
  }

  // Days with only a report, or only meetings, still belong in history.
  for (const date of [...reportDates, ...meetingCounts.keys()]) {
    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        total: 0,
        completed: 0,
        inProgress: 0,
        blocked: 0,
        unplanned: 0,
        meetings: meetingCounts.get(date) ?? 0,
        hasReport: reportDates.has(date),
      })
    }
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/* ------------------------------- Rendering -------------------------------- */

function bulletList(items: string[]): string {
  return items.length > 0 ? items.map((item) => `- ${item}`).join('\n') : '- —'
}

function taskLine(task: TaskWithRelations): string {
  const context = [task.project?.name, task.requester?.name && `req. ${task.requester.name}`]
    .filter(Boolean)
    .join(' · ')
  return context ? `${task.title} (${context})` : task.title
}

/**
 * Markdown is the interchange format: it renders in the app, copies into Slack
 * or email, and maps cleanly onto Notion blocks later.
 */
export function renderReportMarkdown(view: DailyReportView, report: DailyReport | null): string {
  if (report?.bodyOverride) return report.bodyOverride

  const issues = parseLines(report?.issues ?? '')
  const nextSteps = parseLines(report?.nextSteps ?? '')
  const notes = parseLines(report?.notes ?? '')

  const sections = [
    `# Daily Report`,
    ``,
    formatReportDate(view.date),
    ``,
    `### Task Completed`,
    bulletList(view.groups.completed.map(taskLine)),
    ``,
    `### On Going / In Progress Work`,
    bulletList([...view.groups.inProgress, ...view.groups.planned].map(taskLine)),
    ``,
    ...(view.meetings.length > 0
      ? [
          `### Meetings`,
          bulletList(
            view.meetings.map((occurrence) => {
              const suffix = occurrence.status === 'skipped' ? ' (skipped)' : ''
              return `${occurrence.meeting.time} ${occurrence.meeting.title}${suffix}`
            }),
          ),
          ``,
        ]
      : []),
    `### Issues / Challenges`,
    bulletList([...issues, ...view.groups.blocked.map((task) => `Blocked: ${taskLine(task)}`)]),
    ``,
    `### Next Step`,
    bulletList(nextSteps),
    ``,
    `### Notes`,
    bulletList(notes),
    ``,
    `---`,
    ``,
    `Planned: ${view.summary.planned}  ·  Completed: ${view.summary.completed}  ·  In Progress: ${view.summary.inProgress}  ·  Blocked: ${view.summary.blocked}  ·  Unplanned: ${view.summary.unplanned}`,
  ]

  return sections.join('\n')
}

/** Plain-text variant for clipboard paste into tools that strip markdown. */
export function renderReportPlainText(view: DailyReportView, report: DailyReport | null): string {
  return renderReportMarkdown(view, report)
    .replace(/^#+\s*/gm, '')
    .replace(/^-\s/gm, '• ')
}

export async function markReportSynced(
  id: ID,
  notionPageUrl: string | null,
): Promise<DailyReport> {
  const updated = await getRepository().reports.update(id, {
    syncedToNotionAt: nowISO(),
    notionPageUrl,
    updatedAt: nowISO(),
  })
  await logActivity('report', id, 'report.synced_notion', `Sent report ${updated.date} to Notion`)
  return updated
}

/** Rebuild a report view from arbitrary tasks — used by range exports. */
export async function buildViewFromTasks(
  date: ISODate,
  tasks: Awaited<ReturnType<typeof hydrateTasks>>,
): Promise<DailyReportView> {
  const [report, meetings] = await Promise.all([
    getRepository().reports.getByDate(date),
    getMeetingsForDate(date),
  ])
  return {
    date,
    report,
    tasks,
    meetings,
    summary: summarizeTasks(tasks),
    groups: {
      completed: tasks.filter((task) => task.status === 'completed'),
      inProgress: tasks.filter((task) => task.status === 'in_progress'),
      blocked: tasks.filter((task) => task.status === 'blocked'),
      planned: tasks.filter((task) => task.status === 'planned'),
      cancelled: tasks.filter((task) => task.status === 'cancelled'),
      unplanned: tasks.filter((task) => !task.isPlanned),
    },
  }
}
