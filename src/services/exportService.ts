import type * as XLSXTypes from 'xlsx'
import { getRepository } from '@/repositories'
import { hydrateTasks } from './taskService'
import { hydrateDeliveries, isDeliveryLate } from './deliveryService'
import { logActivity } from './activityService'
import { downloadBlob } from '@/lib/utils'
import { getMeetingsForDate } from './meetingService'
import { eachDayISO, formatMediumDate, formatReportDate, today } from '@/lib/date'
import { DELIVERY_STATUS_META, TASK_STATUS_META } from '@/constants/status'
import type {
  DailyReport,
  DeliveryFilter,
  DeliveryWithRelations,
  ISODate,
  TaskWithRelations,
} from '@/types/domain'

/**
 * Excel / CSV export.
 *
 * Three rules from the brief drive this file:
 *  1. never dump the raw database — every column is a human label, ids never
 *     appear, enums are rendered as their display text;
 *  2. free tooling only — SheetJS (`xlsx`) writes real .xlsx with no server;
 *  3. the library is ~400 kB, so it is imported lazily: someone who never
 *     exports never downloads it.
 */

type Xlsx = typeof XLSXTypes

let xlsxModule: Promise<Xlsx> | null = null

function loadXlsx(): Promise<Xlsx> {
  xlsxModule ??= import('xlsx')
  return xlsxModule
}

const WORK_LOG_COLUMNS = [
  'Date',
  'Task',
  'Project',
  'Requester',
  'Planned / Unplanned',
  'Status',
  'Priority',
  'Planned Time',
  'Start Time',
  'End Time',
  'Target Delivery',
  'Actual Delivery',
  'Delivery',
  'Tags',
  'Notes',
] as const

type WorkLogRow = Record<(typeof WORK_LOG_COLUMNS)[number], string>

function toWorkLogRow(task: TaskWithRelations): WorkLogRow {
  return {
    Date: task.date,
    Task: task.title,
    Project: task.project?.name ?? '',
    Requester: task.requester?.name ?? '',
    'Planned / Unplanned': task.isPlanned ? 'Planned' : 'Unplanned',
    Status: TASK_STATUS_META[task.status].label,
    Priority: task.priority,
    'Planned Time': task.plannedTime ?? '',
    'Start Time': task.startTime ?? '',
    'End Time': task.endTime ?? '',
    'Target Delivery': task.delivery?.targetDeliveryDate ?? task.targetDate ?? '',
    'Actual Delivery': task.delivery?.actualDeliveryDate ?? '',
    Delivery: task.delivery?.title ?? '',
    Tags: task.tags.map((tag) => tag.name).join(', '),
    Notes: task.notes ?? '',
  }
}

const DELIVERY_COLUMNS = [
  'Delivery',
  'Project',
  'Requester',
  'Requested',
  'Target',
  'Status',
  'Delivered',
  'On Time',
  'Revisions',
  'Daily Tasks',
  'Figma',
  'Reference',
  'Notes',
] as const

type DeliveryRowOut = Record<(typeof DELIVERY_COLUMNS)[number], string | number>

function toDeliveryRow(delivery: DeliveryWithRelations): DeliveryRowOut {
  return {
    Delivery: delivery.title,
    Project: delivery.project?.name ?? '',
    Requester: delivery.requester?.name ?? '',
    Requested: delivery.requestedDate,
    Target: delivery.targetDeliveryDate ?? '',
    Status: DELIVERY_STATUS_META[delivery.status].label,
    Delivered: delivery.actualDeliveryDate ?? '',
    'On Time': delivery.actualDeliveryDate ? (isDeliveryLate(delivery) ? 'Late' : 'On time') : '',
    Revisions: delivery.revisionCount,
    'Daily Tasks': delivery.taskCount,
    Figma: delivery.figmaUrl ?? '',
    Reference: delivery.referenceUrl ?? delivery.ticketUrl ?? '',
    Notes: delivery.notes ?? '',
  }
}

