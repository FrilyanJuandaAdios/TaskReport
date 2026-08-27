import * as React from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  Database,
  Download,
  HardDriveDownload,
  Loader2,
  Plug,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/common/PageHeader'
import { Widget } from '@/components/common/Widget'
import { FormField } from '@/components/common/FormField'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { DatePicker } from '@/components/common/DatePicker'
import { useSaveSettings, useSettings } from '@/hooks/useAppData'
import {
  downloadBackup,
  readFileAsText,
  resetAllData,
  restoreBackup,
} from '@/services/backupService'
import { exportDeliveriesExcel, exportRangeExcel, exportTasksCsv, importTasksFile } from '@/services/exportService'
import {
  notificationPermission,
  requestNotificationPermission,
  sendTestReminder,
  type ReminderKind,
} from '@/services/reminderService'
import { notionMode } from '@/services/notionService'
import { settingsSchema } from '@/schemas'
import { addDaysISO, today } from '@/lib/date'
import { env } from '@/lib/env'
import { ROUTES } from '@/constants/navigation'
import { toast, toastError } from '@/hooks/useToast'
import { useQueryClient } from '@tanstack/react-query'
import type { AppSettings, ISODate } from '@/types/domain'
import { Page } from '@/components/layout/Page'

/** Everything configurable, grouped by how often it is touched. */
export function SettingsPage() {
  const { data: settings } = useSettings()
  const saveSettings = useSaveSettings()

  if (!settings) return null

  return (
    <Page className="space-y-4">
      <PageHeader title="Settings" />

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <ProfileSection settings={settings} onSave={(patch) => saveSettings.mutate(patch)} />
        <RemindersSection settings={settings} onSave={(patch) => saveSettings.mutate(patch)} />
        <DataSection />
        <div className="space-y-4">
          <IntegrationsSection />
          <StorageSection />
        </div>
      </div>
    </Page>
  )
}

interface SectionProps {
  settings: AppSettings
  onSave: (patch: Partial<AppSettings>) => void
}

function ProfileSection({ settings, onSave }: SectionProps) {
  const [name, setName] = React.useState(settings.userName)
  const [start, setStart] = React.useState(settings.workdayStart)
  const [end, setEnd] = React.useState(settings.workdayEnd)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const result = settingsSchema
      .pick({ userName: true, workdayStart: true, workdayEnd: true })
      .safeParse({ userName: name, workdayStart: start, workdayEnd: end })

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0]), issue.message]),
        ),
      )
      return
    }

    setErrors({})
    onSave(result.data)
    toast({ title: 'Profile saved' })
  }

  return (
    <Widget title="Profile" icon={User} contentClassName="space-y-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
        <FormField id="settings-name" label="Display name" error={errors.userName}>
          <Input
            id="settings-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField id="settings-start" label="Workday starts" error={errors.workdayStart}>
          <Input
            id="settings-start"
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </FormField>
        <FormField id="settings-end" label="Workday ends" error={errors.workdayEnd}>
          <Input
            id="settings-end"
            type="time"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </FormField>
        <div className="sm:col-span-3">
          <Button type="submit" size="sm">
            Save profile
          </Button>
        </div>
      </form>

      <FormField id="settings-theme" label="Theme" className="max-w-[220px]">
        <Select
          value={settings.theme}
          onValueChange={(theme) => onSave({ theme: theme as AppSettings['theme'] })}
        >
          <SelectTrigger id="settings-theme">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="system">Match system</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="dark">Dark</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
    </Widget>
  )
}

