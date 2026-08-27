import { getRepository } from '@/repositories'
import { nowISO } from '@/lib/utils'
import type { AppSettings } from '@/types/domain'

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  userName: 'Designer',
  workdayStart: '09:00',
  workdayEnd: '18:00',
  theme: 'system',
  morningReminderEnabled: false,
  morningReminderTime: '09:00',
  eveningReminderEnabled: false,
  eveningReminderTime: '17:30',
  updatedAt: nowISO(),
}

export async function getSettings(): Promise<AppSettings> {
  const stored = await getRepository().settings.get()
  return stored ?? DEFAULT_SETTINGS
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings()
  const next: AppSettings = { ...current, ...patch, id: 'settings', updatedAt: nowISO() }
  return getRepository().settings.save(next)
}

/** Applies the theme to <html>. Called on boot and whenever the setting changes. */
export function applyTheme(theme: AppSettings['theme']): void {
  const root = document.documentElement
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const dark = theme === 'dark' || (theme === 'system' && prefersDark)
  root.classList.toggle('dark', dark)
}
