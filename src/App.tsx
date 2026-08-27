import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/AppShell'
import { TodayPage } from '@/pages/TodayPage'
import { Skeleton } from '@/components/ui/skeleton'
import { useReminderScheduler } from '@/hooks/useReminderScheduler'

/**
 * Routing.
 *
 * `/` redirects to `/today` — the daily check-in is the app's front door and is
 * bundled eagerly so it paints immediately. Every other route is lazy, which
 * keeps the morning path as small as possible.
 */
const ReviewPage = lazy(() => import('@/pages/ReviewPage').then((m) => ({ default: m.ReviewPage })))
const HistoryPage = lazy(() =>
  import('@/pages/HistoryPage').then((m) => ({ default: m.HistoryPage })),
)
const DayReportPage = lazy(() =>
  import('@/pages/DayReportPage').then((m) => ({ default: m.DayReportPage })),
)
const DeliveriesPage = lazy(() =>
  import('@/pages/DeliveriesPage').then((m) => ({ default: m.DeliveriesPage })),
)
const DeliveryDetailPage = lazy(() =>
  import('@/pages/DeliveryDetailPage').then((m) => ({ default: m.DeliveryDetailPage })),
)
const MeetingsPage = lazy(() =>
  import('@/pages/MeetingsPage').then((m) => ({ default: m.MeetingsPage })),
)
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const ProjectsPage = lazy(() =>
  import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const SearchPage = lazy(() => import('@/pages/SearchPage').then((m) => ({ default: m.SearchPage })))
const SettingsPage = lazy(() =>
  import('@/pages/SettingsPage').then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
)

export function App() {
  useReminderScheduler()

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="today" element={<TodayPage />} />
        <Route
          path="*"
          element={
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="review" element={<ReviewPage />} />
                <Route path="history" element={<HistoryPage />} />
                <Route path="history/:date" element={<DayReportPage />} />
                <Route path="deliveries" element={<DeliveriesPage />} />
                <Route path="deliveries/:id" element={<DeliveryDetailPage />} />
                <Route path="meetings" element={<MeetingsPage />} />
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="projects" element={<ProjectsPage />} />
                <Route path="search" element={<SearchPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </Suspense>
          }
        />
      </Route>
    </Routes>
  )
}

function RouteFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
