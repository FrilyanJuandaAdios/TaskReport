import * as React from 'react'
import { cn } from '@/lib/utils'

interface ReportMarkdownProps {
  markdown: string
  className?: string
}

/**
 * Renderer for the narrow markdown subset the report generator emits
 * (`#`, `###`, `-`, `---`, plain paragraphs).
 *
 * A full markdown library would add a dependency for four node types, and the
 * input is produced by this app rather than pasted from outside, so the grammar
 * is known and closed.
 */
export function ReportMarkdown({ markdown, className }: ReportMarkdownProps) {
  const blocks = React.useMemo(() => parseBlocks(markdown), [markdown])

  return (
    <div className={cn('space-y-3', className)}>
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h1':
            return (
              <h2 key={index} className="text-lg font-semibold tracking-tight">
                {block.text}
              </h2>
            )
          case 'h3':
            return (
              <h3
                key={index}
                className="pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
              >
                {block.text}
              </h3>
            )
          case 'list':
            return (
              <ul key={index} className="space-y-1">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-2 text-sm">
                    <span aria-hidden className="text-muted-foreground">
                      •
                    </span>
                    <span className={cn(item === '—' && 'text-muted-foreground')}>{item}</span>
                  </li>
                ))}
              </ul>
            )
          case 'rule':
            return <hr key={index} className="border-border" />
          default:
            return (
              <p key={index} className="text-sm text-muted-foreground">
                {block.text}
              </p>
            )
        }
      })}
    </div>
  )
}

type Block =
  | { type: 'h1' | 'h3' | 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'rule' }

function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = []
  let list: string[] | null = null

  const flush = () => {
    if (list && list.length > 0) blocks.push({ type: 'list', items: list })
    list = null
  }

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trimEnd()

    if (line.startsWith('- ')) {
      list ??= []
      list.push(line.slice(2))
      continue
    }

    flush()

    if (!line.trim()) continue
    if (line.startsWith('### ')) blocks.push({ type: 'h3', text: line.slice(4) })
    else if (line.startsWith('# ')) blocks.push({ type: 'h1', text: line.slice(2) })
    else if (line.startsWith('---')) blocks.push({ type: 'rule' })
    else blocks.push({ type: 'p', text: line })
  }

  flush()
  return blocks
}
