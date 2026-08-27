import * as React from 'react'
import { useSettings } from './useAppData'
import { scheduleReminders } from '@/services/reminderService'

/**
 * Arms the reminder timers whenever the reminder settings change and tears them
 * down on unmount, so no stray timer survives a settings edit.
 */
export function useReminderScheduler(): void {
  const { data: settings } = useSettings()

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
}
