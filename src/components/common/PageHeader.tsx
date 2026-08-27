import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: ReactNode
  /** Only pass this when it says something the page itself cannot. */
  description?: ReactNode
  /** Eyebrow text above the title, e.g. a back link or a parent record. */
  eyebrow?: ReactNode
  actions?: ReactNode
  className?: string
}

/**
 * Page title block. One component for every screen, so the hierarchy
 * (eyebrow → title → description → actions) never drifts.
 *
 * No bottom border: whitespace separates the header from the content.
 */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'flex flex-col gap-5 pb-7 sm:flex-row sm:items-start sm:justify-between sm:gap-8',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {eyebrow && <div className="text-xs text-muted-foreground">{eyebrow}</div>}
        <h1 className="break-words text-[28px] font-semibold leading-tight tracking-[-0.035em] sm:text-[34px]">{title}</h1>
        {description && <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-1.5">{actions}</div>}
    </header>
  )
}

interface SectionHeadingProps {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

/** Small label between list groups. Quiet by design — it is a signpost, not a title. */
export function SectionHeading({ title, meta, actions, className }: SectionHeadingProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 px-2 pb-1.5 pt-1', className)}>
      <h2 className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/80">
        {title}
      </h2>
      <div className="flex items-center gap-2">
        {meta && <span className="text-xs text-muted-foreground/70">{meta}</span>}
        {actions}
      </div>
    </div>
  )
}
