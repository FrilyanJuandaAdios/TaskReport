import * as React from 'react'
import {
  CalendarClock,
  Clock,
  MoreHorizontal,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  Video,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { StatTile, Widget, WidgetGrid } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { MeetingFormDialog } from '@/components/meetings/MeetingFormDialog'
import { MeetingList } from '@/components/meetings/MeetingList'
import { useDeleteMeeting, useMeetings, useMeetingsForDate, useUpdateMeeting } from '@/hooks/useMeetings'
import { describeRecurrence, meetingEndTime } from '@/services/meetingService'
import { PROJECT_COLOR_CLASSES } from '@/constants/status'
import { formatLongDate, today } from '@/lib/date'
import { cn, pluralize } from '@/lib/utils'
import type { Meeting, MeetingWithRelations } from '@/types/domain'

/**
 * The standing schedule.
 *
 * One card per rule, plus a live view of what today actually looks like — the
 * question "what does my week already commit me to?" answered on one screen.
 */
export function MeetingsPage() {
  const { data: meetings = [], isLoading } = useMeetings()
  const { data: todayMeetings = [] } = useMeetingsForDate(today())
  const updateMeeting = useUpdateMeeting()
  const deleteMeeting = useDeleteMeeting()

  const [editing, setEditing] = React.useState<Meeting | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<Meeting | null>(null)

  const open = (meeting: Meeting | null) => {
    setEditing(meeting)
    setFormOpen(true)
  }

  const active = meetings.filter((meeting) => meeting.isActive)
  const paused = meetings.filter((meeting) => !meeting.isActive)
  const weeklyMinutes = active.reduce((total, meeting) => {
    const perWeek =
      meeting.recurrence === 'daily'
        ? 7
        : meeting.recurrence === 'weekdays'
          ? 5
          : meeting.recurrence === 'weekly'
            ? meeting.weekdays.length
            : 0
    return total + perWeek * meeting.durationMinutes
  }, 0)

  return (
    <Page className="space-y-4">
      <PageHeader
        title="Meetings"
        actions={
          <Button size="sm" onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            New meeting
          </Button>
        }
      />

      <WidgetGrid columns={4} align="stretch">
        <StatTile label="Active schedules" value={active.length} icon={CalendarClock} />
        <StatTile label="Today" value={todayMeetings.length} icon={Clock} tone="brand" />
        <StatTile
          label="Hours per week"
          value={(weeklyMinutes / 60).toFixed(1)}
          hint="From recurring meetings"
        />
        <StatTile label="Paused" value={paused.length} tone="muted" />
      </WidgetGrid>

      <div className="grid items-start gap-4 lg:grid-cols-3">
        <Widget
          title="Today"
          description={formatLongDate(today())}
          icon={Clock}
          className="lg:col-span-1"
          padded={false}
          contentClassName="px-3 pb-3"
        >
          <MeetingList occurrences={todayMeetings} emptyText="Nothing scheduled today." />
        </Widget>

        <Widget
          title="Schedule"
          description={pluralize(meetings.length, 'meeting')}
          className="lg:col-span-2"
          padded={false}
          contentClassName="px-3 pb-3"
        >
          {isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : meetings.length === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No meetings scheduled"
              description="Add your stand-up once and it shows up on Today every weekday."
              action={
                <Button variant="outline" size="sm" onClick={() => open(null)}>
                  Schedule a meeting
                </Button>
              }
            />
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {[...active, ...paused].map((meeting) => (
                <MeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onEdit={() => open(meeting)}
                  onDelete={() => setPendingDelete(meeting)}
                  onToggleActive={() =>
                    updateMeeting.mutate({
                      id: meeting.id,
                      patch: { isActive: !meeting.isActive },
                    })
                  }
                />
              ))}
            </div>
          )}
        </Widget>
      </div>

      <MeetingFormDialog meeting={editing} open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.title ?? 'this meeting'}?`}
        description="The schedule and everything recorded against it — attended, skipped — is removed. Pause it instead if you only want it off Today."
        confirmLabel="Delete meeting"
        destructive
        loading={deleteMeeting.isPending}
        onConfirm={async () => {
          if (pendingDelete) await deleteMeeting.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </Page>
  )
}

interface MeetingCardProps {
  meeting: MeetingWithRelations
  onEdit: () => void
  onDelete: () => void
  onToggleActive: () => void
}

function MeetingCard({ meeting, onEdit, onDelete, onToggleActive }: MeetingCardProps) {
  return (
    <article
      className={cn(
        'group relative rounded-xl border border-border/70 p-3 transition-all duration-200 ease-fluid hover:border-foreground/15 hover:bg-muted/40',
        !meeting.isActive && 'opacity-55',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <p className="break-words text-[15px] font-medium leading-snug">{meeting.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{describeRecurrence(meeting)}</p>
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={`Actions for ${meeting.title}`}
            className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-200 ease-fluid hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={onEdit}>
              <Pencil className="h-4 w-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onToggleActive}>
              {meeting.isActive ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Resume
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4" />
              Delete meeting
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="outline" className="tabular-nums">
          {meeting.time}–{meetingEndTime(meeting)}
        </Badge>
        {meeting.project && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                'h-1.5 w-1.5 rounded-full',
                PROJECT_COLOR_CLASSES[meeting.project.color] ?? 'bg-muted-foreground',
              )}
              aria-hidden
            />
            {meeting.project.name}
          </span>
        )}
        {meeting.requester && <span>· {meeting.requester.name}</span>}
        {meeting.link && (
          <a
            href={meeting.link}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 transition-colors duration-200 ease-fluid hover:text-foreground"
          >
            <Video className="h-3 w-3" />
            Join
          </a>
        )}
      </div>
    </article>
  )
}
