import * as React from 'react'
import { addMonths, subMonths } from 'date-fns'
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  List,
  Search,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { MonthCalendar } from '@/components/history/MonthCalendar'
import { DaySummaryList } from '@/components/history/DaySummaryList'
import { useDaySummaries } from '@/hooks/useReports'
import { exportRangeExcel } from '@/services/exportService'
import { formatMonthTitle, monthRange } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { toastError } from '@/hooks/useToast'

/**
 * The archive. Calendar for "what did that month look like", list for scanning,
 * and a month export that produces the workbook the brief asked for.
 */
export function HistoryPage() {
  const [anchor, setAnchor] = React.useState(() => new Date())
  const range = React.useMemo(() => monthRange(anchor), [anchor])
  const { data: summaries = [], isLoading } = useDaySummaries(range.from, range.to)

  const totals = summaries.reduce(
    (acc, summary) => ({
      tasks: acc.tasks + summary.total,
      completed: acc.completed + summary.completed,
      days: acc.days + (summary.total > 0 ? 1 : 0),
      reports: acc.reports + (summary.hasReport ? 1 : 0),
    }),
    { tasks: 0, completed: 0, days: 0, reports: 0 },
  )

  const exportMonth = async () => {
    try {
      await exportRangeExcel(range.from, range.to, formatMonthTitle(anchor))
    } catch (error) {
      toastError(error, 'Export failed.')
    }
  }

  return (
    <Page className="space-y-4">
      <PageHeader
        title="History"
        actions={
          <>
            <Button variant="outline" size="sm" asChild>
              <Link to={ROUTES.search}>
                <Search className="h-4 w-4" />
                Search
              </Link>
            </Button>
            <Button size="sm" onClick={exportMonth} disabled={totals.tasks === 0}>
              <Download className="h-4 w-4" />
              Export month
            </Button>
          </>
        }
      />

      <WidgetGrid columns={4} align="stretch">
        <StatTile label="Tasks" value={totals.tasks} icon={List} hint={formatMonthTitle(anchor)} />
        <StatTile
          label="Completed"
          value={totals.completed}
          icon={CheckCircle2}
          tone="emerald"
          hint={totals.tasks > 0 ? `${Math.round((totals.completed / totals.tasks) * 100)}%` : '—'}
        />
        <StatTile label="Days worked" value={totals.days} icon={CalendarClock} />
        <StatTile label="Reports written" value={totals.reports} icon={FileText} />
      </WidgetGrid>

      <Tabs defaultValue="calendar">
        <Widget
          title={formatMonthTitle(anchor)}
          icon={CalendarDays}
          padded={false}
          contentClassName="px-2 pb-2 pt-0 sm:p-4 sm:pt-0"
          action={
            <div className="grid w-full grid-cols-1 gap-2 min-[390px]:grid-cols-[auto_1fr] sm:flex sm:w-auto sm:items-center sm:gap-1.5">
              <TabsList className="h-10 w-full min-[390px]:w-auto sm:h-8">
                <TabsTrigger value="calendar" className="text-[13px]">
                  Calendar
                </TabsTrigger>
                <TabsTrigger value="list" className="text-[13px]">
                  List
                </TabsTrigger>
              </TabsList>
              <div className="grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-1 sm:flex">
                <Button
                  variant="outline"
                  size="icon-sm"
                  className="w-full"
                  aria-label="Previous month"
                  onClick={() => setAnchor((current) => subMonths(current, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" className="w-full" onClick={() => setAnchor(new Date())}>
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label="Next month"
                  className="w-full"
                  onClick={() => setAnchor((current) => addMonths(current, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          }
        >
          <TabsContent value="calendar" className="mt-0">
            {isLoading ? (
              <Skeleton className="h-[460px] w-full rounded-xl" />
            ) : (
              <MonthCalendar anchor={anchor} summaries={summaries} />
            )}
          </TabsContent>

          <TabsContent value="list" className="mt-0">
            {isLoading ? (
              <Skeleton className="h-64 w-full rounded-xl" />
            ) : summaries.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No work logs found for this period."
                description="Pick another month, or start logging today."
              />
            ) : (
              <DaySummaryList summaries={summaries} />
            )}
          </TabsContent>
        </Widget>
      </Tabs>
    </Page>
  )
}