function RemindersSection({ settings, onSave }: SectionProps) {
  const [permission, setPermission] = React.useState(notificationPermission())

  const testReminder = async (kind: ReminderKind) => {
    const result = await sendTestReminder(kind)
    setPermission(notificationPermission())
    if (result === 'sent') {
      toast({ title: 'Test reminder sent', description: 'Check your notification center.' })
      return
    }
    toast({
      variant: 'destructive',
      title: result === 'unsupported' ? 'Notifications unavailable' : 'Notifications blocked',
      description:
        result === 'unsupported'
          ? 'This browser does not support web notifications.'
          : 'Allow notifications for Taskqueue in your browser settings, then try again.',
    })
  }

  const enable = async (key: 'morningReminderEnabled' | 'eveningReminderEnabled', value: boolean) => {
    if (value && permission !== 'granted') {
      const result = await requestNotificationPermission()
      setPermission(result)
      if (result !== 'granted') {
        toast({
          variant: 'destructive',
          title: 'Notifications blocked',
          description: 'Allow notifications in your browser to use reminders.',
        })
        return
      }
    }
    onSave({ [key]: value })
  }

  return (
    <Widget
      title="Reminders"
      icon={Bell}
      description={
        permission === 'unsupported'
          ? 'Not supported in this browser'
          : 'Fire while the app is open — install it as an app and they behave like native notifications.'
      }
      contentClassName="space-y-3"
    >
      <div className="space-y-3">
        <ReminderRow
          id="morning"
          label="Morning check-in"
          description="“What are you working on today?”"
          enabled={settings.morningReminderEnabled}
          time={settings.morningReminderTime}
          onToggle={(value) => enable('morningReminderEnabled', value)}
          onTimeChange={(morningReminderTime) => onSave({ morningReminderTime })}
          onTest={() => void testReminder('morning')}
        />
        <ReminderRow
          id="evening"
          label="End-of-day review"
          description="“Ready to review your day?”"
          enabled={settings.eveningReminderEnabled}
          time={settings.eveningReminderTime}
          onToggle={(value) => enable('eveningReminderEnabled', value)}
          onTimeChange={(eveningReminderTime) => onSave({ eveningReminderTime })}
          onTest={() => void testReminder('evening')}
        />
      </div>
    </Widget>
  )
}

interface ReminderRowProps {
  id: string
  label: string
  description: string
  enabled: boolean
  time: string
  onToggle: (value: boolean) => void
  onTimeChange: (value: string) => void
  onTest: () => void
}

function ReminderRow({
  id,
  label,
  description,
  enabled,
  time,
  onToggle,
  onTimeChange,
  onTest,
}: ReminderRowProps) {
  return (
    <div className="grid gap-4 rounded-2xl border border-border/70 p-4 sm:grid-cols-[minmax(0,1fr)_7rem_auto_auto] sm:items-center">
      <div className="min-w-0 space-y-1">
        <Label htmlFor={`${id}-toggle`} className="text-sm">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Input
        type="time"
        value={time}
        onChange={(event) => onTimeChange(event.target.value)}
        className="h-11 w-full sm:h-9 sm:w-28"
        aria-label={`${label} time`}
      />
      <Button variant="outline" size="sm" onClick={onTest}>
        <Bell className="h-4 w-4" />
        Test
      </Button>
      <div className="flex min-h-11 items-center justify-between gap-3 sm:min-h-0">
        <span className="text-xs text-muted-foreground sm:sr-only">Enabled</span>
        <Switch id={`${id}-toggle`} checked={enabled} onCheckedChange={onToggle} />
      </div>
    </div>
  )
}

