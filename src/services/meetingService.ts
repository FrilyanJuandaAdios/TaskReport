import { getISODay } from 'date-fns'
import { getRepository } from '@/repositories'
import { logActivity } from './activityService'
import { newId, nowISO, sortBy } from '@/lib/utils'
import { eachDayISO, fromISODate } from '@/lib/date'
import type {
  CreateMeetingInput,
  ID,
  ISODate,
  Meeting,
  MeetingLog,
  MeetingOccurrence,
  MeetingStatus,
  MeetingWithRelations,
  UpdateMeetingInput,
} from '@/types/domain'

/**
 * Meeting schedules.
 *
 * A meeting is stored once as a *rule* ("every weekday at 09:15") and expanded
 * against a date on read. Writing 250 rows a year for a daily stand-up would
 * make the schedule impossible to edit and the archive impossible to trust.
 *
 * What actually happened on a given day lives in `MeetingLog`, which is created
 * lazily — the first time you mark a meeting attended or skipped.
 */

export const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5]

/** Does this schedule produce an occurrence on `date`? */
export function meetingOccursOn(meeting: Meeting, date: ISODate): boolean {
  if (!meeting.isActive) return false
  if (meeting.startDate && date < meeting.startDate) return false
  if (meeting.endDate && date > meeting.endDate) return false

  const isoWeekday = getISODay(fromISODate(date)) // 1 = Monday … 7 = Sunday

  switch (meeting.recurrence) {
    case 'daily':
      return true
    case 'weekdays':
      return WEEKDAYS_ONLY.includes(isoWeekday)
    case 'weekly':
      return meeting.weekdays.includes(isoWeekday)
    case 'once':
      return meeting.date === date
  }
}

/** Human-readable rule, e.g. "Every weekday · 09:15 · 30m". */
export function describeRecurrence(meeting: Meeting): string {
  const parts: string[] = []

  switch (meeting.recurrence) {
    case 'daily':
      parts.push('Every day')
      break
    case 'weekdays':
      parts.push('Every weekday')
      break
    case 'weekly':
      parts.push(
        meeting.weekdays.length === 0
          ? 'Weekly'
          : meeting.weekdays
              .slice()
              .sort((a, b) => a - b)
              .map((day) => WEEKDAY_LABELS[day - 1])
              .join(', '),
      )
      break
    case 'once':
      parts.push(meeting.date ? `Once on ${meeting.date}` : 'Once')
      break
  }

  parts.push(meeting.time)
  if (meeting.durationMinutes) parts.push(`${meeting.durationMinutes}m`)
  return parts.join(' · ')
}

export function meetingEndTime(meeting: Meeting): string {
  const [hours, minutes] = meeting.time.split(':').map(Number)
  const total = hours * 60 + minutes + meeting.durationMinutes
  const endHours = Math.floor(total / 60) % 24
  const endMinutes = total % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
}

/* --------------------------------- Reads ---------------------------------- */

export async function listMeetings(): Promise<MeetingWithRelations[]> {
  const repository = getRepository()
  const [meetings, projects, requesters] = await Promise.all([
    repository.meetings.list(),
    repository.projects.list(),
    repository.requesters.list(),
  ])

  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const requesterMap = new Map(requesters.map((requester) => [requester.id, requester]))

  return sortBy(
    meetings.map<MeetingWithRelations>((meeting) => ({
      ...meeting,
      project: meeting.projectId ? (projectMap.get(meeting.projectId) ?? null) : null,
      requester: meeting.requesterId ? (requesterMap.get(meeting.requesterId) ?? null) : null,
    })),
    (a, b) => Number(b.isActive) - Number(a.isActive),
    (a, b) => a.time.localeCompare(b.time),
    (a, b) => a.title.localeCompare(b.title),
  )
}

