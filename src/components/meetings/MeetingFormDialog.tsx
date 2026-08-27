import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/common/FormField'
import { DatePicker } from '@/components/common/DatePicker'
import { ProjectCombobox, RequesterCombobox } from '@/components/common/EntityComboboxes'
import { useCreateMeeting, useUpdateMeeting } from '@/hooks/useMeetings'
import { WEEKDAY_LABELS } from '@/services/meetingService'
import { meetingSchema, type MeetingValues } from '@/schemas'
import { MEETING_RECURRENCES } from '@/types/domain'
import { today } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { Meeting, MeetingRecurrence } from '@/types/domain'

interface MeetingFormDialogProps {
  /** `null` opens the dialog in create mode. */
  meeting: Meeting | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const RECURRENCE_LABELS: Record<MeetingRecurrence, string> = {
  daily: 'Every day',
  weekdays: 'Every weekday',
  weekly: 'Specific days',
  once: 'One-off',
}

function emptyValues(): MeetingValues {
  return {
    title: '',
    time: '09:00',
    durationMinutes: 30,
    recurrence: 'weekdays',
    weekdays: [],
    date: null,
    projectId: null,
    requesterId: null,
    link: '',
    notes: '',
    isActive: true,
  }
}

function toValues(meeting: Meeting): MeetingValues {
  return {
    title: meeting.title,
    time: meeting.time,
    durationMinutes: meeting.durationMinutes,
    recurrence: meeting.recurrence,
    weekdays: meeting.weekdays,
    date: meeting.date ?? null,
    projectId: meeting.projectId ?? null,
    requesterId: meeting.requesterId ?? null,
    link: meeting.link ?? '',
    notes: meeting.notes ?? '',
    isActive: meeting.isActive,
  }
}

/** Create and edit a recurring meeting. One dialog serves both modes. */
export function MeetingFormDialog({ meeting, open, onOpenChange }: MeetingFormDialogProps) {
  const [values, setValues] = React.useState<MeetingValues>(emptyValues)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const createMeeting = useCreateMeeting()
  const updateMeeting = useUpdateMeeting()
  const pending = createMeeting.isPending || updateMeeting.isPending

  React.useEffect(() => {
    if (!open) return
    setValues(meeting ? toValues(meeting) : emptyValues())
    setErrors({})
  }, [meeting, open])

  const set = <K extends keyof MeetingValues>(key: K, value: MeetingValues[K]) =>
    setValues((state) => ({ ...state, [key]: value }))

  const toggleWeekday = (day: number) =>
    setValues((state) => ({
      ...state,
      weekdays: state.weekdays.includes(day)
        ? state.weekdays.filter((value) => value !== day)
        : [...state.weekdays, day],
    }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = meetingSchema.safeParse(values)

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
        ),
      )
      return
    }

    setErrors({})
    const payload = {
      ...result.data,
      date: result.data.recurrence === 'once' ? (result.data.date ?? today()) : null,
      weekdays: result.data.recurrence === 'weekly' ? result.data.weekdays : [],
      link: result.data.link || undefined,
      notes: result.data.notes || undefined,
    }

    if (meeting) await updateMeeting.mutateAsync({ id: meeting.id, patch: payload })
    else await createMeeting.mutateAsync(payload)

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{meeting ? 'Edit meeting' : 'New meeting'}</DialogTitle>
          <DialogDescription>
            Stored once as a schedule — it appears on every day it applies to.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <FormField id="meeting-title" label="Meeting" error={errors.title} required>
            <Input
              id="meeting-title"
              autoFocus
              value={values.title}
              onChange={(event) => set('title', event.target.value)}
              placeholder="Daily stand-up"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <FormField id="meeting-time" label="Starts" error={errors.time} required>
              <Input
                id="meeting-time"
                type="time"
                value={values.time}
                onChange={(event) => set('time', event.target.value)}
              />
            </FormField>

            <FormField id="meeting-duration" label="Minutes" error={errors.durationMinutes}>
              <Input
                id="meeting-duration"
                type="number"
                min={5}
                max={480}
                step={5}
                value={values.durationMinutes}
                onChange={(event) => set('durationMinutes', Number(event.target.value))}
              />
            </FormField>

            <FormField id="meeting-recurrence" label="Repeats" className="col-span-2 sm:col-span-1">
              <Select
                value={values.recurrence}
                onValueChange={(value) => set('recurrence', value as MeetingRecurrence)}
              >
                <SelectTrigger id="meeting-recurrence">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MEETING_RECURRENCES.map((recurrence) => (
                    <SelectItem key={recurrence} value={recurrence}>
                      {RECURRENCE_LABELS[recurrence]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          {values.recurrence === 'weekly' && (
            <FormField id="meeting-weekdays" label="Days" error={errors.weekdays}>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Weekdays">
                {WEEKDAY_LABELS.map((label, index) => {
                  const day = index + 1
                  const selected = values.weekdays.includes(day)
                  return (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleWeekday(day)}
                      className={cn(
                        'h-9 w-11 rounded-md border text-[13px] transition-all duration-200 ease-fluid active:scale-95',
                        selected
                          ? 'border-transparent bg-primary text-primary-foreground'
                          : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
                      )}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>
            </FormField>
          )}

          {values.recurrence === 'once' && (
            <FormField id="meeting-date" label="Date" error={errors.date} required>
              <DatePicker
                id="meeting-date"
                value={values.date ?? null}
                onChange={(date) => set('date', date)}
                allowClear={false}
              />
            </FormField>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="meeting-project" label="Project">
              <ProjectCombobox
                id="meeting-project"
                value={values.projectId ?? null}
                onChange={(projectId) => set('projectId', projectId)}
              />
            </FormField>

            <FormField id="meeting-requester" label="Organiser">
              <RequesterCombobox
                id="meeting-requester"
                value={values.requesterId ?? null}
                onChange={(requesterId) => set('requesterId', requesterId)}
              />
            </FormField>
          </div>

          <FormField id="meeting-link" label="Link" error={errors.link}>
            <Input
              id="meeting-link"
              type="url"
              value={values.link}
              onChange={(event) => set('link', event.target.value)}
              placeholder="https://meet.google.com/…"
            />
          </FormField>

          <FormField id="meeting-notes" label="Notes" error={errors.notes}>
            <Textarea
              id="meeting-notes"
              rows={2}
              value={values.notes}
              onChange={(event) => set('notes', event.target.value)}
              placeholder="Optional"
            />
          </FormField>

          {meeting && (
            <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="meeting-active" className="text-sm">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Pausing keeps the history but stops it appearing on Today.
                </p>
              </div>
              <Switch
                id="meeting-active"
                checked={values.isActive}
                onCheckedChange={(checked) => set('isActive', checked)}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {meeting ? 'Save' : 'Schedule meeting'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