/** Column widths make the difference between "a spreadsheet" and "a report". */
function autoFitColumns(rows: Array<Record<string, unknown>>, headers: readonly string[]) {
  return headers.map((header) => {
    const longest = rows.reduce((max, row) => {
      const value = row[header]
      return Math.max(max, value == null ? 0 : String(value).length)
    }, header.length)
    return { wch: Math.min(Math.max(longest + 2, 10), 60) }
  })
}

function appendSheet(
  xlsx: Xlsx,
  workbook: XLSXTypes.WorkBook,
  name: string,
  rows: Array<Record<string, unknown>>,
  headers: readonly string[],
): void {
  const sheet = xlsx.utils.json_to_sheet(rows, { header: [...headers] })
  sheet['!cols'] = autoFitColumns(rows, headers)
  // Sheet names are capped at 31 characters by the format itself.
  xlsx.utils.book_append_sheet(workbook, sheet, name.slice(0, 31))
}

function writeWorkbook(xlsx: Xlsx, workbook: XLSXTypes.WorkBook, filename: string): void {
  const buffer = xlsx.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer
  downloadBlob(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    filename,
  )
}

/** Summary block that opens every workbook, so the file reads as a report. */
function summarySheet(
  xlsx: Xlsx,
  workbook: XLSXTypes.WorkBook,
  title: string,
  tasks: TaskWithRelations[],
  reports: DailyReport[],
): void {
  const rows = [
    { Metric: 'Report', Value: title },
    { Metric: 'Generated', Value: formatMediumDate(today()) },
    { Metric: 'Total tasks', Value: tasks.length },
    { Metric: 'Completed', Value: tasks.filter((task) => task.status === 'completed').length },
    { Metric: 'In progress', Value: tasks.filter((task) => task.status === 'in_progress').length },
    { Metric: 'Blocked', Value: tasks.filter((task) => task.status === 'blocked').length },
    { Metric: 'Unplanned', Value: tasks.filter((task) => !task.isPlanned).length },
    { Metric: 'Days covered', Value: new Set(tasks.map((task) => task.date)).size },
    { Metric: 'Daily reports written', Value: reports.length },
  ]
  appendSheet(xlsx, workbook, 'Summary', rows, ['Metric', 'Value'])
}

function reportsSheet(xlsx: Xlsx, workbook: XLSXTypes.WorkBook, reports: DailyReport[]): void {
  if (reports.length === 0) return

  const rows = [...reports]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((report) => ({
      Date: report.date,
      Completed: report.summary.completed,
      'In Progress': report.summary.inProgress,
      Blocked: report.summary.blocked,
      Unplanned: report.summary.unplanned,
      'Issues / Challenges': report.issues,
      'Next Step': report.nextSteps,
      Notes: report.notes,
    }))

  appendSheet(xlsx, workbook, 'Daily Reports', rows, [
    'Date',
    'Completed',
    'In Progress',
    'Blocked',
    'Unplanned',
    'Issues / Challenges',
    'Next Step',
    'Notes',
  ])
}

const MEETING_COLUMNS = ['Date', 'Time', 'Meeting', 'Project', 'Organiser', 'Status'] as const

/**
 * Meetings are a schedule, not rows, so the sheet is built by expanding the
 * rules across the exported range — the same view the app shows for each day.
 */
async function meetingsSheet(
  xlsx: Xlsx,
  workbook: XLSXTypes.WorkBook,
  from: ISODate,
  to: ISODate,
): Promise<void> {
  const rows: Array<Record<string, string>> = []

  for (const date of eachDayISO(from, to)) {
    for (const occurrence of await getMeetingsForDate(date)) {
      rows.push({
        Date: date,
        Time: occurrence.meeting.time,
        Meeting: occurrence.meeting.title,
        Project: occurrence.meeting.project?.name ?? '',
        Organiser: occurrence.meeting.requester?.name ?? '',
        Status: occurrence.status === 'scheduled' ? 'Scheduled' : occurrence.status === 'attended' ? 'Attended' : occurrence.status === 'skipped' ? 'Skipped' : 'Cancelled',
      })
    }
  }

  if (rows.length > 0) appendSheet(xlsx, workbook, 'Meetings', rows, MEETING_COLUMNS)
}

