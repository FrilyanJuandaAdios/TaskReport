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

export type ReminderResult = 'sent' | 'unsupported' | 'permission-denied'

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

async function notify(kind: ReminderKind): Promise<ReminderResult> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'granted') return 'permission-denied'
  const message = MESSAGES[kind]
  const options: NotificationOptions = {
    body: message.body,
    tag: `taskqueue-${kind}`,
    icon: '/Taskqueue.png',
    badge: '/Taskqueue.png',
  }

  // Installed PWAs display more reliably through their service worker.
  const registration = await navigator.serviceWorker?.getRegistration()
  if (registration) {
    await registration.showNotification(message.title, { ...options, data: { url: message.url } })
    return 'sent'
  }

  const notification = new Notification(message.title, options)
  notification.onclick = () => {
    window.focus()
    window.location.assign(message.url)
  }
  return 'sent'
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
      void notify(kind)
      // Continue daily until settings change or the app closes.
      timers.push(window.setInterval(() => void notify(kind), 24 * 60 * 60_000))
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
export async function sendTestReminder(kind: ReminderKind): Promise<ReminderResult> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'granted') {
    const permission = await requestNotificationPermission()
    if (permission !== 'granted') return 'permission-denied'
  }
  return notify(kind)
}
