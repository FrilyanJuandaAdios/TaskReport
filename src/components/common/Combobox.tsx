import * as React from 'react'
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  value: string
  label: string
  /** Secondary line, e.g. a requester's team or a project's code. */
  hint?: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** When provided, the list offers `Create "<query>"` for unknown values. */
  onCreate?: (name: string) => Promise<string | null> | string | null
  createLabel?: string
  allowClear?: boolean
  disabled?: boolean
  className?: string
  id?: string
  'aria-labelledby'?: string
}

/**
 * Searchable single-select with inline create.
 *
 * Used everywhere a reusable lookup value is picked (project, requester,
 * delivery) so the interaction and the keyboard behaviour are identical.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchPlaceholder = 'Search…',
  emptyText = 'No match found.',
  onCreate,
  createLabel = 'Create',
  allowClear = true,
  disabled,
  className,
  id,
  'aria-labelledby': ariaLabelledBy,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [creating, setCreating] = React.useState(false)

  const selected = options.find((option) => option.value === value) ?? null
  const trimmedQuery = query.trim()
  const exactMatch = options.some(
    (option) => option.label.toLowerCase() === trimmedQuery.toLowerCase(),
  )
  const canCreate = Boolean(onCreate) && trimmedQuery.length > 0 && !exactMatch

  const handleCreate = async () => {
    if (!onCreate || creating) return
    setCreating(true)
    try {
      const created = await onCreate(trimmedQuery)
      if (created) onChange(created)
      setOpen(false)
      setQuery('')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-labelledby={ariaLabelledBy}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <span className="flex items-center gap-1">
            {allowClear && selected && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Clear"
                onClick={(event) => {
                  event.stopPropagation()
                  onChange(null)
                }}
                className="rounded-sm p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-0">
        <Command shouldFilter>
          <CommandInput
            placeholder={searchPlaceholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>
              {canCreate ? (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="mx-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <Plus className="h-3.5 w-3.5" />
                  {createLabel} “{trimmedQuery}”
                </button>
              ) : (
                emptyText
              )}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={`${option.label} ${option.hint ?? ''}`}
                  onSelect={() => {
                    onChange(option.value === value ? null : option.value)
                    setOpen(false)
                    setQuery('')
                  }}
                >
                  <Check
                    className={cn(
                      'h-4 w-4',
                      option.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="flex-1 truncate">{option.label}</span>
                  {option.hint && (
                    <span className="text-xs text-muted-foreground">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
              {canCreate && (
                <CommandItem value={`__create__${trimmedQuery}`} onSelect={handleCreate}>
                  <Plus className="h-4 w-4" />
                  <span className="truncate">
                    {createLabel} “{trimmedQuery}”
                  </span>
                </CommandItem>
              )}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
