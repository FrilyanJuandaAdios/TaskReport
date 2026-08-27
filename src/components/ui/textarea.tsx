import * as React from 'react'
import { cn } from '@/lib/utils'

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    className={cn(
      'flex min-h-[80px] w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm transition-all duration-200 ease-fluid placeholder:text-muted-foreground/70 hover:border-foreground/20 focus-visible:border-foreground/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/10 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
      className,
    )}
    ref={ref}
    {...props}
  />
))
Textarea.displayName = 'Textarea'

export { Textarea }
