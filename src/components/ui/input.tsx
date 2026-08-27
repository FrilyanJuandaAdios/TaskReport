import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        'flex h-11 w-full rounded-xl border border-input bg-background px-3 py-1 text-sm text-foreground shadow-none transition-all duration-200 ease-fluid [color-scheme:light] dark:[color-scheme:dark] file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground/80 hover:border-foreground/20 focus-visible:border-foreground/25 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand/15 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 sm:h-9 sm:rounded-md',
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export { Input }
