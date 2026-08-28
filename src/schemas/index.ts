import { z } from 'zod'
import {
  DELIVERY_STATUSES,
  MEETING_RECURRENCES,
  PRIORITIES,
  PROJECT_STATUSES,
  TASK_STATUSES,
} from '@/types/domain'

/**
 * Validation lives next to the domain, not inside components.
 * Messages are written to be shown verbatim under a field.
 */

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD')

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use a 24-hour time such as 09:30')

const optionalUrl = z
  .string()
  .trim()
  .url('Enter a full URL starting with https://')
  .or(z.literal(''))
  .optional()

export const quickTaskSchema = z.object({
  title: z.string().trim().min(1, 'Type what you are working on').max(200, 'Keep it under 200 characters'),
})
export type QuickTaskValues = z.infer<typeof quickTaskSchema>

export const taskDetailsSchema = z.object({
  title: z.string().trim().min(1, 'Task name is required').max(200),
  description: z.string().max(2000).optional(),
  date: isoDate,
  plannedTime: hhmm.nullable().optional(),
  reminderTime: hhmm.nullable().optional(),
  targetDate: isoDate.nullable().optional(),
  status: z.enum(TASK_STATUSES),
  priority: z.enum(PRIORITIES),
  isPlanned: z.boolean(),
  projectId: z.string().nullable().optional(),
  requesterId: z.string().nullable().optional(),
  deliveryId: z.string().nullable().optional(),
  tagIds: z.array(z.string()).default([]),
  notes: z.string().max(4000).optional(),
})
export type TaskDetailsValues = z.infer<typeof taskDetailsSchema>

export const deliverySchema = z
  .object({
    title: z.string().trim().min(1, 'Delivery name is required').max(200),
    description: z.string().max(4000).optional(),
    projectId: z.string().nullable().optional(),
    requesterId: z.string().nullable().optional(),
    requestedDate: isoDate,
    targetDeliveryDate: isoDate.nullable().optional(),
    actualDeliveryDate: isoDate.nullable().optional(),
    status: z.enum(DELIVERY_STATUSES),
    figmaUrl: optionalUrl,
    ticketUrl: optionalUrl,
    referenceUrl: optionalUrl,
    notes: z.string().max(4000).optional(),
    tagIds: z.array(z.string()).default([]),
  })
  .refine(
    (value) => !value.targetDeliveryDate || value.targetDeliveryDate >= value.requestedDate,
    { path: ['targetDeliveryDate'], message: 'Target cannot be before the request date' },
  )
  .refine((value) => value.status !== 'delivered' || Boolean(value.actualDeliveryDate), {
    path: ['actualDeliveryDate'],
    message: 'A delivered item needs an actual delivery date',
  })
export type DeliveryValues = z.infer<typeof deliverySchema>

export const projectSchema = z.object({
  name: z.string().trim().min(1, 'Project name is required').max(80),
  code: z.string().trim().max(12, 'Keep the code short, e.g. CSM').optional(),
  description: z.string().max(500).optional(),
  color: z.string().min(1),
  status: z.enum(PROJECT_STATUSES),
})
export type ProjectValues = z.infer<typeof projectSchema>

export const requesterSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  team: z.string().trim().max(80).optional(),
  email: z.string().trim().email('Enter a valid email').or(z.literal('')).optional(),
  notes: z.string().max(500).optional(),
})
export type RequesterValues = z.infer<typeof requesterSchema>

export const tagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Tag name is required')
    .max(30)
    .regex(/^[^\s#]+$/, 'Tags cannot contain spaces or #'),
})
export type TagValues = z.infer<typeof tagSchema>

export const meetingSchema = z
  .object({
    title: z.string().trim().min(1, 'Meeting name is required').max(120),
    time: hhmm,
    durationMinutes: z
      .number({ invalid_type_error: 'Enter a number of minutes' })
      .int()
      .min(5, 'At least 5 minutes')
      .max(480, 'Keep it under 8 hours'),
    recurrence: z.enum(MEETING_RECURRENCES),
    weekdays: z.array(z.number().int().min(1).max(7)).default([]),
    date: isoDate.nullable().optional(),
    projectId: z.string().nullable().optional(),
    requesterId: z.string().nullable().optional(),
    link: optionalUrl,
    notes: z.string().max(1000).optional(),
    isActive: z.boolean(),
  })
  .refine((value) => value.recurrence !== 'weekly' || value.weekdays.length > 0, {
    path: ['weekdays'],
    message: 'Pick at least one day',
  })
  .refine((value) => value.recurrence !== 'once' || Boolean(value.date), {
    path: ['date'],
    message: 'Pick the date it happens',
  })
export type MeetingValues = z.infer<typeof meetingSchema>

export const dailyReportSchema = z.object({
  date: isoDate,
  issues: z.string().max(4000),
  nextSteps: z.string().max(4000),
  notes: z.string().max(4000),
  bodyOverride: z.string().max(20000).optional(),
})
export type DailyReportValues = z.infer<typeof dailyReportSchema>

export const settingsSchema = z.object({
  userName: z.string().trim().min(1, 'Name is required').max(60),
  workdayStart: hhmm,
  workdayEnd: hhmm,
  theme: z.enum(['light', 'dark', 'system']),
  morningReminderEnabled: z.boolean(),
  morningReminderTime: hhmm,
  eveningReminderEnabled: z.boolean(),
  eveningReminderTime: hhmm,
})
export type SettingsValues = z.infer<typeof settingsSchema>

/** Shape of the full JSON backup file — also used to validate an import. */
export const backupSchema = z.object({
  version: z.literal(1),
  exportedAt: z.string(),
  driver: z.string(),
  data: z.object({
    projects: z.array(z.record(z.unknown())),
    requesters: z.array(z.record(z.unknown())),
    tags: z.array(z.record(z.unknown())),
    deliveries: z.array(z.record(z.unknown())),
    tasks: z.array(z.record(z.unknown())),
    reports: z.array(z.record(z.unknown())),
    // Optional so a backup taken before meetings existed still restores.
    meetings: z.array(z.record(z.unknown())).default([]),
    meetingLogs: z.array(z.record(z.unknown())).default([]),
    activity: z.array(z.record(z.unknown())),
    settings: z.record(z.unknown()).nullable(),
  }),
})
export type BackupFile = z.infer<typeof backupSchema>
