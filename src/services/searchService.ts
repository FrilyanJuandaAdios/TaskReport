import { getRepository } from '@/repositories'
import { hydrateTasks } from './taskService'
import { hydrateDeliveries } from './deliveryService'
import { matches } from '@/lib/utils'
import type {
  DailyReport,
  DeliveryFilter,
  DeliveryWithRelations,
  TaskFilter,
  TaskWithRelations,
} from '@/types/domain'

/**
 * Global search — the long-term archive lookup from the brief.
 *
 * Deliberately a *structured* search across every entity rather than an
 * embedding index: at personal scale (a few thousand rows a year) a filtered
 * scan is instant, exact, and needs no extra infrastructure.
 *
 * Requester and project names are resolved before matching so typing "David"
 * finds tasks requested by David even though the task row only stores an id.
 */

export interface GlobalSearchResult {
  tasks: TaskWithRelations[]
  deliveries: DeliveryWithRelations[]
  reports: DailyReport[]
  total: number
}

export async function globalSearch(query: string, limit = 40): Promise<GlobalSearchResult> {
  const trimmed = query.trim()
  if (trimmed.length === 0) {
    return { tasks: [], deliveries: [], reports: [], total: 0 }
  }

  const repository = getRepository()
  const [allTasks, allDeliveries, allReports, projects, requesters, tags] = await Promise.all([
    repository.tasks.list(),
    repository.deliveries.list(),
    repository.reports.list(),
    repository.projects.list(),
    repository.requesters.list(),
    repository.tags.list(),
  ])

  const projectIds = new Set(
    projects
      .filter((project) => matches(project.name, trimmed) || matches(project.code, trimmed))
      .map((project) => project.id),
  )
  const requesterIds = new Set(
    requesters
      .filter(
        (requester) => matches(requester.name, trimmed) || matches(requester.team, trimmed),
      )
      .map((requester) => requester.id),
  )
  const tagIds = new Set(
    tags.filter((tag) => matches(tag.name, trimmed)).map((tag) => tag.id),
  )

  const tasks = allTasks.filter(
    (task) =>
      matches(task.title, trimmed) ||
      matches(task.description, trimmed) ||
      matches(task.notes, trimmed) ||
      matches(task.date, trimmed) ||
      (task.projectId && projectIds.has(task.projectId)) ||
      (task.requesterId && requesterIds.has(task.requesterId)) ||
      task.tagIds.some((id) => tagIds.has(id)),
  )

  const deliveries = allDeliveries.filter(
    (delivery) =>
      matches(delivery.title, trimmed) ||
      matches(delivery.description, trimmed) ||
      matches(delivery.notes, trimmed) ||
      matches(delivery.requestedDate, trimmed) ||
      matches(delivery.targetDeliveryDate, trimmed) ||
      (delivery.projectId && projectIds.has(delivery.projectId)) ||
      (delivery.requesterId && requesterIds.has(delivery.requesterId)) ||
      delivery.tagIds.some((id) => tagIds.has(id)),
  )

  const reports = allReports.filter(
    (report) =>
      matches(report.date, trimmed) ||
      matches(report.issues, trimmed) ||
      matches(report.nextSteps, trimmed) ||
      matches(report.notes, trimmed) ||
      matches(report.bodyOverride, trimmed),
  )

  const total = tasks.length + deliveries.length + reports.length

  const [hydratedTasks, hydratedDeliveries] = await Promise.all([
    hydrateTasks(tasks.slice(0, limit)),
    hydrateDeliveries(deliveries.slice(0, limit)),
  ])

  return {
    tasks: [...hydratedTasks].sort((a, b) => b.date.localeCompare(a.date)),
    deliveries: hydratedDeliveries,
    reports: reports.slice(0, limit).sort((a, b) => b.date.localeCompare(a.date)),
    total,
  }
}

export async function searchTasksAdvanced(filter: TaskFilter): Promise<TaskWithRelations[]> {
  const tasks = await getRepository().tasks.search(filter)
  const hydrated = await hydrateTasks(tasks)
  return [...hydrated].sort((a, b) => b.date.localeCompare(a.date))
}

export async function searchDeliveriesAdvanced(
  filter: DeliveryFilter,
): Promise<DeliveryWithRelations[]> {
  const deliveries = await getRepository().deliveries.search(filter)
  return hydrateDeliveries(deliveries)
}