/** Every meeting that lands on `date`, sorted by start time. */
export async function getMeetingsForDate(date: ISODate): Promise<MeetingOccurrence[]> {
  const [meetings, logs] = await Promise.all([
    listMeetings(),
    getRepository().meetingLogs.listByDate(date),
  ])

  const logByMeeting = new Map(logs.map((log) => [log.meetingId, log]))

  return meetings
    .filter((meeting) => meetingOccursOn(meeting, date))
    .map<MeetingOccurrence>((meeting) => {
      const log = logByMeeting.get(meeting.id) ?? null
      return { date, meeting, log, status: log?.status ?? 'scheduled' }
    })
    .sort((a, b) => a.meeting.time.localeCompare(b.meeting.time))
}

/**
 * Occurrence counts per day across a range — used by the History calendar.
 * One pass over the schedule per day rather than a query per day.
 */
export async function countMeetingsPerDay(
  from: ISODate,
  to: ISODate,
): Promise<Map<ISODate, number>> {
  const meetings = await getRepository().meetings.list()
  const counts = new Map<ISODate, number>()

  for (const date of eachDayISO(from, to)) {
    const count = meetings.filter((meeting) => meetingOccursOn(meeting, date)).length
    if (count > 0) counts.set(date, count)
  }

  return counts
}

export function listMeetingLogs(meetingId: ID): Promise<MeetingLog[]> {
  return getRepository().meetingLogs.listByMeeting(meetingId)
}

/* --------------------------------- Writes --------------------------------- */

export async function createMeeting(input: CreateMeetingInput): Promise<Meeting> {
  const timestamp = nowISO()
  const meeting: Meeting = {
    id: newId(),
    title: input.title.trim(),
    time: input.time,
    durationMinutes: input.durationMinutes ?? 30,
    recurrence: input.recurrence ?? 'weekdays',
    weekdays: input.weekdays ?? [],
    date: input.date ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    projectId: input.projectId ?? null,
    requesterId: input.requesterId ?? null,
    link: input.link,
    notes: input.notes,
    isActive: input.isActive ?? true,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const created = await getRepository().meetings.create(meeting)
  await logActivity('meeting', created.id, 'meeting.created', `Scheduled "${created.title}"`)
  return created
}

export async function updateMeeting(id: ID, patch: UpdateMeetingInput): Promise<Meeting> {
  const updated = await getRepository().meetings.update(id, { ...patch, updatedAt: nowISO() })
  await logActivity('meeting', id, 'meeting.updated', `Updated "${updated.title}"`)
  return updated
}

/** Removes the schedule and every day it recorded. */
export async function deleteMeeting(id: ID): Promise<void> {
  const repository = getRepository()
  const [meeting, logs] = await Promise.all([
    repository.meetings.getById(id),
    repository.meetingLogs.listByMeeting(id),
  ])

  await Promise.all(logs.map((log) => repository.meetingLogs.remove(log.id)))
  await repository.meetings.remove(id)

  if (meeting) {
    await logActivity('meeting', id, 'meeting.deleted', `Removed "${meeting.title}"`)
  }
}

/**
 * Record what happened on one date. Creates the log row on first use and
 * updates it afterwards, so an untouched day stores nothing at all.
 */
export async function setMeetingStatus(
  meetingId: ID,
  date: ISODate,
  status: MeetingStatus,
  notes?: string,
): Promise<MeetingLog> {
  const repository = getRepository()
  const existing = (await repository.meetingLogs.listByDate(date)).find(
    (log) => log.meetingId === meetingId,
  )
  const timestamp = nowISO()

  const saved = existing
    ? await repository.meetingLogs.update(existing.id, {
        status,
        notes: notes ?? existing.notes,
        updatedAt: timestamp,
      })
    : await repository.meetingLogs.create({
        id: newId(),
        meetingId,
        date,
        status,
        notes,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

  if (status === 'attended' || status === 'skipped') {
    const meeting = await repository.meetings.getById(meetingId)
    await logActivity(
      'meeting',
      meetingId,
      status === 'attended' ? 'meeting.attended' : 'meeting.skipped',
      `${status === 'attended' ? 'Attended' : 'Skipped'} "${meeting?.title ?? 'meeting'}" on ${date}`,
    )
  }

  return saved
}
