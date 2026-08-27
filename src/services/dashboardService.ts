import { getRepository } from '@/repositories'
import { hydrateDeliveries } from './deliveryService'
import { hydrateTasks } from './taskService'
import { listActivity } from './activityService'
import { addDaysISO, today, weekRange } from '@/lib/date'
import { ACTIVE_DELIVERY_STATUSES } from '@/constants/status'
import type {
  ActivityLog,
  DeliveryWithRelations,
  Project,
  TaskWithRelations,
} from '@/types/domain'

/**
 * Read model for the (secondary) dashboard. Only actionable numbers — nothing
 * that exists purely to fill a chart.
 */

export interface WorkloadSlice {
  project: Project | null
  total: number
  completed: number
}

export interface DashboardData {
  week: { from: string; to: string }
  counters: {
    completed: number
    inProgress: number
    unplanned: number
    deliveriesDue: number
  }
  upcomingDeliveries: DeliveryWithRelations[]
  waitingFeedback: DeliveryWithRelations[]
  overdueDeliveries: DeliveryWithRelations[]
  workload: WorkloadSlice[]
  recentActivity: ActivityLog[]
  openTasksToday: TaskWithRelations[]
}

export async function getDashboardData(): Promise<DashboardData> {
  const repository = getRepository()
  const week = weekRange()
  const horizon = addDaysISO(today(), 14)

  const [weekTasks, todayTasks, deliveries, projects, activity] = await Promise.all([
    repository.tasks.listByDateRange(week.from, week.to),
    repository.tasks.listByDate(today()),
    repository.deliveries.list(),
    repository.projects.list(),
    listActivity(12),
  ])

  const active = deliveries.filter((delivery) =>
    ACTIVE_DELIVERY_STATUSES.includes(delivery.status),
  )

  const upcoming = active.filter(
    (delivery) =>
      delivery.targetDeliveryDate &&
      delivery.targetDeliveryDate >= today() &&
      delivery.targetDeliveryDate <= horizon,
  )

  const overdue = active.filter(
    (delivery) => delivery.targetDeliveryDate && delivery.targetDeliveryDate < today(),
  )

  const waiting = deliveries.filter((delivery) => delivery.status === 'waiting_feedback')

  const projectMap = new Map(projects.map((project) => [project.id, project]))
  const workloadMap = new Map<string, WorkloadSlice>()

  for (const task of weekTasks) {
    const key = task.projectId ?? '__none__'
    const slice = workloadMap.get(key) ?? {
      project: task.projectId ? (projectMap.get(task.projectId) ?? null) : null,
      total: 0,
      completed: 0,
    }
    slice.total += 1
    if (task.status === 'completed') slice.completed += 1
    workloadMap.set(key, slice)
  }

  const [upcomingHydrated, waitingHydrated, overdueHydrated, openToday] = await Promise.all([
    hydrateDeliveries(
      [...upcoming].sort((a, b) =>
        (a.targetDeliveryDate ?? '').localeCompare(b.targetDeliveryDate ?? ''),
      ),
    ),
    hydrateDeliveries(waiting),
    hydrateDeliveries(overdue),
    hydrateTasks(todayTasks.filter((task) => task.status !== 'completed' && task.status !== 'cancelled')),
  ])

  return {
    week,
    counters: {
      completed: weekTasks.filter((task) => task.status === 'completed').length,
      inProgress: weekTasks.filter((task) => task.status === 'in_progress').length,
      unplanned: weekTasks.filter((task) => !task.isPlanned).length,
      deliveriesDue: upcoming.length,
    },
    upcomingDeliveries: upcomingHydrated,
    waitingFeedback: waitingHydrated,
    overdueDeliveries: overdueHydrated,
    workload: [...workloadMap.values()].sort((a, b) => b.total - a.total),
    recentActivity: activity,
    openTasksToday: openToday,
  }
}
