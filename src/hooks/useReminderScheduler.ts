import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format } from 'date-fns'
import { useSettings } from './useAppData'
import { scheduleReminders, scheduleTaskReminders } from '@/services/reminderService'
import { getTasksInRange } from '@/services/taskService'
import { queryKeys } from './queryKeys'
import { today } from '@/lib/date'

/**
 * Arms the reminder timers whenever the reminder settings change and tears them
 * down on unmount, so no stray timer survives a settings edit.
 */
export function useReminderScheduler(): void {
  const { data: settings } = useSettings()
  const from = today()
  const to = format(addDays(new Date(`${from}T12:00:00`), 24), 'yyyy-MM-dd')
  const { data: reminderTasks = [] } = useQuery({
    queryKey: queryKeys.tasks.byRange(from, to),
    queryFn: () => getTasksInRange(from, to),
  })

  const morningEnabled = settings?.morningReminderEnabled ?? false
  const morningTime = settings?.morningReminderTime
  const eveningEnabled = settings?.eveningReminderEnabled ?? false
  const eveningTime = settings?.eveningReminderTime

  React.useEffect(() => {
    if (!settings) return
    if (!morningEnabled && !eveningEnabled) return

    const handle = scheduleReminders(settings)
    return () => handle.cancel()
    // Re-arm only when the schedule itself changes, not on every settings write.
  }, [settings, morningEnabled, morningTime, eveningEnabled, eveningTime])

  React.useEffect(() => {
    const handle = scheduleTaskReminders(reminderTasks)
    return () => handle.cancel()
  }, [reminderTasks])
}
