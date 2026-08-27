import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { toastError } from './useToast'
import {
  carryOverTasks,
  createTask,
  deleteTask,
  getTasksForDate,
  getTasksForDelivery,
  getTasksInRange,
  quickAddTask,
  searchTasks,
  setTaskStatus,
  updateTask,
} from '@/services/taskService'
import type {
  CreateTaskInput,
  ID,
  ISODate,
  Task,
  TaskFilter,
  TaskStatus,
} from '@/types/domain'

/**
 * TanStack Query is the only state manager in the app.
 *
 * Rationale: every piece of state here is *server state* (rows in a database) —
 * caching, invalidation and background refetch are exactly the problems Query
 * solves. The little genuinely-client state that remains (open dialog, current
 * filter) lives in local `useState`, so there is no Redux/Zustand store to keep
 * in sync with the database.
 */

/** Invalidate everything a task change can affect: lists, reports, dashboard. */
function useInvalidateTaskViews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity.all })
  }
}

export function useTasksForDate(date: ISODate) {
  return useQuery({
    queryKey: queryKeys.tasks.byDate(date),
    queryFn: () => getTasksForDate(date),
  })
}

export function useTasksInRange(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: queryKeys.tasks.byRange(from, to),
    queryFn: () => getTasksInRange(from, to),
  })
}

export function useTasksForDelivery(deliveryId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.tasks.byDelivery(deliveryId ?? 'none'),
    queryFn: () => getTasksForDelivery(deliveryId as ID),
    enabled: Boolean(deliveryId),
  })
}

export function useTaskSearch(filter: TaskFilter, enabled = true) {
  return useQuery({
    queryKey: queryKeys.tasks.search(filter),
    queryFn: () => searchTasks(filter),
    enabled,
  })
}

export type QuickAddDefaults = Pick<CreateTaskInput, 'deliveryId' | 'projectId' | 'requesterId'>

export function useQuickAddTask(date: ISODate, defaults: QuickAddDefaults = {}) {
  const invalidate = useInvalidateTaskViews()
  return useMutation({
    mutationFn: (input: string) => quickAddTask(input, date, defaults),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not add the task.'),
  })
}

export function useCreateTask() {
  const invalidate = useInvalidateTaskViews()
  return useMutation({
    mutationFn: (input: CreateTaskInput) => createTask(input),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not create the task.'),
  })
}

export function useUpdateTask() {
  const invalidate = useInvalidateTaskViews()
  return useMutation({
    mutationFn: ({ id, patch }: { id: ID; patch: Partial<Task> }) => updateTask(id, patch),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not save the task.'),
  })
}

export function useSetTaskStatus() {
  const invalidate = useInvalidateTaskViews()
  return useMutation({
    mutationFn: ({ id, status }: { id: ID; status: TaskStatus }) => setTaskStatus(id, status),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not update the status.'),
  })
}

export function useDeleteTask() {
  const invalidate = useInvalidateTaskViews()
  return useMutation({
    mutationFn: (id: ID) => deleteTask(id),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not delete the task.'),
  })
}

export function useCarryOverTasks() {
  const invalidate = useInvalidateTaskViews()
  return useMutation({
    mutationFn: ({ from, to }: { from: ISODate; to: ISODate }) => carryOverTasks(from, to),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not carry tasks over.'),
  })
}
