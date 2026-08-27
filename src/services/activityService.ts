import { getRepository } from '@/repositories'
import { newId, nowISO } from '@/lib/utils'
import type { ActivityAction, ActivityEntity, ActivityLog, ID } from '@/types/domain'

/**
 * Deliberately simple append-only log — not event sourcing.
 *
 * Current state still lives on the entity; this table only answers "what
 * happened, and when" for audits and the delivery timeline. Writes never block
 * the caller: a failed log entry must not fail the user's actual action.
 */

export async function logActivity(
  entity: ActivityEntity,
  entityId: ID,
  action: ActivityAction,
  message: string,
  meta?: ActivityLog['meta'],
): Promise<void> {
  const entry: ActivityLog = {
    id: newId(),
    entity,
    entityId,
    action,
    message,
    at: nowISO(),
    meta,
  }

  try {
    await getRepository().activity.append(entry)
  } catch (error) {
    console.warn('[activity] failed to record entry', action, error)
  }
}

export function listActivity(limit = 50): Promise<ActivityLog[]> {
  return getRepository().activity.list(limit)
}

export function listActivityFor(entity: ActivityEntity, entityId: ID): Promise<ActivityLog[]> {
  return getRepository().activity.listByEntity(entity, entityId)
}
