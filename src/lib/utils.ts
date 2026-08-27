import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Stable id generator. crypto.randomUUID everywhere modern; fallback for old Safari. */
export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `id_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`
}

export function nowISO(): string {
  return new Date().toISOString()
}

/** Case/diacritic-insensitive contains, used by every search surface. */
export function matches(haystack: string | null | undefined, needle: string): boolean {
  if (!needle) return true
  if (!haystack) return false
  return normalize(haystack).includes(normalize(needle))
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values))
}

export function groupBy<T, K extends string>(items: T[], key: (item: T) => K): Record<K, T[]> {
  return items.reduce(
    (acc, item) => {
      const k = key(item)
      ;(acc[k] ??= []).push(item)
      return acc
    },
    {} as Record<K, T[]>,
  )
}

export function sortBy<T>(items: T[], ...comparators: Array<(a: T, b: T) => number>): T[] {
  return [...items].sort((a, b) => {
    for (const compare of comparators) {
      const result = compare(a, b)
      if (result !== 0) return result
    }
    return 0
  })
}

/** Sort helper that always pushes null/undefined to the end regardless of direction. */
export function byNullableString<T>(select: (item: T) => string | null | undefined) {
  return (a: T, b: T) => {
    const av = select(a)
    const bv = select(b)
    if (av === bv) return 0
    if (av == null) return 1
    if (bv == null) return -1
    return av.localeCompare(bv)
  }
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`
}

export function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

/** Turn a free-text list (one item per line, optional bullets) into a clean array. */
export function parseLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
