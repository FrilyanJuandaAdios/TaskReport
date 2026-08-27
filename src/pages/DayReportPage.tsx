import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CalendarClock,
  ClipboardCopy,
  Download,
  FileText,
  ListTodo,
  Loader2,
  Pencil,
  Send,
  Trash2,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { TaskList } from '@/components/tasks/TaskList'
import { MeetingList } from '@/components/meetings/MeetingList'
import { ReportMarkdown } from '@/components/reports/ReportMarkdown'
import {
  DailyReportEditor,
  draftFromReport,
  type ReportDraft,
} from '@/components/reports/DailyReportEditor'
import {
  useDailyReportView,
  useDeleteReport,
  useSaveDailyReport,
  useSendReportToNotion,
} from '@/hooks/useReports'
import { renderReportMarkdown } from '@/services/reportService'
import { copyToClipboard, exportDailyReportExcel } from '@/services/exportService'
import { notionMode } from '@/services/notionService'
import { formatLongDate, formatDateTime, today } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { toast, toastError } from '@/hooks/useToast'
import { pluralize } from '@/lib/utils'
import type { ISODate } from '@/types/domain'

/**
 * A single day in the archive: the generated report plus the raw work it came
 * from. This is the page the audit question lands on.
 */
export function DayReportPage() {
  const { date = today() } = useParams<{ date: ISODate }>()
  const navigate = useNavigate()

  const { data: view, isLoading } = useDailyReportView(date)
  const saveReport = useSaveDailyReport()
  const deleteReport = useDeleteReport()
  const sendToNotion = useSendReportToNotion()

  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState<ReportDraft>({ issues: '', nextSteps: '', notes: '' })
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  React.useEffect(() => {
    if (view) setDraft(draftFromReport(view.report))
  }, [view])

  const markdown = React.useMemo(
    () => (view ? renderReportMarkdown(view, view.report) : ''),
    [view],
  )

  const save = async () => {
    await saveReport.mutateAsync({ date, ...draft })
    setEditing(false)
    toast({ title: 'Report updated' })
  }

  const copy = async () => {
    try {
      await copyToClipboard(markdown)
      toast({ title: 'Copied', description: 'The report markdown is on your clipboard.' })
    } catch (error) {
      toastError(error, 'Could not copy the report.')
    }
  }

  const exportExcel = async () => {
    try {
      await exportDailyReportExcel(date)
    } catch (error) {
      toastError(error, 'Export failed.')
    }
  }

  if (isLoading || !view) {
    return (
      <Page className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Page>
    )
  }

  const hasContent = view.tasks.length > 0 || view.meetings.length > 0 || view.report

  return (
    <Page className="space-y-4">
      <PageHeader
        eyebrow={
          <Link
            to={ROUTES.history}
            className="inline-flex items-center gap-1 transition-colors duration-200 ease-fluid hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            History
          </Link>
        }
        title={formatLongDate(date)}
        description={
          view.report
            ? `Saved ${formatDateTime(view.report.updatedAt)}${
                view.report.syncedToNotionAt ? ' · synced to Notion' : ''
              }`
            : 'No report written for this day yet.'
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={copy} disabled={!hasContent}>
              <ClipboardCopy className="h-4 w-4" />
              Copy
            </Button>
            <Button variant="outline" size="sm" onClick={exportExcel} disabled={!hasContent}>
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sendToNotion.mutate(date)}
              disabled={!view.report || sendToNotion.isPending}
              title={
                notionMode() === 'mock' ? 'Notion is in mock mode — copies the payload' : undefined
              }
            >
              {sendToNotion.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Notion
            </Button>
            <Button
              size="sm"
              variant={editing ? 'default' : 'secondary'}
              onClick={() => setEditing((open) => !open)}
            >
              <Pencil className="h-4 w-4" />
              {editing ? 'Close editor' : 'Edit'}
            </Button>
          </>
        }
      />

      {!hasContent ? (
        <Widget>
          <EmptyState
            title="No work logged on this day"
            description="A weekend, a holiday, or simply a day off the tool."
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
            <StatTile label="Planned" value={view.summary.planned} icon={ListTodo} />
            <StatTile label="Completed" value={view.summary.completed} tone="emerald" />
            <StatTile
              label="Unplanned"
              value={view.summary.unplanned}
              icon={Zap}
              tone={view.summary.unplanned > 0 ? 'amber' : 'default'}
            />
            <StatTile label="Meetings" value={view.meetings.length} icon={CalendarClock} />
          </WidgetGrid>

          {editing && (
            <Widget title="Edit report" icon={Pencil} contentClassName="space-y-4">
              <DailyReportEditor
                draft={draft}
                onChange={setDraft}
                blockedTasks={view.groups.blocked}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
                <Button onClick={save} disabled={saveReport.isPending}>
                  {saveReport.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save report
                </Button>
              </div>
            </Widget>
          )}

          <div className="grid items-start gap-4 lg:grid-cols-3">
            <Widget title="Daily report" icon={FileText} className="lg:col-span-2">
              <ReportMarkdown markdown={markdown} />
            </Widget>

            <div className="space-y-4">
              <Widget
                title="Work log"
                description={pluralize(view.tasks.length, 'task')}
                icon={ListTodo}
                padded={false}
                contentClassName="px-3 pb-3"
              >
                <TaskList
                  tasks={view.tasks}
                  showTimeGutter={false}
                  emptyState={<EmptyState compact title="No tasks recorded." />}
                />
              </Widget>

              {view.meetings.length > 0 && (
                <Widget
                  title="Meetings"
                  icon={CalendarClock}
                  padded={false}
                  contentClassName="px-3 pb-3"
                >
                  <MeetingList occurrences={view.meetings} editable={false} />
                </Widget>
              )}

              {view.report && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete this report
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this daily report?"
        description="The tasks for this day are kept — only the written report (issues, next steps, notes) is removed."
        confirmLabel="Delete report"
        destructive
        loading={deleteReport.isPending}
        onConfirm={async () => {
          if (view.report) await deleteReport.mutateAsync(view.report.id)
          setConfirmDelete(false)
        }}
      />
    </Page>
  )
}
