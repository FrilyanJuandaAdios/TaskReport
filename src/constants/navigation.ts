import {
  CalendarClock,
  CalendarDays,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Sun,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Shown in the mobile bottom bar. Keeps that bar to 4 items max. */
  primary: boolean
}

/**
 * Navigation order encodes usage priority from the brief:
 * Today -> History -> Deliveries, everything else is secondary.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/today', label: 'Today', icon: Sun, primary: true },
  { to: '/history', label: 'History', icon: CalendarDays, primary: true },
  { to: '/deliveries', label: 'Deliveries', icon: Truck, primary: true },
  { to: '/meetings', label: 'Meetings', icon: CalendarClock, primary: false },
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, primary: false },
  { to: '/projects', label: 'Projects', icon: FolderKanban, primary: false },
  { to: '/settings', label: 'Settings', icon: Settings, primary: true },
]

export const ROUTES = {
  today: '/today',
  review: '/review',
  history: '/history',
  historyDay: (date: string) => `/history/${date}`,
  deliveries: '/deliveries',
  delivery: (id: string) => `/deliveries/${id}`,
  meetings: '/meetings',
  dashboard: '/dashboard',
  projects: '/projects',
  search: '/search',
  settings: '/settings',
} as const
