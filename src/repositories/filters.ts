import { matches } from '@/lib/utils'
import type { Delivery, DeliveryFilter, Task, TaskFilter } from '@/types/domain'
import { today } from '@/lib/date'

/**
 * Filter predicates shared by every driver.
 *
 * The local driver applies them after an indexed range scan; the Supabase driver
 * pushes the cheap parts down to SQL and uses these for the free-text pass so
 * both drivers return byte-identical results for the same filter.
 */

export function taskMatchesFilter(task: Task, filter: TaskFilter): boolean {
  if (filter.from && task.date < filter.from) return false
  if (filter.to && task.date > filter.to) return false
  if (filter.statuses?.length && !filter.statuses.includes(task.status)) return false
  if (filter.projectIds?.length && !(task.projectId && filter.projectIds.includes(task.projectId))) {
    return false
  }
  if (
    filter.requesterIds?.length &&
    !(task.requesterId && filter.requesterIds.includes(task.requesterId))
  ) {
    return false
  }
  if (filter.tagIds?.length && !filter.tagIds.some((id) => task.tagIds.includes(id))) return false
  if (filter.deliveryId && task.deliveryId !== filter.deliveryId) return false
  if (filter.isPlanned !== undefined && task.isPlanned !== filter.isPlanned) return false

  if (filter.query) {
    const hit =
      matches(task.title, filter.query) ||
      matches(task.description, filter.query) ||
      matches(task.notes, filter.query)
    if (!hit) return false
  }

  return true
}

export function deliveryMatchesFilter(delivery: Delivery, filter: DeliveryFilter): boolean {
  if (filter.statuses?.length && !filter.statuses.includes(delivery.status)) return false
  if (
    filter.projectIds?.length &&
    !(delivery.projectId && filter.projectIds.includes(delivery.projectId))
  ) {
    return false
  }
  if (
    filter.requesterIds?.length &&
    !(delivery.requesterId && filter.requesterIds.includes(delivery.requesterId))
  ) {
    return false
  }
  if (filter.tagIds?.length && !filter.tagIds.some((id) => delivery.tagIds.includes(id))) {
    return false
  }
  if (filter.from && delivery.requestedDate < filter.from) return false
  if (filter.to && delivery.requestedDate > filter.to) return false

  if (filter.overdueOnly) {
    const target = delivery.targetDeliveryDate
    if (!target) return false
    const late = delivery.actualDeliveryDate
      ? delivery.actualDeliveryDate > target
      : delivery.status !== 'delivered' && target < today()
    if (!late) return false
  }

  if (filter.query) {
    const hit =
      matches(delivery.title, filter.query) ||
      matches(delivery.description, filter.query) ||
      matches(delivery.notes, filter.query)
    if (!hit) return false
  }

  return true
}
