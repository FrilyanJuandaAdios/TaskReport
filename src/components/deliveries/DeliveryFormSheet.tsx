import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { FormField } from '@/components/common/FormField'
import { DatePicker } from '@/components/common/DatePicker'
import { TagPicker } from '@/components/common/TagPicker'
import { ProjectCombobox, RequesterCombobox } from '@/components/common/EntityComboboxes'
import { useCreateDelivery, useUpdateDelivery } from '@/hooks/useDeliveries'
import { deliverySchema, type DeliveryValues } from '@/schemas'
import { DELIVERY_STATUS_META } from '@/constants/status'
import { DELIVERY_STATUSES } from '@/types/domain'
import { today } from '@/lib/date'
import type { DeliveryWithRelations } from '@/types/domain'

interface DeliveryFormSheetProps {
  delivery: DeliveryWithRelations | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (id: string) => void
}

function emptyValues(): DeliveryValues {
  return {
    title: '',
    description: '',
    projectId: null,
    requesterId: null,
    requestedDate: today(),
    targetDeliveryDate: null,
    actualDeliveryDate: null,
    status: 'not_started',
    figmaUrl: '',
    ticketUrl: '',
    referenceUrl: '',
    notes: '',
    tagIds: [],
  }
}

function toValues(delivery: DeliveryWithRelations): DeliveryValues {
  return {
    title: delivery.title,
    description: delivery.description ?? '',
    projectId: delivery.projectId ?? null,
    requesterId: delivery.requesterId ?? null,
    requestedDate: delivery.requestedDate,
    targetDeliveryDate: delivery.targetDeliveryDate ?? null,
    actualDeliveryDate: delivery.actualDeliveryDate ?? null,
    status: delivery.status,
    figmaUrl: delivery.figmaUrl ?? '',
    ticketUrl: delivery.ticketUrl ?? '',
    referenceUrl: delivery.referenceUrl ?? '',
    notes: delivery.notes ?? '',
    tagIds: delivery.tagIds,
  }
}

/** Create/edit form for a delivery. One sheet serves both modes. */
export function DeliveryFormSheet({
  delivery,
  open,
  onOpenChange,
  onSaved,
}: DeliveryFormSheetProps) {
  const [values, setValues] = React.useState<DeliveryValues>(emptyValues)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const createDelivery = useCreateDelivery()
  const updateDelivery = useUpdateDelivery()
  const pending = createDelivery.isPending || updateDelivery.isPending

  React.useEffect(() => {
    if (!open) return
    setValues(delivery ? toValues(delivery) : emptyValues())
    setErrors({})
  }, [delivery, open])

  const set = <K extends keyof DeliveryValues>(key: K, value: DeliveryValues[K]) =>
    setValues((state) => ({ ...state, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = deliverySchema.safeParse(values)

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
      description: result.data.description || undefined,
      figmaUrl: result.data.figmaUrl || undefined,
      ticketUrl: result.data.ticketUrl || undefined,
      referenceUrl: result.data.referenceUrl || undefined,
      notes: result.data.notes || undefined,
    }

    const saved = delivery
      ? await updateDelivery.mutateAsync({ id: delivery.id, patch: payload })
      : await createDelivery.mutateAsync(payload)

    onOpenChange(false)
    onSaved?.(saved.id)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
        <SheetHeader className="border-b px-6 py-4">
          <SheetTitle>{delivery ? 'Edit delivery' : 'New delivery'}</SheetTitle>
          <SheetDescription>
            A delivery is what a stakeholder asked for. Daily tasks link to it.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={submit} className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <FormField id="delivery-title" label="Delivery name" error={errors.title} required>
              <Input
                id="delivery-title"
                value={values.title}
                onChange={(event) => set('title', event.target.value)}
                placeholder="Service Schedule Revamp"
              />
            </FormField>

            <FormField id="delivery-description" label="Description" error={errors.description}>
              <Textarea
                id="delivery-description"
                rows={3}
                value={values.description}
                onChange={(event) => set('description', event.target.value)}
                placeholder="Scope, screens, expected output…"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="delivery-project" label="Project">
                <ProjectCombobox
                  id="delivery-project"
                  value={values.projectId ?? null}
                  onChange={(projectId) => set('projectId', projectId)}
                />
              </FormField>

              <FormField id="delivery-requester" label="Requested by">
                <RequesterCombobox
                  id="delivery-requester"
                  value={values.requesterId ?? null}
                  onChange={(requesterId) => set('requesterId', requesterId)}
                />
              </FormField>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField id="delivery-requested" label="Request date" error={errors.requestedDate} required>
                <DatePicker
                  id="delivery-requested"
                  value={values.requestedDate}
                  onChange={(date) => date && set('requestedDate', date)}
                  allowClear={false}
                />
              </FormField>

              <FormField id="delivery-target" label="Target delivery" error={errors.targetDeliveryDate}>
                <DatePicker
                  id="delivery-target"
                  value={values.targetDeliveryDate ?? null}
                  onChange={(date) => set('targetDeliveryDate', date)}
                  placeholder="No target yet"
                />
              </FormField>

              <FormField id="delivery-status" label="Status">
                <Select
                  value={values.status}
                  onValueChange={(status) => set('status', status as DeliveryValues['status'])}
                >
                  <SelectTrigger id="delivery-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELIVERY_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {DELIVERY_STATUS_META[status].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>

              <FormField
                id="delivery-actual"
                label="Actual delivery"
                error={errors.actualDeliveryDate}
                hint="Filled in automatically when you mark it Delivered."
              >
                <DatePicker
                  id="delivery-actual"
                  value={values.actualDeliveryDate ?? null}
                  onChange={(date) => set('actualDeliveryDate', date)}
                  placeholder="Not delivered yet"
                />
              </FormField>
            </div>

            <Separator />

            <FormField id="delivery-figma" label="Figma link" error={errors.figmaUrl}>
              <Input
                id="delivery-figma"
                type="url"
                value={values.figmaUrl}
                onChange={(event) => set('figmaUrl', event.target.value)}
                placeholder="https://figma.com/file/…"
              />
            </FormField>

            <FormField id="delivery-ticket" label="Ticket link" error={errors.ticketUrl}>
              <Input
                id="delivery-ticket"
                type="url"
                value={values.ticketUrl}
                onChange={(event) => set('ticketUrl', event.target.value)}
                placeholder="https://…"
              />
            </FormField>

            <FormField id="delivery-reference" label="Reference link" error={errors.referenceUrl}>
              <Input
                id="delivery-reference"
                type="url"
                value={values.referenceUrl}
                onChange={(event) => set('referenceUrl', event.target.value)}
                placeholder="https://…"
              />
            </FormField>

            <FormField id="delivery-tags" label="Tags">
              <TagPicker
                id="delivery-tags"
                value={values.tagIds}
                onChange={(tagIds) => set('tagIds', tagIds)}
              />
            </FormField>

            <FormField id="delivery-notes" label="Notes" error={errors.notes}>
              <Textarea
                id="delivery-notes"
                rows={3}
                value={values.notes}
                onChange={(event) => set('notes', event.target.value)}
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-2 border-t px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {delivery ? 'Save changes' : 'Create delivery'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
