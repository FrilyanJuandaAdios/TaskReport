import * as React from 'react'
import { Bell, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/common/FormField'
import { DatePicker } from '@/components/common/DatePicker'
import { TagPicker } from '@/components/common/TagPicker'
import {
  DeliveryCombobox,
  ProjectCombobox,
  RequesterCombobox,
} from '@/components/common/EntityComboboxes'
import { ActivityTimeline } from '@/components/common/ActivityTimeline'
import { useDeleteTask, useUpdateTask } from '@/hooks/useTasks'
import { useEntityActivity } from '@/hooks/useAppData'
import { taskDetailsSchema, type TaskDetailsValues } from '@/schemas'
import { PRIORITY_META, TASK_STATUS_META } from '@/constants/status'
import { PRIORITIES, TASK_STATUSES } from '@/types/domain'
import { parseTimeInput } from '@/lib/date'
import { requestNotificationPermission } from '@/services/reminderService'
import type { TaskWithRelations } from '@/types/domain'

interface TaskDetailsSheetProps {
  task: TaskWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

type FormState = Omit<TaskDetailsValues, 'plannedTime' | 'reminderTime'> & {
  plannedTime: string
  reminderTime: string
}

function toFormState(task: TaskWithRelations): FormState {
  return {
    title: task.title,
    description: task.description ?? '',
    date: task.date,
    plannedTime: task.plannedTime ?? '',
    reminderTime: task.reminderTime ?? '',
    targetDate: task.targetDate ?? null,
    status: task.status,
    priority: task.priority,
    isPlanned: task.isPlanned,
    projectId: task.projectId ?? null,
    requesterId: task.requesterId ?? null,
    deliveryId: task.deliveryId ?? null,
    tagIds: task.tagIds,
    notes: task.notes ?? '',
  }
}

/**
 * Full task editor.
 *
 * A centered detail editor. The quick-add path stays fast, while clicking a task
 * reveals its complete context without navigating away from the day.
 */
export function TaskDetailsSheet({ task, open, onOpenChange }: TaskDetailsSheetProps) {
  const [form, setForm] = React.useState<FormState | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)

  const updateTask = useUpdateTask()
  const deleteTask = useDeleteTask()
  const { data: activity = [] } = useEntityActivity('task', task?.id)

  React.useEffect(() => {
    setForm(task ? toFormState(task) : null)
    setErrors({})
    setConfirmingDelete(false)
  }, [task])

  if (!task || !form) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent />
      </Dialog>
    )
  }

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((state) => (state ? { ...state, [key]: value } : state))
  }

  const save = async () => {
    const plannedTime = form.plannedTime.trim() ? parseTimeInput(form.plannedTime) : null
    if (form.plannedTime.trim() && !plannedTime) {
      setErrors({ plannedTime: 'Use a 24-hour time such as 09:30' })
      return
    }

    const reminderTime = form.reminderTime.trim() ? parseTimeInput(form.reminderTime) : null
    if (form.reminderTime.trim() && !reminderTime) {
      setErrors({ reminderTime: 'Use a 24-hour time such as 14:00' })
      return
    }

    if (reminderTime) await requestNotificationPermission()

    const candidate: TaskDetailsValues = { ...form, plannedTime, reminderTime }
    const result = taskDetailsSchema.safeParse(candidate)

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      )
      return
    }

    setErrors({})
    await updateTask.mutateAsync({
      id: task.id,
      patch: {
        ...result.data,
        description: result.data.description || undefined,
        notes: result.data.notes || undefined,
      },
    })
    onOpenChange(false)
  }

  const remove = async () => {
    await deleteTask.mutateAsync(task.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(88dvh,820px)] w-[calc(100%-1.5rem)] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-5 pr-16">
          <DialogTitle className="text-lg">Task details</DialogTitle>
          <DialogDescription>See the full context, schedule a reminder, or update this task.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <FormField id="task-title" label="Task name" error={errors.title} required>
            <Input
              id="task-title"
              value={form.title}
              onChange={(event) => set('title', event.target.value)}
            />
          </FormField>

          <FormField id="task-description" label="Description" error={errors.description}>
            <Textarea
              id="task-description"
              rows={3}
              value={form.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="What exactly needs doing?"
            />
          </FormField>

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="task-date" label="Work date" error={errors.date}>
              <DatePicker
                id="task-date"
                value={form.date}
                onChange={(date) => date && set('date', date)}
                allowClear={false}
              />
            </FormField>

            <FormField
              id="task-time"
              label="Planned time"
              error={errors.plannedTime}
              hint="Leave empty for “anytime today”."
            >
              <Input
                id="task-time"
                value={form.plannedTime}
                onChange={(event) => set('plannedTime', event.target.value)}
                placeholder="09:30"
                inputMode="numeric"
              />
            </FormField>

            <FormField
              id="task-reminder"
              label="Remind me at"
              error={errors.reminderTime}
              hint="You’ll get a notification on the task date."
            >
              <div className="relative">
                <Bell className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="task-reminder"
                  type="time"
                  value={form.reminderTime}
                  onChange={(event) => set('reminderTime', event.target.value)}
                  className="pl-9"
                />
              </div>
            </FormField>

            <FormField id="task-status" label="Status">
              <Select value={form.status} onValueChange={(value) => set('status', value as FormState['status'])}>
                <SelectTrigger id="task-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {TASK_STATUS_META[status].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>

            <FormField id="task-priority" label="Priority">
              <Select
                value={form.priority}
                onValueChange={(value) => set('priority', value as FormState['priority'])}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_META[priority].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField id="task-project" label="Project">
              <ProjectCombobox
                id="task-project"
                value={form.projectId ?? null}
                onChange={(projectId) => set('projectId', projectId)}
              />
            </FormField>

            <FormField id="task-requester" label="Requested by">
              <RequesterCombobox
                id="task-requester"
                value={form.requesterId ?? null}
                onChange={(requesterId) => set('requesterId', requesterId)}
              />
            </FormField>

            <FormField
              id="task-delivery"
              label="Part of delivery"
              hint="Links this day's work to a delivery for auditing."
            >
              <DeliveryCombobox
                id="task-delivery"
                value={form.deliveryId ?? null}
                onChange={(deliveryId) => set('deliveryId', deliveryId)}
              />
            </FormField>

            <FormField id="task-target" label="Target delivery date">
              <DatePicker
                id="task-target"
                value={form.targetDate ?? null}
                onChange={(targetDate) => set('targetDate', targetDate)}
                placeholder="No target"
              />
            </FormField>
          </div>

          <FormField id="task-tags" label="Tags">
            <TagPicker id="task-tags" value={form.tagIds} onChange={(tagIds) => set('tagIds', tagIds)} />
          </FormField>

          <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
            <div className="space-y-0.5">
              <Label htmlFor="task-planned" className="text-sm">
                Planned this morning
              </Label>
              <p className="text-xs text-muted-foreground">
                Turn off for work that arrived during the day.
              </p>
            </div>
            <Switch
              id="task-planned"
              checked={form.isPlanned}
              onCheckedChange={(checked) => set('isPlanned', checked)}
            />
          </div>

          <FormField id="task-notes" label="Notes" error={errors.notes}>
            <Textarea
              id="task-notes"
              rows={3}
              value={form.notes}
              onChange={(event) => set('notes', event.target.value)}
              placeholder="Context worth remembering months from now."
            />
          </FormField>

          <Separator />

          <section className="space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Activity
            </h3>
            <ActivityTimeline entries={activity} emptyText="No activity recorded for this task." />
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
          {confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Delete this task?</span>
              <Button size="sm" variant="destructive" onClick={remove} disabled={deleteTask.isPending}>
                Yes, delete
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => setConfirmingDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save} disabled={updateTask.isPending}>
              {updateTask.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
