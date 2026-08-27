import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The single surface every page is built from.
 *
 * One card recipe — same radius, same border, same header rhythm — used by the
 * dashboard, the day's plan, the delivery table and the settings groups. When
 * every page is made of the same block, the app reads as one product instead of
 * eight screens that happen to share a sidebar.
 */

interface WidgetProps {
  title?: React.ReactNode
  description?: React.ReactNode
  icon?: LucideIcon
  /** Right side of the header: a button, a count, a filter. */
  action?: React.ReactNode
  footer?: React.ReactNode
  /** Turn off for lists and tables that manage their own edge padding. */
  padded?: boolean
  /** Removes the surface, keeping only the header rhythm. */
  bare?: boolean
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

export function Widget({
  title,
  description,
  icon: Icon,
  action,
  footer,
  padded = true,
  bare = false,
  className,
  contentClassName,
  children,
}: WidgetProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col overflow-hidden',
        !bare && 'glass-soft group/widget rounded-[22px] shadow-[0_24px_60px_-48px_hsl(var(--foreground)/0.45)] transition-all duration-500 ease-fluid hover:border-border hover:bg-[hsl(var(--glass)/0.68)]',
        className,
      )}
    >
      {(title || action) && (
        <header
          className={cn(
            'flex flex-col items-stretch gap-3 sm:flex-row sm:items-start sm:justify-between',
            bare ? 'pb-3' : 'px-5 pb-3 pt-4',
          )}
        >
          <div className="min-w-0">
            <h2 className="flex items-start gap-2 text-sm font-semibold leading-snug tracking-tight">
              {Icon && (
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.9} aria-hidden />
              )}
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:shrink-0">{action}</div>}
        </header>
      )}

      <div
        className={cn(
          'min-w-0 flex-1',
          padded ? (bare ? '' : 'px-5 pb-5') : 'pb-1',
          contentClassName,
        )}
      >
        {children}
      </div>

      {footer && (
        <footer className="border-t border-border/60 px-5 py-3 text-sm">{footer}</footer>
      )}
    </section>
  )
}

interface WidgetGridProps {
  /** Column count at the largest breakpoint. Below that it degrades to 1–2. */
  columns?: 2 | 3 | 4
  /**
   * Widgets of different heights should sit at the top of their row; a row of
   * stat tiles should be uniform. Hence the switch.
   */
  align?: 'start' | 'stretch'
  className?: string
  children: React.ReactNode
}

export function WidgetGrid({
  columns = 3,
  align = 'start',
  className,
  children,
}: WidgetGridProps) {
  return (
    <div
      className={cn(
        'grid gap-3 sm:gap-4',
        align === 'start' ? 'items-start' : 'items-stretch',
        columns === 2 && 'sm:grid-cols-2',
        columns === 3 && 'sm:grid-cols-2 lg:grid-cols-3',
        columns === 4 && 'grid-cols-2 lg:grid-cols-4',
        className,
      )}
    >
      {children}
    </div>
  )
}

const TONE_CLASSES = {
  default: 'text-foreground',
  brand: 'text-brand',
  amber: 'text-amber-600 dark:text-amber-400',
  emerald: 'text-emerald-600 dark:text-emerald-400',
  muted: 'text-muted-foreground',
} as const

export type StatTone = keyof typeof TONE_CLASSES

interface StatTileProps {
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  icon?: LucideIcon
  tone?: StatTone
  /** Makes the whole tile a link target. */
  onClick?: () => void
  className?: string
}

/**
 * A single number worth looking at. Colour is carried by the value only — the
 * tile itself stays neutral so a row of them does not turn into a rainbow.
 */
export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  onClick,
  className,
}: StatTileProps) {
  const Element = onClick ? 'button' : 'div'

  return (
    <Element
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'relative flex min-w-0 flex-col gap-1 overflow-hidden border-l border-border/80 bg-transparent px-3 py-3.5 text-left transition-all duration-300 ease-fluid sm:px-4',
        onClick && 'hover:bg-[hsl(var(--glass)/0.42)] active:scale-[0.99]',
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.9} aria-hidden />}
        {label}
      </span>
      <span className={cn('text-[26px] font-semibold leading-none tabular-nums', TONE_CLASSES[tone])}>
        {value}
      </span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
    </Element>
  )
}

/** Divider used between rows inside a widget, edge-to-edge with the card. */
export function WidgetDivider({ className }: { className?: string }) {
  return <div className={cn('h-px bg-border/60', className)} aria-hidden />
}
