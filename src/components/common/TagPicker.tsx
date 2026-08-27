import * as React from 'react'
import { Check, Plus, Tag as TagIcon, X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useCreateTag, useTags } from '@/hooks/useCatalog'
import { cn } from '@/lib/utils'

interface TagPickerProps {
  value: string[]
  onChange: (value: string[]) => void
  className?: string
  id?: string
}

/** Multi-select over the reusable tag catalog, with inline create. */
export function TagPicker({ value, onChange, className, id }: TagPickerProps) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()

  const selected = tags.filter((tag) => value.includes(tag.id))
  const trimmed = query.trim().replace(/^#/, '')
  const canCreate =
    trimmed.length > 0 && !tags.some((tag) => tag.name.toLowerCase() === trimmed.toLowerCase())

  const toggle = (tagId: string) => {
    onChange(value.includes(tagId) ? value.filter((id) => id !== tagId) : [...value, tagId])
  }

  const create = async () => {
    const tag = await createTag.mutateAsync(trimmed)
    onChange([...value, tag.id])
    setQuery('')
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button id={id} type="button" variant="outline" className="w-full justify-start gap-2 font-normal">
            <TagIcon className="h-4 w-4 opacity-60" />
            <span className={cn('flex-1 text-left', selected.length === 0 && 'text-muted-foreground')}>
              {selected.length === 0 ? 'No tags' : `${selected.length} selected`}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] min-w-[220px] p-0">
          <Command>
            <CommandInput placeholder="Search or create a tag…" value={query} onValueChange={setQuery} />
            <CommandList>
              <CommandEmpty>
                {canCreate ? (
                  <button
                    type="button"
                    onClick={create}
                    className="mx-auto flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Create “{trimmed}”
                  </button>
                ) : (
                  'No tags yet.'
                )}
              </CommandEmpty>
              <CommandGroup>
                {tags.map((tag) => (
                  <CommandItem key={tag.id} value={tag.name} onSelect={() => toggle(tag.id)}>
                    <Check className={cn('h-4 w-4', value.includes(tag.id) ? 'opacity-100' : 'opacity-0')} />
                    #{tag.name}
                  </CommandItem>
                ))}
                {canCreate && (
                  <CommandItem value={`__create_${trimmed}`} onSelect={create}>
                    <Plus className="h-4 w-4" />
                    Create “{trimmed}”
                  </CommandItem>
                )}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <Badge key={tag.id} variant="secondary" className="gap-1 font-normal">
              #{tag.name}
              <button
                type="button"
                onClick={() => toggle(tag.id)}
                aria-label={`Remove tag ${tag.name}`}
                className="rounded-sm hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}
