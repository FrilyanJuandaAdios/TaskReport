import {
  addDays,
  differenceInCalendarDays,
  endOfMonth,
  endOfWeek,
  format,
  isValid,
  parse,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import type { HHmm, ISODate } from '@/types/domain'

/**
 * All calendar-day handling goes through here.
 *
 * Rule: an `ISODate` is a *local* calendar day string. Never build one with
 * `toISOString().slice(0, 10)` — that silently shifts the day for anyone east or
 * west of UTC, which would file evening work under tomorrow's date.
 */

export const DATE_KEY_FORMAT = 'yyyy-MM-dd'

export function toISODate(date: Date): ISODate {
  return format(date, DATE_KEY_FORMAT)
}

export function fromISODate(date: ISODate): Date {
  const parsed = parse(date, DATE_KEY_FORMAT, new Date())
  return isValid(parsed) ? parsed : new Date()
}

export function today(): ISODate {
  return toISODate(new Date())
}

export function isToday(date: ISODate): boolean {
  return date === today()
}

export function addDaysISO(date: ISODate, days: number): ISODate {
  return toISODate(addDays(fromISODate(date), days))
}

export function daysBetween(from: ISODate, to: ISODate): number {
  return differenceInCalendarDays(fromISODate(to), fromISODate(from))
}

/** "Wednesday, 26 August 2026" — the Today page subtitle. */
export function formatLongDate(date: ISODate | Date): string {
  const value = typeof date === 'string' ? fromISODate(date) : date
  return format(value, 'EEEE, d MMMM yyyy')
}

/** "26 August 2026" — report headings. */
export function formatReportDate(date: ISODate): string {
  return format(fromISODate(date), 'd MMMM yyyy')
}

/** "Aug 26" — dense table/list cells. */
export function formatShortDate(date: ISODate | null | undefined): string {
  if (!date) return '—'
  return format(fromISODate(date), 'MMM d')
}

/** "Aug 26, 2026" — cells that may cross a year boundary. */
export function formatMediumDate(date: ISODate | null | undefined): string {
  if (!date) return '—'
  return format(fromISODate(date), 'MMM d, yyyy')
}

export function formatMonthTitle(date: Date): string {
  return format(date, 'MMMM yyyy')
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy HH:mm')
}

export function formatTimeOfDay(iso: string): string {
  return format(parseISO(iso), 'HH:mm')
}

/**
 * Relative wording for due chips. Lower-case on purpose: it is always read as a
 * continuation ("Deliver tomorrow", "Target in 3 days"), never as a sentence.
 */
export function describeRelativeDay(date: ISODate): string {
  const diff = daysBetween(today(), date)
  if (diff === 0) return 'today'
  if (diff === 1) return 'tomorrow'
  if (diff === -1) return 'yesterday'
  if (diff > 1 && diff <= 7) return `in ${diff} days`
  if (diff < -1 && diff >= -7) return `${Math.abs(diff)} days ago`
  return formatMediumDate(date)
}

export function greetingFor(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

/** Inclusive list of every day between two ISO dates. */
export function eachDayISO(from: ISODate, to: ISODate): ISODate[] {
  const days: ISODate[] = []
  let cursor = from
  let guard = 0
  while (cursor <= to && guard < 5000) {
    days.push(cursor)
    cursor = addDaysISO(cursor, 1)
    guard += 1
  }
  return days
}

export function monthRange(anchor: Date): { from: ISODate; to: ISODate } {
  return { from: toISODate(startOfMonth(anchor)), to: toISODate(endOfMonth(anchor)) }
}

/** Monday-first grid covering a whole month, padded to full weeks. */
export function monthGridDays(anchor: Date): Date[] {
  const gridStart = startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 })
  const gridEnd = endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 })
  const days: Date[] = []
  let cursor = gridStart
  while (cursor <= gridEnd) {
    days.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return days
}

export function weekRange(anchor = new Date()): { from: ISODate; to: ISODate } {
  return {
    from: toISODate(startOfWeek(anchor, { weekStartsOn: 1 })),
    to: toISODate(endOfWeek(anchor, { weekStartsOn: 1 })),
  }
}

export function currentTime(): HHmm {
  return format(new Date(), 'HH:mm')
}

/** Accepts "9", "930", "9:30", "0930" and normalises to "09:30". Invalid => null. */
export function parseTimeInput(value: string): HHmm | null {
  const raw = value.trim()
  if (!raw) return null
  const digitsOnly = raw.replace(/[^\d]/g, '')
  let hours: number
  let minutes: number

  if (raw.includes(':')) {
    const [h, m] = raw.split(':')
    hours = Number(h)
    minutes = Number(m ?? 0)
  } else if (digitsOnly.length <= 2) {
    hours = Number(digitsOnly)
    minutes = 0
  } else {
    hours = Number(digitsOnly.slice(0, digitsOnly.length - 2))
    minutes = Number(digitsOnly.slice(-2))
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function isOverdue(target: ISODate | null | undefined, actual?: ISODate | null): boolean {
  if (!target) return false
  if (actual) return actual > target
  return target < today()
}
