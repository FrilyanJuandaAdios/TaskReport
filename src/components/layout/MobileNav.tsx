import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/navigation'
import { cn } from '@/lib/utils'

/** Bottom bar on phones. Only the four primary destinations. */
export function MobileNav() {
  const items = NAV_ITEMS.filter((item) => item.primary)

  return (
    <nav
      aria-label="Main"
      className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-4 border-t border-border/70 bg-background/80 backdrop-blur-xl md:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors duration-200 ease-fluid',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.1 : 1.7} aria-hidden />
              {item.label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
