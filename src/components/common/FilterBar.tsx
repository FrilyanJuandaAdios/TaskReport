import * as React from 'react'
import { Filter, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { DatePicker } from './DatePicker'
import { cn, pluralize } from '@/lib/utils'
import type { ISODate } from '@/types/domain'

export interface FilterFacetOption {
  value: string
  label: string
}

export interface FilterFacet {
  key: string
  label: string
  options: FilterFacetOption[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export interface DateRangeValue {
  from: ISODate | null
  to: ISODate | null
}

interface FilterBarProps {
  query: string
  onQueryChange: (value: string) => void
  searchPlaceholder?: string
  facets?: FilterFacet[]
  dateRange?: { value: DateRangeValue; onChange: (value: DateRangeValue) => void }
  onReset?: () => void
  className?: string
  children?: React.ReactNode
}

/**
 * One compact filter surface for every list screen.
 *
 * Everything except the free-text box lives behind a single "Filters" popover so
 * the toolbar never becomes a wall of dropdowns; active choices are echoed back
 * as removable chips underneath.
 */
export function FilterBar({
  query,
  onQueryChange,
  searchPlaceholder = 'Search…',
  facets = [],
  dateRange,
  onReset,
  className,
  children,
}: FilterBarProps) {
  const activeCount =
    facets.reduce((total, facet) => total + facet.selected.length, 0) +
    (dateRange?.value.from ? 1 : 0) +
    (dateRange?.value.to ? 1 : 0)

  const toggle = (facet: FilterFacet, value: string) => {
    facet.onChange(
      facet.selected.includes(value)
        ? facet.selected.filter((item) => item !== value)
        : [...facet.selected, value],
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={searchPlaceholder}
            className="pl-8"
            aria-label={searchPlaceholder}
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1.5">
                  {activeCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="max-h-[420px] space-y-4 overflow-y-auto p-4">
              {dateRange && (
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Date range
                  </legend>
                  <div className="grid grid-cols-2 gap-2">
                    <DatePicker
                      value={dateRange.value.from}
                      onChange={(from) => dateRange.onChange({ ...dateRange.value, from })}
                      placeholder="From"
                    />
                    <DatePicker
                      value={dateRange.value.to}
                      onChange={(to) => dateRange.onChange({ ...dateRange.value, to })}
                      placeholder="To"
                    />
                  </div>
                </fieldset>
              )}

              {facets.map((facet, index) => (
                <React.Fragment key={facet.key}>
                  {(index > 0 || dateRange) && <Separator />}
                  <fieldset className="space-y-2">
                    <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {facet.label}
                    </legend>
                    <div className="space-y-1.5">
                      {facet.options.map((option) => {
                        const id = `${facet.key}-${option.value}`
                        return (
                          <div key={option.value} className="flex items-center gap-2">
                            <Checkbox
                              id={id}
                              checked={facet.selected.includes(option.value)}
                              onCheckedChange={() => toggle(facet, option.value)}
                            />
                            <Label htmlFor={id} className="cursor-pointer font-normal">
                              {option.label}
                            </Label>
                          </div>
                        )
                      })}
                      {facet.options.length === 0 && (
                        <p className="text-xs text-muted-foreground">Nothing to filter yet.</p>
                      )}
                    </div>
                  </fieldset>
                </React.Fragment>
              ))}
            </div>
            {onReset && activeCount > 0 && (
              <div className="border-t p-2">
                <Button variant="ghost" size="sm" className="w-full" onClick={onReset}>
                  Clear {pluralize(activeCount, 'filter')}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {children}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {facets.flatMap((facet) =>
            facet.selected.map((value) => {
              const option = facet.options.find((item) => item.value === value)
              return (
                <button
                  key={`${facet.key}-${value}`}
                  type="button"
                  onClick={() => toggle(facet, value)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <span className="text-foreground/70">{facet.label}:</span>
                  {option?.label ?? value}
                  <X className="h-3 w-3" />
                </button>
              )
            }),
          )}
          {dateRange?.value.from && (
            <FilterChip
              label={`From ${dateRange.value.from}`}
              onRemove={() => dateRange.onChange({ ...dateRange.value, from: null })}
            />
          )}
          {dateRange?.value.to && (
            <FilterChip
              label={`To ${dateRange.value.to}`}
              onRemove={() => dateRange.onChange({ ...dateRange.value, to: null })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {label}
      <X className="h-3 w-3" />
    </button>
  )
}
