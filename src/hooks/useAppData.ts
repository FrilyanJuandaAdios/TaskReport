import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { toastError } from './useToast'
import { getDashboardData } from '@/services/dashboardService'
import { globalSearch } from '@/services/searchService'
import { listActivity, listActivityFor } from '@/services/activityService'
import { applyTheme, getSettings, saveSettings } from '@/services/settingsService'
import type { ActivityEntity, AppSettings, ID } from '@/types/domain'

export function useDashboard() {
  return useQuery({ queryKey: queryKeys.dashboard, queryFn: getDashboardData })
}

/** Debounced so typing in the command palette does not run a scan per keystroke. */
export function useGlobalSearch(query: string) {
  const debounced = useDebouncedValue(query, 180)
  return useQuery({
    queryKey: queryKeys.search(debounced),
    queryFn: () => globalSearch(debounced),
    enabled: debounced.trim().length > 1,
  })
}

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = React.useState(value)

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}

export function useActivity(limit = 30) {
  return useQuery({
    queryKey: [...queryKeys.activity.all, limit],
    queryFn: () => listActivity(limit),
  })
}

export function useEntityActivity(entity: ActivityEntity, id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.activity.byEntity(entity, id ?? 'none'),
    queryFn: () => listActivityFor(entity, id as ID),
    enabled: Boolean(id),
  })
}

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: getSettings })
}

export function useSaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<AppSettings>) => saveSettings(patch),
    onSuccess: (settings) => {
      applyTheme(settings.theme)
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings })
    },
    onError: (error) => toastError(error, 'Could not save settings.'),
  })
}
