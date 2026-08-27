import * as React from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  ExternalLink,
  FileText,
  ListTodo,
  Loader2,
  Pencil,
  Send,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ActivityTimeline } from '@/components/common/ActivityTimeline'
import { DeliveryStatusPicker } from '@/components/common/StatusChip'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { DeliveryFormSheet } from '@/components/deliveries/DeliveryFormSheet'
import { TaskQuickAdd } from '@/components/tasks/TaskQuickAdd'
import { TaskList } from '@/components/tasks/TaskList'
import {
  useDelivery,
  useDeleteDelivery,
  useDeliveryWorkLog,
  useSetDeliveryStatus,
} from '@/hooks/useDeliveries'
import { useEntityActivity } from '@/hooks/useAppData'
import { sendDeliveryToNotion } from '@/services/notionService'
import { isDeliveryLate } from '@/services/deliveryService'
import { formatLongDate, formatMediumDate, today } from '@/lib/date'
import { ROUTES } from '@/constants/navigation'
import { groupBy, pluralize } from '@/lib/utils'
import { toast, toastError } from '@/hooks/useToast'
import type { ReactNode } from 'react'

/**
 * The audit view: one delivery, every daily task that fed it, and the trail of
 * status changes. This is what makes "what did I do to deliver X?" answerable.
 */
export function DeliveryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: delivery, isLoading } = useDelivery(id)
  const { data: workLog = [] } = useDeliveryWorkLog(id)
  const { data: activity = [] } = useEntityActivity('delivery', id)
  const setStatus = useSetDeliveryStatus()
  const deleteDelivery = useDeleteDelivery()

  const [editOpen, setEditOpen] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const [sending, setSending] = React.useState(false)

  const byDate = React.useMemo(() => groupBy(workLog, (task) => task.date), [workLog])
  const dates = React.useMemo(() => Object.keys(byDate).sort(), [byDate])

  if (isLoading) {
    return (
      <Page className="space-y-4">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </Page>
    )
  }

  if (!delivery) {
    return (
      <Page>
        <Widget>
          <EmptyState
            title="Delivery not found"
            description="It may have been deleted."
            action={
              <Button variant="outline" size="sm" onClick={() => navigate(ROUTES.deliveries)}>
                Back to deliveries
              </Button>
            }
          />
        </Widget>
      </Page>
    )
  }

  const late = isDeliveryLate(delivery)

  const sendNotion = async () => {
    setSending(true)
    try {
      const result = await sendDeliveryToNotion(delivery.id)
      toast({
        title: result.ok ? 'Notion' : 'Notion sync failed',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    } catch (error) {
      toastError(error, 'Could not reach Notion.')
    } finally {
      setSending(false)
    }
  }

  const links = [
    { url: delivery.figmaUrl, label: 'Figma' },
    { url: delivery.ticketUrl, label: 'Ticket' },
    { url: delivery.referenceUrl, label: 'Reference' },
  ].filter((link) => Boolean(link.url))

  return (
    <Page className="space-y-4">
      <PageHeader
        eyebrow={
          <Link
            to={ROUTES.deliveries}
            className="inline-flex items-center gap-1 transition-colors duration-200 ease-fluid hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" />
            Deliveries
          </Link>
        }
        title={delivery.title}
        description={delivery.description}
        actions={
          <>
            <DeliveryStatusPicker
              value={delivery.status}
              onChange={(status) => setStatus.mutate({ id: delivery.id, status })}
              className="h-9 px-3 text-[13px]"
            />
            <Button variant="outline" size="sm" onClick={sendNotion} disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Notion
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)}>
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          </>
        }
      />

      <WidgetGrid columns={4} align="stretch">
        <StatTile label="Requested" value={formatMediumDate(delivery.requestedDate)} />
        <StatTile
          label="Target"
          value={formatMediumDate(delivery.targetDeliveryDate)}
          tone={late ? 'amber' : 'default'}
          hint={late ? 'Late' : undefined}
        />
        <StatTile label="Delivered" value={formatMediumDate(delivery.actualDeliveryDate)} />
        <StatTile
          label="Work logs"
          value={workLog.length}
          hint={delivery.revisionCount > 0 ? `${delivery.revisionCount} revisions` : undefined}
        />
      </WidgetGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Widget
            title="Related daily tasks"
            description={`${pluralize(workLog.length, 'task')} · ${pluralize(dates.length, 'day')}`}
            icon={ListTodo}
            contentClassName="space-y-3"
          >
            <TaskQuickAdd
              date={today()}
              defaults={{
                deliveryId: delivery.id,
                projectId: delivery.projectId ?? null,
                requesterId: delivery.requesterId ?? null,
              }}
              hideDetails
              placeholder="Log today's work on this delivery…"
            />

            {workLog.length === 0 ? (
              <EmptyState
                compact
                title="No daily tasks linked yet — log work above, or link an existing task from its details panel."
              />
            ) : (
              <div className="-mx-2 divide-y divide-border/60">
                {dates.map((date) => (
                  <div key={date} className="py-2 first:pt-0">
                    <p className="px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
                      {formatLongDate(date)}
                    </p>
                    <TaskList tasks={byDate[date]} showTimeGutter={false} />
                  </div>
                ))}
              </div>
            )}
          </Widget>

          {delivery.notes && (
            <Widget title="Notes" icon={FileText}>
              <p className="whitespace-pre-wrap text-sm">{delivery.notes}</p>
            </Widget>
          )}
        </div>

        <div className="space-y-4">
          <Widget title="Details">
            <dl className="space-y-3 text-sm">
              <Detail label="Project">{delivery.project?.name ?? '—'}</Detail>
              <Detail label="Requested by">
                {delivery.requester ? (
                  <>
                    {delivery.requester.name}
                    {delivery.requester.team && (
                      <span className="text-muted-foreground"> · {delivery.requester.team}</span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </Detail>
              <Detail label="Revisions">{delivery.revisionCount}</Detail>
              <Detail label="Links">
                {links.length === 0 ? (
                  '—'
                ) : (
                  <span className="flex flex-wrap gap-3">
                    {links.map((link) => (
                      <a
                        key={link.label}
                        href={link.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 transition-colors duration-200 ease-fluid hover:text-brand hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {link.label}
                      </a>
                    ))}
                  </span>
                )}
              </Detail>
            </dl>
          </Widget>

          <Widget title="Activity" icon={Activity}>
            <ActivityTimeline entries={activity} emptyText="No activity recorded yet." />
          </Widget>

          <Button
            variant="ghost"
            size="sm"
            className="w-full text-destructive hover:text-destructive"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 className="h-4 w-4" />
            Delete delivery
          </Button>
        </div>
      </div>

      <DeliveryFormSheet delivery={delivery} open={editOpen} onOpenChange={setEditOpen} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this delivery?"
        description={`The ${pluralize(workLog.length, 'linked task')} will be kept and simply unlinked.`}
        confirmLabel="Delete delivery"
        destructive
        loading={deleteDelivery.isPending}
        onConfirm={async () => {
          await deleteDelivery.mutateAsync(delivery.id)
          navigate(ROUTES.deliveries)
        }}
      />
    </Page>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  )
}
