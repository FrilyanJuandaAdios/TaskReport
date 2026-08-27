import { getRepository } from '@/repositories'
import { logActivity } from './activityService'
import { hydrateTasks } from './taskService'
import { newId, nowISO } from '@/lib/utils'
import { today } from '@/lib/date'
import { DELIVERY_STATUS_META } from '@/constants/status'
import type {
  CreateDeliveryInput,
  Delivery,
  DeliveryFilter,
  DeliveryStatus,
  DeliveryWithRelations,
  ID,
  TaskWithRelations,
} from '@/types/domain'

/**
 * Delivery use-cases.
 *
 * A Delivery is the long-running unit of work a stakeholder actually asked for;
 * Tasks are the daily steps taken towards it. Marking a delivery `delivered`
 * stamps the actual date automatically so the tracker never shows a delivered
 * row with an empty Delivered column.
 */

export async function listDeliveries(
  filter: DeliveryFilter = {},
): Promise<DeliveryWithRelations[]> {
  const repository = getRepository()
  const deliveries = await repository.deliveries.search(filter)
  return hydrateDeliveries(deliveries)
}

export async function getDelivery(id: ID): Promise<DeliveryWithRelations | null> {
  const delivery = await getRepository().deliveries.getById(id)
  if (!delivery) return null
  const [hydrated] = await hydrateDeliveries([delivery])
  return hydrated ?? null
}

export async function hydrateDeliveries(
  deliveries: Delivery[],
): Promise<DeliveryWithRelations[]> {
  if (deliveries.length === 0) return []
  const repository = getRepository()

  const [projects, requesters, tags, allTasks] = await Promise.all([
    repository.projects.list(),
    repository.requesters.list(),
    repository.tags.list(),
    repository.tasks.list(),
  ])

  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const requesterMap = new Map(requesters.map((requester) => [requester.id, requester]))
  const tagMap = new Map(tags.map((tag) => [tag.id, tag]))

  const taskCounts = new Map<ID, number>()
  for (const task of allTasks) {
    if (!task.deliveryId) continue
    taskCounts.set(task.deliveryId, (taskCounts.get(task.deliveryId) ?? 0) + 1)
  }

  return deliveries.map((delivery) => ({
    ...delivery,
    project: delivery.projectId ? (projectMap.get(delivery.projectId) ?? null) : null,
    requester: delivery.requesterId ? (requesterMap.get(delivery.requesterId) ?? null) : null,
    tags: delivery.tagIds
      .map((id) => tagMap.get(id))
      .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag)),
    taskCount: taskCounts.get(delivery.id) ?? 0,
  }))
}

/** The daily work log behind a delivery — the audit view from the brief. */
export function getDeliveryWorkLog(deliveryId: ID): Promise<TaskWithRelations[]> {
  return getRepository()
    .tasks.listByDelivery(deliveryId)
    .then(hydrateTasks)
    .then((tasks) => [...tasks].sort((a, b) => a.date.localeCompare(b.date)))
}

export async function createDelivery(input: CreateDeliveryInput): Promise<Delivery> {
  const timestamp = nowISO()
  const delivery: Delivery = {
    id: newId(),
    title: input.title.trim(),
    description: input.description,
    projectId: input.projectId ?? null,
    requesterId: input.requesterId ?? null,
    requestedDate: input.requestedDate,
    targetDeliveryDate: input.targetDeliveryDate ?? null,
    actualDeliveryDate: input.actualDeliveryDate ?? null,
    status: input.status ?? 'not_started',
    figmaUrl: input.figmaUrl,
    ticketUrl: input.ticketUrl,
    referenceUrl: input.referenceUrl,
    notes: input.notes,
    tagIds: input.tagIds ?? [],
    deliveredAt: input.deliveredAt ?? null,
    revisionCount: input.revisionCount ?? 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  const created = await getRepository().deliveries.create(delivery)
  await logActivity('delivery', created.id, 'delivery.created', `Created "${created.title}"`)
  return created
}

export async function updateDelivery(id: ID, patch: Partial<Delivery>): Promise<Delivery> {
  const repository = getRepository()
  const before = await repository.deliveries.getById(id)
  if (!before) throw new Error(`Delivery ${id} not found`)

  const next: Partial<Delivery> = { ...patch, updatedAt: nowISO() }

  if (patch.status && patch.status !== before.status) {
    applyStatusSideEffects(before, next, patch.status)
  }

  const updated = await repository.deliveries.update(id, next)

  if (patch.status && patch.status !== before.status) {
    const action =
      patch.status === 'delivered'
        ? 'delivery.delivered'
        : patch.status === 'revision'
          ? 'delivery.revised'
          : 'delivery.status_changed'
    await logActivity(
      'delivery',
      id,
      action,
      `${before.title}: ${DELIVERY_STATUS_META[before.status].label} → ${DELIVERY_STATUS_META[patch.status].label}`,
      { from: before.status, to: patch.status },
    )
  } else {
    await logActivity('delivery', id, 'delivery.updated', `Updated "${updated.title}"`)
  }

  return updated
}

/** Keeps delivery date stamps and revision counters honest on every transition. */
function applyStatusSideEffects(
  before: Delivery,
  next: Partial<Delivery>,
  status: DeliveryStatus,
): void {
  if (status === 'delivered') {
    next.actualDeliveryDate = before.actualDeliveryDate ?? today()
    next.deliveredAt = before.deliveredAt ?? nowISO()
    return
  }

  if (status === 'revision') {
    next.revisionCount = before.revisionCount + 1
  }

  // Moving out of "delivered" means it was not actually delivered yet.
  if (before.status === 'delivered') {
    next.actualDeliveryDate = null
    next.deliveredAt = null
  }
}

export function setDeliveryStatus(id: ID, status: DeliveryStatus): Promise<Delivery> {
  return updateDelivery(id, { status })
}

/** Unlinks tasks before removing the delivery so the work log survives. */
export async function deleteDelivery(id: ID): Promise<void> {
  const repository = getRepository()
  const [delivery, tasks] = await Promise.all([
    repository.deliveries.getById(id),
    repository.tasks.listByDelivery(id),
  ])

  await Promise.all(tasks.map((task) => repository.tasks.update(task.id, { deliveryId: null })))
  await repository.deliveries.remove(id)

  if (delivery) {
    await logActivity('delivery', id, 'delivery.deleted', `Deleted "${delivery.title}"`)
  }
}

export function isDeliveryLate(delivery: Delivery): boolean {
  if (!delivery.targetDeliveryDate) return false
  if (delivery.actualDeliveryDate) return delivery.actualDeliveryDate > delivery.targetDeliveryDate
  return delivery.status !== 'delivered' && delivery.targetDeliveryDate < today()
}
