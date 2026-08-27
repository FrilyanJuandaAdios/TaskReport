import * as React from 'react'
import { Combobox, type ComboboxOption } from './Combobox'
import { useCreateProject, useCreateRequester, useProjects, useRequesters } from '@/hooks/useCatalog'
import { useDeliveries } from '@/hooks/useDeliveries'
import { DELIVERY_STATUS_META } from '@/constants/status'

/**
 * Domain-specific comboboxes.
 *
 * Each one owns its data fetching and its "create new" behaviour so a caller
 * only ever passes `value` and `onChange` — no wiring repeated per form.
 */

interface EntityComboboxProps {
  value: string | null
  onChange: (value: string | null) => void
  disabled?: boolean
  className?: string
  id?: string
}

export function ProjectCombobox({ value, onChange, disabled, className, id }: EntityComboboxProps) {
  const { data: projects = [] } = useProjects()
  const createProject = useCreateProject()

  const options = React.useMemo<ComboboxOption[]>(
    () =>
      projects
        .filter((project) => project.status === 'active' || project.id === value)
        .map((project) => ({ value: project.id, label: project.name, hint: project.code })),
    [projects, value],
  )

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      placeholder="No project"
      searchPlaceholder="Search projects…"
      emptyText="No project found."
      createLabel="Create project"
      onCreate={async (name) => (await createProject.mutateAsync({ name })).id}
    />
  )
}

export function RequesterCombobox({
  value,
  onChange,
  disabled,
  className,
  id,
}: EntityComboboxProps) {
  const { data: requesters = [] } = useRequesters()
  const createRequester = useCreateRequester()

  const options = React.useMemo<ComboboxOption[]>(
    () =>
      requesters.map((requester) => ({
        value: requester.id,
        label: requester.name,
        hint: requester.team,
      })),
    [requesters],
  )

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      placeholder="No requester"
      searchPlaceholder="Search people and teams…"
      emptyText="No requester found."
      createLabel="Add requester"
      onCreate={async (name) => (await createRequester.mutateAsync({ name })).id}
    />
  )
}

export function DeliveryCombobox({ value, onChange, disabled, className, id }: EntityComboboxProps) {
  const { data: deliveries = [] } = useDeliveries()

  const options = React.useMemo<ComboboxOption[]>(
    () =>
      deliveries.map((delivery) => ({
        value: delivery.id,
        label: delivery.title,
        hint: DELIVERY_STATUS_META[delivery.status].label,
      })),
    [deliveries],
  )

  return (
    <Combobox
      id={id}
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      className={className}
      placeholder="Not linked to a delivery"
      searchPlaceholder="Search deliveries…"
      emptyText="No delivery found."
    />
  )
}
