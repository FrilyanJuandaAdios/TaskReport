import { getRepository } from '@/repositories'
import { logActivity } from './activityService'
import { findOrCreateProject, findOrCreateRequester, findOrCreateTag } from './catalogService'
import { parseQuickTask, type ParsedQuickTask } from './quickParse'
import { newId, nowISO, sortBy } from '@/lib/utils'
import { currentTime, isToday, today } from '@/lib/date'
import type {
  CreateTaskInput,
  ID,
  ISODate,
  Task,
  TaskFilter,
  TaskStatus,
  TaskWithRelations,
} from '@/types/domain'

/**
 * Task use-cases. This is where business rules live:
 * - a task added on the current day *after* the morning check-in is unplanned;
 * - status changes stamp `startedAt` / `completedAt` for the audit trail;
 * - quick-add resolves @requester / #project tokens into real records.
 */

/* --------------------------------- Reads ---------------------------------- */

export async function getTasksForDate(date: ISODate): Promise<TaskWithRelations[]> {
  const tasks = await getRepository().tasks.listByDate(date)
  return hydrateTasks(tasks)
}

export async function getTasksInRange(from: ISODate, to: ISODate): Promise<TaskWithRelations[]> {
  const tasks = await getRepository().tasks.listByDateRange(from, to)
  return hydrateTasks(tasks)
}

export async function getTasksForDelivery(deliveryId: ID): Promise<TaskWithRelations[]> {
  const tasks = await getRepository().tasks.listByDelivery(deliveryId)
  return hydrateTasks(tasks)
}

export async function searchTasks(filter: TaskFilter): Promise<TaskWithRelations[]> {
  const tasks = await getRepository().tasks.search(filter)
  return hydrateTasks(tasks)
}

export async function getTask(id: ID): Promise<TaskWithRelations | null> {
  const task = await getRepository().tasks.getById(id)
  if (!task) return null
  const [hydrated] = await hydrateTasks([task])
  return hydrated ?? null
}

/**
 * Joins tasks with their project / requester / delivery / tags in one pass.
 * Lookup tables are small (tens of rows), so a single full read beats N queries
 * on both drivers.
 */
export async function hydrateTasks(tasks: Task[]): Promise<TaskWithRelations[]> {
  if (tasks.length === 0) return []
  const repository = getRepository()

  const [projects, requesters, tags, deliveries] = await Promise.all([
    repository.projects.list(),
    repository.requesters.list(),
    repository.tags.list(),
    repository.deliveries.list(),
  ])

  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const requesterMap = new Map(requesters.map((requester) => [requester.id, requester]))
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))
  const deliveryMap = new Map(deliveries.map((delivery) => [delivery.id, delivery]))

  const hydrated = tasks.map<TaskWithRelations>((task) => ({
    ...task,
    project: task.projectId ? (projectMap.get(task.projectId) ?? null) : null,
    requester: task.requesterId ? (requesterMap.get(task.requesterId) ?? null) : null,
    delivery: task.deliveryId ? (deliveryMap.get(task.deliveryId) ?? null) : null,
    tags: task.tagIds.map((id) => tagMap.get(id)).filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
  }))

  return sortTasks(hydrated)
}

/** Scheduled tasks first (by clock time), then anytime tasks in manual order. */
export function sortTasks<T extends Task>(tasks: T[]): T[] {
  return sortBy(
    tasks,
    (a, b) => Number(Boolean(b.plannedTime)) - Number(Boolean(a.plannedTime)),
    (a, b) => (a.plannedTime ?? '').localeCompare(b.plannedTime ?? ''),
    (a, b) => a.order - b.order,
    (a, b) => a.createdAt.localeCompare(b.createdAt),
  )
}

/* -------------------------------- Writes ---------------------------------- */

/**
 * Anything typed on today's page after the workday has begun and after at least
 * one task already exists is treated as unplanned work, matching the brief's
 * "added during the day" bucket. The caller can always override.
 */
