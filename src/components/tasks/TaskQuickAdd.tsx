import * as React from 'react'
import { ArrowUp, Loader2, Plus, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ProjectCombobox, RequesterCombobox } from '@/components/common/EntityComboboxes'
import { DatePicker } from '@/components/common/DatePicker'
import { useProjects, useRequesters } from '@/hooks/useCatalog'
import { useBulkQuickAddTasks, useCreateTask, useQuickAddTask, type QuickAddDefaults } from '@/hooks/useTasks'
import { toast } from '@/hooks/useToast'
import { describeParsedTask, parseQuickTask } from '@/services/quickParse'
import { PRIORITIES } from '@/types/domain'
import { PRIORITY_META } from '@/constants/status'
import { parseTimeInput } from '@/lib/date'
import { quickTaskSchema } from '@/schemas'
import { cn } from '@/lib/utils'
import type { ISODate, Priority } from '@/types/domain'

interface TaskQuickAddProps {
  date: ISODate
  autoFocus?: boolean
  placeholder?: string
  className?: string
  /** `hero` is the oversized centred field on Today; `inline` is everywhere else. */
  variant?: 'hero' | 'inline'
  /** Pre-linked delivery/project/requester, e.g. when logging from a delivery. */
  defaults?: QuickAddDefaults
  /** Hides the optional-detail panel where the context already supplies it. */
  hideDetails?: boolean
}

interface DetailState {
  projectId: string | null
  requesterId: string | null
  plannedTime: string
  targetDate: ISODate | null
  priority: Priority
}

const EMPTY_DETAILS: DetailState = {
  projectId: null,
  requesterId: null,
  plannedTime: '',
  targetDate: null,
  priority: 'normal',
}

/**
 * The fastest path in the app: type, press Enter, keep typing.
 *
 * The syntax hint only appears while the field is focused and empty — a
 * permanent cheatsheet under the most-used control in the app is noise.
 * Optional properties stay behind a single icon (progressive disclosure).
 */
