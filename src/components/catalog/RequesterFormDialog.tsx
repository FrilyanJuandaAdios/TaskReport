import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/common/FormField'
import { useCreateRequester, useUpdateRequester } from '@/hooks/useCatalog'
import { requesterSchema, type RequesterValues } from '@/schemas'
import type { Requester } from '@/types/domain'

interface RequesterFormDialogProps {
  /** `null` opens the dialog in create mode. */
  requester: Requester | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function emptyValues(): RequesterValues {
  return { name: '', team: '', email: '', notes: '' }
}

function toValues(requester: Requester): RequesterValues {
  return {
    name: requester.name,
    team: requester.team ?? '',
    email: requester.email ?? '',
    notes: requester.notes ?? '',
  }
}

/**
 * Create and edit a requester in one dialog.
 *
 * Renaming propagates everywhere by reference — tasks store the id, so a
 * corrected spelling fixes every past report at once.
 */
export function RequesterFormDialog({
  requester,
  open,
  onOpenChange,
}: RequesterFormDialogProps) {
  const [values, setValues] = React.useState<RequesterValues>(emptyValues)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const createRequester = useCreateRequester()
  const updateRequester = useUpdateRequester()
  const pending = createRequester.isPending || updateRequester.isPending

  React.useEffect(() => {
    if (!open) return
    setValues(requester ? toValues(requester) : emptyValues())
    setErrors({})
  }, [requester, open])

  const set = <K extends keyof RequesterValues>(key: K, value: RequesterValues[K]) =>
    setValues((state) => ({ ...state, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = requesterSchema.safeParse(values)

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
      name: result.data.name,
      team: result.data.team || undefined,
      email: result.data.email || undefined,
      notes: result.data.notes || undefined,
    }

    if (requester) await updateRequester.mutateAsync({ id: requester.id, patch: payload })
    else await createRequester.mutateAsync(payload)

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{requester ? 'Edit requester' : 'New requester'}</DialogTitle>
          <DialogDescription>
            {requester
              ? 'Every task already requested by this person updates with it.'
              : 'A person or team who asks you for work.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <FormField id="requester-name" label="Name" error={errors.name} required>
            <Input
              id="requester-name"
              autoFocus
              value={values.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="David"
            />
          </FormField>

          <div className="grid gap-3 sm:grid-cols-2">
            <FormField id="requester-team" label="Team" error={errors.team}>
              <Input
                id="requester-team"
                value={values.team}
                onChange={(event) => set('team', event.target.value)}
                placeholder="Product"
              />
            </FormField>

            <FormField id="requester-email" label="Email" error={errors.email}>
              <Input
                id="requester-email"
                type="email"
                value={values.email}
                onChange={(event) => set('email', event.target.value)}
                placeholder="Optional"
              />
            </FormField>
          </div>

          <FormField id="requester-notes" label="Notes" error={errors.notes}>
            <Textarea
              id="requester-notes"
              rows={2}
              value={values.notes}
              onChange={(event) => set('notes', event.target.value)}
              placeholder="Optional"
            />
          </FormField>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {requester ? 'Save' : 'Add requester'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
