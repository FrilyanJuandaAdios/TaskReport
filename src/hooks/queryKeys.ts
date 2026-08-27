import type { DeliveryFilter, ISODate, TaskFilter } from '@/types/domain'

/**
 * Central query-key registry.
 *
 * Every mutation invalidates by prefix (`queryKeys.tasks.all`), so a new screen
 * never has to guess which keys to refresh.
 */
export const queryKeys = {
  tasks: {
    all: ['tasks'] as const,
    byDate: (date: ISODate) => ['tasks', 'date', date] as const,
    byRange: (from: ISODate, to: ISODate) => ['tasks', 'range', from, to] as const,
    byDelivery: (deliveryId: string) => ['tasks', 'delivery', deliveryId] as const,
    search: (filter: TaskFilter) => ['tasks', 'search', filter] as const,
    detail: (id: string) => ['tasks', 'detail', id] as const,
  },
  deliveries: {
    all: ['deliveries'] as const,
    list: (filter: DeliveryFilter) => ['deliveries', 'list', filter] as const,
    detail: (id: string) => ['deliveries', 'detail', id] as const,
    workLog: (id: string) => ['deliveries', 'worklog', id] as const,
  },
  reports: {
    all: ['reports'] as const,
    byDate: (date: ISODate) => ['reports', 'date', date] as const,
    view: (date: ISODate) => ['reports', 'view', date] as const,
    daySummaries: (from: ISODate, to: ISODate) => ['reports', 'days', from, to] as const,
  },
  meetings: {
    all: ['meetings'] as const,
    byDate: (date: ISODate) => ['meetings', 'date', date] as const,
    logs: (meetingId: string) => ['meetings', 'logs', meetingId] as const,
  },
  catalog: {
    projects: ['catalog', 'projects'] as const,
    requesters: ['catalog', 'requesters'] as const,
    tags: ['catalog', 'tags'] as const,
  },
  activity: {
    all: ['activity'] as const,
    byEntity: (entity: string, id: string) => ['activity', entity, id] as const,
  },
  dashboard: ['dashboard'] as const,
  search: (query: string) => ['search', query] as const,
  settings: ['settings'] as const,
} as const
