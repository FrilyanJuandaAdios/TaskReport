import { Check, ExternalLink, SkipForward, Video } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/common/EmptyState'
import { useSetMeetingStatus } from '@/hooks/useMeetings'
import { meetingEndTime } from '@/services/meetingService'
import { cn } from '@/lib/utils'
import type { MeetingOccurrence } from '@/types/domain'

interface MeetingListProps {
  occurrences: MeetingOccurrence[]
  /** Read-only in history; interactive on Today. */
  editable?: boolean
  emptyText?: string
}

/**
 * The day's meetings.
 *
 * Two actions only — attended or skipped — because that is the whole question at
 * the end of a day. Tapping the same action again clears it back to scheduled.
 */
export function MeetingList({ occurrences, editable = true, emptyText }: MeetingListProps) {
  const setStatus = useSetMeetingStatus()

  if (occurrences.length === 0) {
    return <EmptyState compact title={emptyText ?? 'No meetings scheduled.'} />
  }

  return (
    <ul className="-mx-2">
      {occurrences.map(({ meeting, date, status }) => {
        const attended = status === 'attended'
        const skipped = status === 'skipped'

        const toggle = (next: 'attended' | 'skipped') =>
          setStatus.mutate({
            meetingId: meeting.id,
            date,
            status: status === next ? 'scheduled' : next,
          })

        return (
          <li
            key={meeting.id}
            className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-200 ease-fluid hover:bg-muted/50"
          >
            <span className="w-[86px] shrink-0 text-[13px] tabular-nums text-muted-foreground">
              {meeting.time}
              <span className="text-muted-foreground/50"> – {meetingEndTime(meeting)}</span>
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  'truncate text-[15px] leading-snug',
                  skipped && 'text-muted-foreground line-through decoration-muted-foreground/40',
                )}
              >
                {meeting.title}
              </p>
              {(meeting.project || meeting.requester) && (
                <p className="truncate text-xs text-muted-foreground">
                  {[meeting.project?.name, meeting.requester?.name].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>

            {meeting.link && (
              <a
                href={meeting.link}
                target="_blank"
                rel="noreferrer"
                aria-label={`Join ${meeting.title}`}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors duration-200 ease-fluid hover:bg-muted hover:text-foreground"
              >
                <Video className="h-4 w-4" />
              </a>
            )}

            {editable ? (
              <div className="flex shrink-0 items-center gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={attended ? 'Clear attended' : 'Mark attended'}
                  aria-pressed={attended}
                  onClick={() => toggle('attended')}
                  className={cn(
                    'text-muted-foreground',
                    attended && 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
                  )}
                >
                  <Check className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={skipped ? 'Clear skipped' : 'Mark skipped'}
                  aria-pressed={skipped}
                  onClick={() => toggle('skipped')}
                  className={cn(
                    'text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100',
                    skipped && 'opacity-100',
                  )}
                >
                  <SkipForward className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">
                {attended ? 'Attended' : skipped ? 'Skipped' : ''}
              </span>
            )}

            {meeting.link && !editable && (
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
            )}
          </li>
        )
      })}
    </ul>
  )
}
