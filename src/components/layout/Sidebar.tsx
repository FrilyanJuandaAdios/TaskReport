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
    <nav className={cn('flex flex-col gap-px p-3', className)} aria-label="Main">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors duration-200 ease-fluid',
              isActive
                ? 'bg-muted font-medium text-foreground'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
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
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