export const TaskQuickAdd = React.forwardRef<HTMLInputElement, TaskQuickAddProps>(
  function TaskQuickAdd(
    {
      date,
      autoFocus,
      placeholder = 'What are you working on?',
      className,
      variant = 'inline',
      defaults,
      hideDetails = false,
    },
    forwardedRef,
  ) {
    const inputRef = React.useRef<HTMLInputElement>(null)
    React.useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement)

    const [value, setValue] = React.useState('')
    const [error, setError] = React.useState<string | null>(null)
    const [focused, setFocused] = React.useState(false)
    const [expanded, setExpanded] = React.useState(false)
    const [details, setDetails] = React.useState<DetailState>(EMPTY_DETAILS)

    const { data: projects = [] } = useProjects()
    const { data: requesters = [] } = useRequesters()
    const quickAdd = useQuickAddTask(date, defaults)
    const bulkAdd = useBulkQuickAddTasks(date, defaults)
    const createTask = useCreateTask()

    const hero = variant === 'hero'
    const pending = quickAdd.isPending || bulkAdd.isPending || createTask.isPending
    const trimmed = value.trim()

    const preview = React.useMemo(() => {
      if (expanded || trimmed.length === 0) return []
      return describeParsedTask(parseQuickTask(value, { projects, requesters }))
    }, [value, trimmed, expanded, projects, requesters])

    const reset = () => {
      setValue('')
      setDetails(EMPTY_DETAILS)
      setError(null)
      inputRef.current?.focus()
    }

    const submit = async () => {
      const parsed = quickTaskSchema.safeParse({ title: value })
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? 'Type what you are working on')
        return
      }
      setError(null)

      if (expanded) {
        await createTask.mutateAsync({
          title: trimmed,
          date,
          projectId: details.projectId ?? defaults?.projectId ?? null,
          requesterId: details.requesterId ?? defaults?.requesterId ?? null,
          deliveryId: defaults?.deliveryId ?? null,
          plannedTime: parseTimeInput(details.plannedTime),
          targetDate: details.targetDate,
          priority: details.priority,
        })
      } else {
        await quickAdd.mutateAsync(value)
      }

      reset()
    }

    /** Footer line: an error, what the parser found, or the syntax hint. */
    const footer = error ? (
      <span role="alert" className="text-destructive">
        {error}
      </span>
    ) : preview.length > 0 ? (
      <span className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
        {preview.map((part, index) => (
          <React.Fragment key={part}>
            {index > 0 && <span className="text-border">·</span>}
            <span className="text-foreground/70">{part}</span>
          </React.Fragment>
        ))}
      </span>
    ) : focused ? (
      <span>
        <Hint>@person</Hint> <Hint>#project</Hint> <Hint>09:30</Hint> <Hint>tomorrow</Hint>
      </span>
    ) : null

    return (
      <div className={cn('w-full', className)}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
          className={cn(
            'group relative flex items-center gap-2 rounded-xl border bg-background transition-all duration-300 ease-fluid',
            hero ? 'px-2 py-2 shadow-sm' : 'px-1.5 py-1.5',
            focused
              ? 'border-foreground/25 ring-4 ring-brand/10'
              : 'border-border hover:border-foreground/20',
          )}
        >
          <Input
            ref={inputRef}
            autoFocus={autoFocus}
            value={value}
            onChange={(event) => {
              setValue(event.target.value)
              if (error) setError(null)
            }}
            onPaste={(event) => {
              const lines = event.clipboardData
                .getData('text')
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter(Boolean)
              if (lines.length < 2) return

              event.preventDefault()
              const validLines = lines.filter((line) => line.length <= 200)
              if (validLines.length === 0) {
                setError('Each pasted task must be under 200 characters')
                return
              }

              void bulkAdd.mutateAsync(validLines).then((tasks) => {
                reset()
                toast({
                  title: `${tasks.length} tasks added`,
                  description:
                    validLines.length < lines.length
                      ? `${lines.length - validLines.length} long lines were skipped.`
                      : 'Each pasted line became its own task.',
                })
              })
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setValue('')
                setExpanded(false)
                event.currentTarget.blur()
              }
            }}
            placeholder={placeholder}
            aria-label="What are you working on?"
            aria-invalid={Boolean(error)}
            className={cn(
              'border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
              hero ? 'h-12 text-lg placeholder:text-muted-foreground/60' : 'h-9',
            )}
          />

          {!hideDetails && (
            <Button
              type="button"
              variant="ghost"
              size={hero ? 'icon' : 'icon-sm'}
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Hide details' : 'Add details'}
              className={cn(
                'shrink-0 text-muted-foreground transition-colors duration-200 ease-fluid',
                expanded && 'bg-muted text-foreground',
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
          )}

          <Button
            type="submit"
            size={hero ? 'icon' : 'icon-sm'}
            disabled={pending || trimmed.length === 0}
            aria-label="Add task"
            className={cn(
              'shrink-0 rounded-lg transition-all duration-300 ease-fluid',
              hero && 'h-11 w-11',
              trimmed.length === 0 && 'opacity-40',
            )}
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : hero ? (
              <ArrowUp className="h-5 w-5" strokeWidth={2.4} />
            ) : (
              <Plus className="h-4 w-4" />
            )}
          </Button>
        </form>

        {/* Fixed-height slot so the layout never jumps as the message changes. */}
        <div
          className={cn(
            'mt-2 flex min-h-7 items-start overflow-hidden text-xs leading-relaxed text-muted-foreground transition-opacity duration-300 ease-fluid',
            hero ? 'justify-center' : 'justify-start px-1',
            footer ? 'opacity-100' : 'opacity-0',
          )}
        >
          {footer}
        </div>

        {expanded && (
          <div className="mt-1 grid animate-rise gap-3 rounded-xl border border-border bg-muted/30 p-3 text-left sm:grid-cols-2 lg:grid-cols-5">
            <Field id="quick-project" label="Project">
              <ProjectCombobox
                id="quick-project"
                value={details.projectId}
                onChange={(projectId) => setDetails((state) => ({ ...state, projectId }))}
              />
            </Field>

            <Field id="quick-requester" label="Requested by">
              <RequesterCombobox
                id="quick-requester"
                value={details.requesterId}
                onChange={(requesterId) => setDetails((state) => ({ ...state, requesterId }))}
              />
            </Field>

            <Field id="quick-time" label="Time">
              <Input
                id="quick-time"
                value={details.plannedTime}
                onChange={(event) =>
                  setDetails((state) => ({ ...state, plannedTime: event.target.value }))
                }
                placeholder="09:30"
                inputMode="numeric"
              />
            </Field>

            <Field id="quick-target" label="Deliver by">
              <DatePicker
                id="quick-target"
                value={details.targetDate}
                onChange={(targetDate) => setDetails((state) => ({ ...state, targetDate }))}
                placeholder="—"
              />
            </Field>

            <Field id="quick-priority" label="Priority">
              <Select
                value={details.priority}
                onValueChange={(priority) =>
                  setDetails((state) => ({ ...state, priority: priority as Priority }))
                }
              >
                <SelectTrigger id="quick-priority">
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
            </Field>
          </div>
        )}
      </div>
    )
  },
)

function Field({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
      {children}
    </code>
  )
}