function DataSection() {
  const queryClient = useQueryClient()
  const fileInput = React.useRef<HTMLInputElement>(null)
  const taskImportInput = React.useRef<HTMLInputElement>(null)

  const [from, setFrom] = React.useState<ISODate | null>(addDaysISO(today(), -30))
  const [to, setTo] = React.useState<ISODate | null>(today())
  const [busy, setBusy] = React.useState(false)
  const [pendingFile, setPendingFile] = React.useState<File | null>(null)
  const [confirmReset, setConfirmReset] = React.useState(false)

  const run = async (task: () => Promise<void>, failure: string) => {
    setBusy(true)
    try {
      await task()
    } catch (error) {
      toastError(error, failure)
    } finally {
      setBusy(false)
    }
  }

  const restore = async () => {
    if (!pendingFile) return
    await run(async () => {
      const contents = await readFileAsText(pendingFile)
      const result = await restoreBackup(contents)
      await queryClient.invalidateQueries()
      toast({
        title: 'Backup restored',
        description: `${result.tasks} tasks, ${result.deliveries} deliveries, ${result.reports} reports.`,
      })
    }, 'Restore failed — the file may not be a Taskqueue backup.')
    setPendingFile(null)
  }

  return (
    <Widget title="Data export &amp; backup" icon={HardDriveDownload} contentClassName="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField id="export-from" label="From">
          <DatePicker id="export-from" value={from} onChange={setFrom} allowClear={false} />
        </FormField>
        <FormField id="export-to" label="To">
          <DatePicker id="export-to" value={to} onChange={setTo} allowClear={false} />
        </FormField>
        <div className="flex flex-wrap gap-2 pb-0.5">
          <Button
            variant="outline"
            disabled={busy || !from || !to}
            onClick={() => run(() => exportRangeExcel(from as ISODate, to as ISODate), 'Export failed.')}
          >
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            disabled={busy || !from || !to}
            onClick={() => run(() => exportTasksCsv(from as ISODate, to as ISODate), 'Export failed.')}
          >
            <Download className="h-4 w-4" />
            CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" disabled={busy} onClick={() => run(() => exportDeliveriesExcel(), 'Export failed.')}>
          <Download className="h-4 w-4" />
          Export delivery tracker
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => run(downloadBackup, 'Backup failed.')}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export all data (JSON)
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Upload className="h-4 w-4" />
          Import backup
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => taskImportInput.current?.click()}>
          <Upload className="h-4 w-4" />
          Add tasks from export
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) setPendingFile(file)
            event.target.value = ''
          }}
        />
        <input
          ref={taskImportInput}
          type="file"
          accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              void run(async () => {
                const result = await importTasksFile(file)
                await queryClient.invalidateQueries()
                toast({
                  title: `${result.imported} tasks imported`,
                  description: result.skipped > 0 ? `${result.skipped} invalid or duplicate rows were skipped.` : 'Existing data was kept.',
                })
              }, 'Task import failed.')
            }
            event.target.value = ''
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        Excel and CSV add tasks without deleting current data. JSON backup restore replaces the
        whole archive so ids and relationships stay identical.
      </p>

      <div className="flex items-center justify-between gap-4 rounded-xl border border-destructive/25 bg-destructive/[0.03] px-3 py-3">
        <div className="space-y-0.5">
          <p className="text-sm">Reset all data</p>
          <p className="text-xs text-muted-foreground">
            Deletes every task, delivery, report, project and person. Your settings are kept.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          className="shrink-0 border-destructive/30 text-destructive hover:bg-destructive/5 hover:text-destructive"
          onClick={() => setConfirmReset(true)}
        >
          <Trash2 className="h-4 w-4" />
          Reset
        </Button>
      </div>

      <ConfirmDialog
        open={Boolean(pendingFile)}
        onOpenChange={(open) => !open && setPendingFile(null)}
        title="Replace all data with this backup?"
        description="Everything currently stored in this browser will be deleted and replaced by the contents of the file. Export a backup first if you are unsure."
        confirmLabel="Replace all data"
        destructive
        loading={busy}
        onConfirm={restore}
      />

      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Delete everything?"
        description="Every task, delivery, daily report, project, person and tag is removed. This cannot be undone — export a JSON backup first if there is anything you want to keep."
        confirmLabel="Delete everything"
        destructive
        loading={busy}
        onConfirm={async () => {
          await run(async () => {
            await resetAllData()
            await queryClient.invalidateQueries()
            toast({ title: 'All data deleted' })
          }, 'Reset failed.')
          setConfirmReset(false)
        }}
      />
    </Widget>
  )
}

function IntegrationsSection() {
  const mode = notionMode()

  return (
    <Widget
      title="Notion"
      icon={Plug}
      description={mode === 'proxy' ? 'Proxy configured' : 'Mock mode'}
      contentClassName="space-y-2"
    >
      <p className="text-sm text-muted-foreground">
        {mode === 'mock'
          ? 'Send to Notion currently copies the report to your clipboard instead of calling the API. Set VITE_NOTION_DRIVER=proxy and VITE_NOTION_PROXY_URL to switch to a real sync — no other change is needed.'
          : `Reports are posted to ${env.notionProxyUrl}. The integration token stays on the server; it is never bundled into this app.`}
      </p>
      <p className="text-xs text-muted-foreground">
        See the README section “Notion integration” for the serverless function to deploy.
      </p>
    </Widget>
  )
}

function StorageSection() {
  return (
    <Widget title="Storage" icon={Database} contentClassName="space-y-3">
      <div className="flex items-start gap-3">
        <div className="space-y-1 text-sm">
          <p className="font-medium">
            {env.dbDriver === 'supabase' ? 'Supabase (Postgres)' : 'This browser (IndexedDB)'}
          </p>
          <p className="text-muted-foreground">
            {env.dbDriver === 'supabase'
              ? 'Data is stored in your Supabase project and available on every device you sign in from.'
              : 'Data lives in this browser only. Export a JSON backup regularly, or switch VITE_DB_DRIVER to supabase for sync across devices.'}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Manage projects, requesters and tags on the{' '}
        <Link to={ROUTES.projects} className="underline hover:text-foreground">
          Projects &amp; people
        </Link>{' '}
        page.
      </p>
    </Widget>
  )
}
