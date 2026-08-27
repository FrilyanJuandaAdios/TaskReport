import { currentTime } from '@/lib/date'
import type { AppSettings, HHmm } from '@/types/domain'

/**
 * Reminder scheduling — deliberately the smallest thing that works.
 *
 * Today: an in-tab timer plus the Notification API. Fires while the app is open,
 * which covers the real use case (the app is pinned as a PWA).
 *
 * The escalation path needs no rewrite because everything goes through
 * `scheduleReminders()`:
 *   1. in-tab timer            <- current implementation
 *   2. service-worker + Periodic Background Sync  (swap `notify` for a SW message)
 *   3. server cron + Web Push  (swap `notify` for a push subscription; the
 *      schedule fields already live on AppSettings, so a backend can read them)
 */

export type ReminderKind = 'morning' | 'evening'

export interface ReminderHandle {
  cancel(): void
}

const MESSAGES: Record<ReminderKind, { title: string; body: string; url: string }> = {
  morning: {
    title: 'What are you working on today?',
    body: 'Open your daily check-in and jot down the plan.',
    url: '/today',
  },
  evening: {
    title: 'Ready to review your day?',
    body: 'Turn today’s tasks into a daily report.',
    url: '/review',
  },
}

export function notificationsSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function notificationPermission(): NotificationPermission | 'unsupported' {
  return notificationsSupported() ? Notification.permission : 'unsupported'
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!notificationsSupported()) return 'denied'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

function notify(kind: ReminderKind): void {
  if (!notificationsSupported() || Notification.permission !== 'granted') return
  const message = MESSAGES[kind]
  const notification = new Notification(message.title, {
    body: message.body,
    tag: `taskqueue-${kind}`,
  })
  notification.onclick = () => {
    window.focus()
    window.location.assign(message.url)
  }
}

function minutesUntil(target: HHmm): number {
  const [nowHour, nowMinute] = currentTime().split(':').map(Number)
  const [targetHour, targetMinute] = target.split(':').map(Number)
  const diff = targetHour * 60 + targetMinute - (nowHour * 60 + nowMinute)
  return diff > 0 ? diff : diff + 24 * 60
}

/**
 * Arms both reminders. Returns a handle so the caller can cancel on unmount or
 * whenever settings change — no global timers left behind.
 */
export function scheduleReminders(settings: AppSettings): ReminderHandle {
  const timers: number[] = []

  const arm = (kind: ReminderKind, enabled: boolean, time: HHmm) => {
    if (!enabled) return
    const delayMs = minutesUntil(time) * 60_000
    const timer = window.setTimeout(() => {
      notify(kind)
      // Re-arm for the next day.
      timers.push(window.setTimeout(() => notify(kind), 24 * 60 * 60_000))
    }, delayMs)
    timers.push(timer)
  }

  arm('morning', settings.morningReminderEnabled, settings.morningReminderTime)
  arm('evening', settings.eveningReminderEnabled, settings.eveningReminderTime)

  return {
    cancel() {
      timers.forEach((timer) => window.clearTimeout(timer))
      timers.length = 0
    },
  }
}

/** Lets Settings verify the permission flow without waiting until 09:00. */
export function sendTestReminder(kind: ReminderKind): void {
  notify(kind)
}
