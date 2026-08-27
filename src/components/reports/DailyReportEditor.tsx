import * as React from 'react'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/common/FormField'
import type { DailyReport, TaskWithRelations } from '@/types/domain'

export interface ReportDraft {
  issues: string
  nextSteps: string
  notes: string
}

interface DailyReportEditorProps {
  draft: ReportDraft
  onChange: (draft: ReportDraft) => void
  /** Blocked tasks are appended to Issues automatically; shown here as a hint. */
  blockedTasks: TaskWithRelations[]
  errors?: Partial<Record<keyof ReportDraft, string>>
}

/**
 * The only three things the user actually has to write at the end of a day.
 * Everything else in the report is derived from tasks already captured.
 */
export function DailyReportEditor({
  draft,
  onChange,
  blockedTasks,
  errors = {},
}: DailyReportEditorProps) {
  const set = (key: keyof ReportDraft) => (event: React.ChangeEvent<HTMLTextAreaElement>) =>
    onChange({ ...draft, [key]: event.target.value })

  return (
    <div className="space-y-5">
      <FormField
        id="report-issues"
        label="Issues / Challenges"
        error={errors.issues}
        hint={
          blockedTasks.length > 0
            ? `${blockedTasks.length} blocked ${blockedTasks.length === 1 ? 'task is' : 'tasks are'} added automatically.`
            : 'One per line.'
        }
      >
        <Textarea
          id="report-issues"
          rows={3}
          value={draft.issues}
          onChange={set('issues')}
          placeholder={'Waiting confirmation from engineering team\nMissing API requirement'}
        />
      </FormField>

      <FormField id="report-next" label="Next step" error={errors.nextSteps} hint="One per line.">
        <Textarea
          id="report-next"
          rows={3}
          value={draft.nextSteps}
          onChange={set('nextSteps')}
          placeholder={'Continue Work Order prototype\nFollow up API requirement'}
        />
      </FormField>

      <FormField id="report-notes" label="Notes" error={errors.notes} hint="One per line.">
        <Textarea
          id="report-notes"
          rows={3}
          value={draft.notes}
          onChange={set('notes')}
          placeholder="Received an additional urgent CRM task at 14:00."
        />
      </FormField>
    </div>
  )
}

export function draftFromReport(report: DailyReport | null): ReportDraft {
  return {
    issues: report?.issues ?? '',
    nextSteps: report?.nextSteps ?? '',
    notes: report?.notes ?? '',
  }
}
