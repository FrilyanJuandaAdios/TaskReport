import * as React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CalendarClock, FileText, ListChecks, Loader2, PenLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { DatePicker } from '@/components/common/DatePicker'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { DailyReviewChecklist } from '@/components/reports/DailyReviewChecklist'
import {
  DailyReportEditor,
  draftFromReport,
  type ReportDraft,
} from '@/components/reports/DailyReportEditor'
import { MeetingList } from '@/components/meetings/MeetingList'
import { useDailyReportView, useSaveDailyReport } from '@/hooks/useReports'
import { formatLongDate, today } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { toast } from '@/hooks/useToast'
import type { ISODate } from '@/types/domain'

/**
 * End-of-day review.
 *
 * Nothing is written from scratch: the day's tasks and meetings are already the
 * report. The user confirms statuses, adds the three narrative fields, and
 * generates.
 */
export function ReviewPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const date = (searchParams.get('date') as ISODate | null) ?? today()

  const { data: view, isLoading } = useDailyReportView(date)
  const saveReport = useSaveDailyReport()

  const [draft, setDraft] = React.useState<ReportDraft>({ issues: '', nextSteps: '', notes: '' })
  const [hydratedFor, setHydratedFor] = React.useState<string | null>(null)

  // Load the stored report once per date, then leave the draft under user control.
  React.useEffect(() => {
    if (!view || hydratedFor === view.date) return
    setDraft(draftFromReport(view.report))
    setHydratedFor(view.date)
  }, [view, hydratedFor])

  const generate = async () => {
    await saveReport.mutateAsync({ date, ...draft })
    toast({
      title: 'Daily report saved',
      description: `${formatLongDate(date)} is now in your history.`,
    })
    navigate(ROUTES.historyDay(date))
  }

  return (
    <Page className="space-y-4">
      <PageHeader
        eyebrow="End of day"
        title="Review your day"
        description={formatLongDate(date)}
        actions={
          <div className="w-44">
            <DatePicker
              value={date}
              onChange={(next) => next && setSearchParams({ date: next })}
              allowClear={false}
            />
          </div>
        }
      />

      {isLoading || !view ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : view.tasks.length === 0 && view.meetings.length === 0 ? (
        <Widget>
          <EmptyState
            icon={FileText}
            title="No tasks recorded for this day"
            description="Add what you worked on first — the review builds itself from your tasks."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.today)}>
                Go to today
              </Button>
            }
          />
        </Widget>
      ) : (
        <>
          <WidgetGrid columns={4} align="stretch">
            <StatTile label="Planned" value={view.summary.planned} />
            <StatTile label="Completed" value={view.summary.completed} tone="emerald" />
            <StatTile label="In progress" value={view.summary.inProgress} tone="brand" />
            <StatTile
              label="Blocked"
              value={view.summary.blocked}
              tone={view.summary.blocked > 0 ? 'amber' : 'default'}
            />
          </WidgetGrid>

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Widget
              title="What happened"
              icon={ListChecks}
              className="lg:col-span-2"
              padded={false}
              contentClassName="px-3 pb-3"
            >
              <DailyReviewChecklist
                planned={view.tasks.filter((task) => task.isPlanned)}
                unplanned={view.groups.unplanned}
              />
            </Widget>

            <div className="space-y-4">
              {view.meetings.length > 0 && (
                <Widget
                  title="Meetings"
                  icon={CalendarClock}
                  padded={false}
                  contentClassName="px-3 pb-3"
                >
                  <MeetingList occurrences={view.meetings} />
                </Widget>
              )}

              <Widget title="Write-up" icon={PenLine}>
                <DailyReportEditor
                  draft={draft}
                  onChange={setDraft}
                  blockedTasks={view.groups.blocked}
                />
              </Widget>

              <Button
                onClick={generate}
                disabled={saveReport.isPending}
                size="lg"
                className="w-full"
              >
                {saveReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {view.report ? 'Update daily report' : 'Generate daily report'}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                You can keep editing the report after it is saved.
              </p>
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
