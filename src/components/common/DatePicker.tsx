import * as React from 'react'
import { CalendarIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { formatMediumDate, fromISODate, toISODate } from '@/lib/date'
import { cn } from '@/lib/utils'
import type { ISODate } from '@/types/domain'

interface DatePickerProps {
  value: ISODate | null | undefined
  onChange: (value: ISODate | null) => void
  placeholder?: string
  allowClear?: boolean
  disabled?: boolean
  className?: string
  id?: string
}

/** Single date field. Stores an ISODate string, never a Date object. */
export function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  allowClear = true,
  disabled,
  className,
  id,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'w-full justify-start gap-2 font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 opacity-60" />
          <span className="flex-1 truncate text-left">
            {value ? formatMediumDate(value) : placeholder}
          </span>
          {allowClear && value && (
            <span
              role="button"
              tabIndex={-1}
              aria-label="Clear date"
              onClick={(event) => {
                event.stopPropagation()
                onChange(null)
              }}
              className="rounded-sm p-0.5 opacity-60 hover:bg-accent hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value ? fromISODate(value) : undefined}
          defaultMonth={value ? fromISODate(value) : undefined}
          onSelect={(date) => {
            onChange(date ? toISODate(date) : null)
            setOpen(false)
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}
