import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/navigation'
import { cn } from '@/lib/utils'

interface SidebarProps {
  onNavigate?: () => void
  className?: string
}

/** Desktop sidebar / tablet sheet content. Same markup, two containers. */
export function SidebarNav({ onNavigate, className }: SidebarProps) {
  return (
    <nav className={cn('flex flex-col gap-1 p-3', className)} aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'group relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-all duration-300 ease-fluid',
              isActive
                ? 'bg-[hsl(var(--glass-highlight)/0.7)] font-medium text-foreground shadow-[0_8px_24px_-18px_hsl(var(--foreground)/0.5)]'
                : 'text-muted-foreground hover:translate-x-0.5 hover:bg-[hsl(var(--glass-highlight)/0.42)] hover:text-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon
                className={cn('h-[18px] w-[18px] shrink-0', !isActive && 'opacity-80')}
                strokeWidth={isActive ? 2.1 : 1.8}
                aria-hidden
              />
              {item.label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