/* ------------------------------- Public API -------------------------------- */

export async function exportDailyReportExcel(date: ISODate): Promise<void> {
  const xlsx = await loadXlsx()
  const repository = getRepository()

  const [rawTasks, report] = await Promise.all([
    repository.tasks.listByDate(date),
    repository.reports.getByDate(date),
  ])
  const tasks = await hydrateTasks(rawTasks)
  const reports = report ? [report] : []

  const workbook = xlsx.utils.book_new()
  summarySheet(xlsx, workbook, `Daily Report — ${formatReportDate(date)}`, tasks, reports)
  appendSheet(xlsx, workbook, 'Work Log', tasks.map(toWorkLogRow), WORK_LOG_COLUMNS)
  reportsSheet(xlsx, workbook, reports)
  await meetingsSheet(xlsx, workbook, date, date)

  writeWorkbook(xlsx, workbook, `taskqueue-${date}.xlsx`)

  if (report) {
    await logActivity('report', report.id, 'report.exported', `Exported ${date} to Excel`)
  }
}

export async function exportRangeExcel(
  from: ISODate,
  to: ISODate,
  label = `${from} to ${to}`,
): Promise<void> {
  const xlsx = await loadXlsx()
  const repository = getRepository()

  const [rawTasks, reports] = await Promise.all([
    repository.tasks.listByDateRange(from, to),
    repository.reports.listByDateRange(from, to),
  ])
  const tasks = await hydrateTasks(rawTasks)
  const sorted = [...tasks].sort(
    (a, b) =>
      a.date.localeCompare(b.date) || (a.plannedTime ?? '').localeCompare(b.plannedTime ?? ''),
  )

  const workbook = xlsx.utils.book_new()
  summarySheet(xlsx, workbook, `Work Log — ${label}`, tasks, reports)
  appendSheet(xlsx, workbook, 'Work Log', sorted.map(toWorkLogRow), WORK_LOG_COLUMNS)
  reportsSheet(xlsx, workbook, reports)
  await meetingsSheet(xlsx, workbook, from, to)

  writeWorkbook(xlsx, workbook, `taskqueue-${from}_${to}.xlsx`)
}

export async function exportDeliveriesExcel(filter: DeliveryFilter = {}): Promise<void> {
  const xlsx = await loadXlsx()
  const repository = getRepository()

  const deliveries = await hydrateDeliveries(await repository.deliveries.search(filter))
  const sorted = [...deliveries].sort((a, b) => b.requestedDate.localeCompare(a.requestedDate))

  const workbook = xlsx.utils.book_new()
  appendSheet(xlsx, workbook, 'Deliveries', sorted.map(toDeliveryRow), DELIVERY_COLUMNS)

  // Second sheet: the daily work behind each delivery — the audit trail.
  const allTasks = await hydrateTasks(await repository.tasks.list())
  const workLogRows = sorted.flatMap((delivery) =>
    allTasks
      .filter((task) => task.deliveryId === delivery.id)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((task) => ({
        Delivery: delivery.title,
        Date: task.date,
        Task: task.title,
        Status: TASK_STATUS_META[task.status].label,
        Notes: task.notes ?? '',
      })),
  )

  if (workLogRows.length > 0) {
    appendSheet(xlsx, workbook, 'Delivery Work Log', workLogRows, [
      'Delivery',
      'Date',
      'Task',
      'Status',
      'Notes',
    ])
  }

  writeWorkbook(xlsx, workbook, `deliveries-${today()}.xlsx`)
}

export async function exportTasksCsv(from: ISODate, to: ISODate): Promise<void> {
  const xlsx = await loadXlsx()
  const tasks = await hydrateTasks(await getRepository().tasks.listByDateRange(from, to))
  const rows = [...tasks].sort((a, b) => a.date.localeCompare(b.date)).map(toWorkLogRow)

  const sheet = xlsx.utils.json_to_sheet(rows, { header: [...WORK_LOG_COLUMNS] })
  const csv = xlsx.utils.sheet_to_csv(sheet)
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `taskqueue-${from}_${to}.csv`)
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}
