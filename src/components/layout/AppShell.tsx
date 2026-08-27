import * as React from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { SidebarNav } from './Sidebar'
import { MobileNav } from './MobileNav'
import { GlobalSearch } from '@/components/search/GlobalSearch'
import { useKeyboardShortcut, shortcutLabel } from '@/hooks/useKeyboardShortcut'
import { ScrollContainerProvider } from '@/hooks/useScrollContainer'
import { ROUTES } from '@/constants/navigation'
import { DB_DRIVER_MISCONFIGURED } from '@/lib/env'

/**
 * Application frame.
 *
 * `<main>` is the scroll container, not the document. That is what lets the
 * Today page stack a full-viewport hero above the day's plan and snap between
 * them, while the sidebar and the mobile bar stay put.
 *
 * Desktop: fixed sidebar + workspace.
 * Tablet:  sidebar collapses into a sheet behind the menu button.
 * Mobile:  bottom navigation, content padded so the bar never covers a task.
 */
export function AppShell() {
  const [searchOpen, setSearchOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const scrollRef = React.useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useKeyboardShortcut({ key: 'k', meta: true, allowInInput: true }, () => setSearchOpen(true))

  // A new page always starts at the top, the way a native screen push does.
  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <ScrollContainerProvider value={scrollRef}>
      <div className="flex h-[100dvh] overflow-hidden bg-transparent p-0 md:p-3">
        <aside className="glass-panel hidden w-[224px] shrink-0 flex-col overflow-hidden rounded-[22px] md:flex">
          <div className="px-5 pb-3 pt-5">
            <Link
              to={ROUTES.today}
              className="inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.025em] transition-opacity ease-fluid hover:opacity-75"
            >
              <img src="/Taskqueue.png" alt="" className="h-8 w-8 object-contain" />
              Taskqueue
            </Link>
            <div className="queue-line mt-4 h-px w-full opacity-70" />
          </div>
          <SidebarNav className="flex-1 overflow-y-auto" />
          <div className="p-3">
            <SearchButton onClick={() => setSearchOpen(true)} />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col md:ml-3">
          <header className="glass-panel z-30 mx-3 mt-3 flex shrink-0 items-center gap-1 rounded-2xl px-2 py-1.5 md:hidden">
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="p-0">
                <SheetTitle className="px-5 pb-1 pt-6 text-[15px] font-semibold tracking-tight">
                  Taskqueue
                </SheetTitle>
                <SidebarNav onNavigate={() => setMenuOpen(false)} />
              </SheetContent>
            </Sheet>

            <Link to={ROUTES.today} className="inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
              <img src="/Taskqueue.png" alt="" className="h-6 w-6 object-contain" />
              Taskqueue
            </Link>

            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              className="ml-auto"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="h-5 w-5" />
            </Button>
          </header>

          {DB_DRIVER_MISCONFIGURED && (
            <p className="shrink-0 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-700 dark:text-amber-400">
              Supabase was requested but its URL or key is missing — running on local storage.
            </p>
          )}

          <main
            ref={scrollRef}
            className="flex-1 snap-y snap-proximity overflow-x-hidden overflow-y-auto scroll-smooth px-4 sm:px-8"
          >
            <Outlet />
          </main>
        </div>

        <MobileNav />
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </div>
    </ScrollContainerProvider>
  )
}

function SearchButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm text-muted-foreground transition-colors duration-200 ease-fluid hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="text-[11px] tabular-nums text-muted-foreground/70">{shortcutLabel('k')}</kbd>
    </button>
  )
}
