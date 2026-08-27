import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageProps {
  children: ReactNode
  className?: string
  /**
   * `default` fills the workspace — the app is a desktop tool and a 700px column
   * floating in the middle of a 1440px screen wastes the room it has.
   * `narrow` is for reading surfaces (a written report, a form).
   */
  width?: 'default' | 'narrow'
}

/**
 * Standard page frame.
 *
 * The shell owns no vertical padding, so a page like Today can run a section
 * edge-to-edge. Everything else wraps in this.
 */
export function Page({ children, className, width = 'default' }: PageProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full animate-fade pb-28 pt-6 md:pb-12 md:pt-8',
        width === 'narrow' ? 'max-w-3xl' : 'max-w-[1180px]',
        className,
      )}
    >
      {children}
    </div>
  )
}