async function inferIsPlanned(date: ISODate, explicit?: boolean): Promise<boolean> {
  if (explicit !== undefined) return explicit
  if (!isToday(date)) return true

  const existing = await getRepository().tasks.listByDate(date)
  if (existing.length === 0) return true

  const firstCreatedAt = existing
    .map((task) => task.createdAt)
    .sort((a, b) => a.localeCompare(b))[0]

  // Within 90 minutes of the first entry of the day => still the morning plan.
  const minutesSinceFirst = (Date.now() - new Date(firstCreatedAt).getTime()) / 60000
  return minutesSinceFirst < 90
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  const repository = getRepository()
  const timestamp = nowISO()
  const sameDay = await repository.tasks.listByDate(input.date)

  const task: Task = {
    id: newId(),
    title: input.title.trim(),
    description: input.description,
    date: input.date,
    plannedTime: input.plannedTime ?? null,
    reminderTime: input.reminderTime ?? null,
    startTime: null,
    endTime: null,
    status: input.status ?? 'planned',
    targetDate: input.targetDate ?? null,
    isPlanned: await inferIsPlanned(input.date, input.isPlanned),
    priority: input.priority ?? 'normal',
    projectId: input.projectId ?? null,
    requesterId: input.requesterId ?? null,
    deliveryId: input.deliveryId ?? null,
    tagIds: input.tagIds ?? [],
    notes: input.notes,
    startedAt: null,
    completedAt: null,
    order: input.order ?? sameDay.length,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const created = await repository.tasks.create(task)
  await logActivity('task', created.id, 'task.created', `Created "${created.title}"`, {
    date: created.date,
    isPlanned: created.isPlanned,
  })
  return created
}

/**
 * The fast path used by the Today page input.
 * Resolves quick-add tokens, creating any project / requester / tag it did not
 * recognise so the user never has to leave the input.
 */
export async function quickAddTask(
  rawInput: string,
  date: ISODate = today(),
  /** Pre-set links, e.g. when logging work from inside a delivery. */
  defaults: Pick<CreateTaskInput, 'deliveryId' | 'projectId' | 'requesterId'> = {},
): Promise<{ task: Task; parsed: ParsedQuickTask }> {
  const repository = getRepository()
  const [projects, requesters] = await Promise.all([
    repository.projects.list(),
    repository.requesters.list(),
  ])

  const parsed = parseQuickTask(rawInput, { projects, requesters })

  let projectId = parsed.projectId ?? null
  if (!projectId && parsed.unknownProjectName) {
    projectId = (await findOrCreateProject(parsed.unknownProjectName)).id
  }
  projectId ??= defaults.projectId ?? null

  let requesterId = parsed.requesterId ?? null
  if (!requesterId && parsed.unknownRequesterName) {
    requesterId = (await findOrCreateRequester(parsed.unknownRequesterName)).id
  }
  requesterId ??= defaults.requesterId ?? null

  const tagIds = await Promise.all(
    parsed.tagNames.map(async (name) => (await findOrCreateTag(name)).id),
  )

  const task = await createTask({
    title: parsed.title,
    date,
    plannedTime: parsed.plannedTime ?? null,
    targetDate: parsed.targetDate ?? null,
    priority: parsed.priority ?? 'normal',
    projectId,
    requesterId,
    deliveryId: defaults.deliveryId ?? null,
    tagIds,
  })

  return { task, parsed }
}

/** Adds pasted lines in order so their manual ordering remains deterministic. */
export async function bulkQuickAddTasks(
  lines: string[],
  date: ISODate = today(),
  defaults: Pick<CreateTaskInput, 'deliveryId' | 'projectId' | 'requesterId'> = {},
): Promise<Task[]> {
  const tasks: Task[] = []
  for (const line of lines) {
    const { task } = await quickAddTask(line, date, defaults)
    tasks.push(task)
  }
  return tasks
}

export async function updateTask(id: ID, patch: Partial<Task>): Promise<Task> {
  const updated = await getRepository().tasks.update(id, { ...patch, updatedAt: nowISO() })
  await logActivity('task', id, 'task.updated', `Updated "${updated.title}"`)
  return updated
}

const STATUS_ACTIVITY: Record<TaskStatus, { action: 'task.started' | 'task.completed' | 'task.reopened' | 'task.blocked' | 'task.cancelled'; verb: string }> = {
  planned: { action: 'task.reopened', verb: 'Reopened' },
  in_progress: { action: 'task.started', verb: 'Started' },
  completed: { action: 'task.completed', verb: 'Completed' },
  blocked: { action: 'task.blocked', verb: 'Blocked' },
  cancelled: { action: 'task.cancelled', verb: 'Cancelled' },
}

/**
 * Single entry point for status changes — the checkbox, the status chip and the
 * edit form all funnel through here so the audit stamps stay consistent.
 */
export async function setTaskStatus(id: ID, status: TaskStatus): Promise<Task> {
  const repository = getRepository()
  const task = await repository.tasks.getById(id)
  if (!task) throw new Error(`Task ${id} not found`)
  if (task.status === status) return task

  const timestamp = nowISO()
  const patch: Partial<Task> = { status, updatedAt: timestamp }

  if (status === 'in_progress' && !task.startedAt) {
    patch.startedAt = timestamp
    patch.startTime = currentTime()
  }

  if (status === 'completed') {
    patch.completedAt = timestamp
    patch.endTime = currentTime()
    if (!task.startedAt) patch.startedAt = timestamp
  }

  // Reopening clears the completion stamp but keeps the original start.
  if (task.status === 'completed' && status !== 'completed') {
    patch.completedAt = null
    patch.endTime = null
  }

  const updated = await repository.tasks.update(id, patch)
  const meta = STATUS_ACTIVITY[status]
  await logActivity('task', id, meta.action, `${meta.verb} "${task.title}"`, {
    from: task.status,
    to: status,
  })
  return updated
}

export function toggleTaskCompleted(task: Task): Promise<Task> {
  return setTaskStatus(task.id, task.status === 'completed' ? 'planned' : 'completed')
}

export async function deleteTask(id: ID): Promise<void> {
  const repository = getRepository()
  const task = await repository.tasks.getById(id)
  await repository.tasks.remove(id)
  if (task) {
    await logActivity('task', id, 'task.deleted', `Deleted "${task.title}"`)
  }
}

/**
 * Move every still-open task from a previous day onto a new day. Used by the
 * "carry over unfinished work" action on the Today page.
 */
export async function carryOverTasks(from: ISODate, to: ISODate): Promise<number> {
  const repository = getRepository()
  const tasks = await repository.tasks.listByDate(from)
  const open = tasks.filter(
    (task) => task.status === 'planned' || task.status === 'in_progress' || task.status === 'blocked',
  )

  const existingToday = await repository.tasks.listByDate(to)
  let order = existingToday.length

  for (const task of open) {
    await createTask({
      title: task.title,
      date: to,
      description: task.description,
      plannedTime: task.plannedTime,
      targetDate: task.targetDate,
      status: task.status === 'blocked' ? 'blocked' : task.status,
      isPlanned: true,
      priority: task.priority,
      projectId: task.projectId,
      requesterId: task.requesterId,
      deliveryId: task.deliveryId,
      tagIds: task.tagIds,
      notes: task.notes,
      order: order++,
    })
  }

  return open.length
}
