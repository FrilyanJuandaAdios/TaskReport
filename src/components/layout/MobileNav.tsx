import { NavLink } from 'react-router-dom'
import { NAV_ITEMS } from '@/constants/navigation'
import { cn } from '@/lib/utils'

/** Bottom bar on phones. Only the four primary destinations. */
export function MobileNav() {
  const items = NAV_ITEMS.filter((item) => item.primary)

  return (
    <nav
      aria-label="Main"
      className="glass-panel safe-bottom fixed inset-x-3 bottom-3 z-40 grid grid-cols-4 rounded-[20px] md:hidden"
    >
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) =>
            cn(
              'relative flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] transition-all duration-300 ease-fluid',
              isActive ? 'text-foreground' : 'text-muted-foreground',
            )
          }
        >
          {({ isActive }) => (
            <>
              <item.icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.1 : 1.7} aria-hidden />
              {item.label}
              {isActive && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
