import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { App } from './App'
import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { initRepository } from '@/repositories'
import { applyTheme, getSettings } from '@/services/settingsService'
import { env } from '@/lib/env'
import './index.css'

/**
 * Bootstrap order matters:
 *  1. resolve the storage driver (nothing may query before this),
 *  2. apply the saved theme before the first paint,
 *  3. render.
 *
 * The database starts empty on purpose — no demo rows to delete before the
 * archive becomes yours.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Local IndexedDB reads are cheap; a short stale time keeps the Today page
      // in sync across tabs without hammering a remote database.
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: env.dbDriver === 'supabase' ? 2 : 0,
    },
  },
})

async function bootstrap() {
  await initRepository()

  try {
    applyTheme((await getSettings()).theme)
  } catch {
    applyTheme('system')
  }

  registerServiceWorker()

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </React.StrictMode>,
  )
}

/**
 * PWA registration. Only in production builds — a service worker in front of
 * the dev server would serve stale modules and make HMR confusing.
 */
function registerServiceWorker(): void {
  if (env.isDev || !('serviceWorker' in navigator)) return
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((error) => console.warn('[pwa] service worker registration failed', error))
  })
}

void bootstrap()
