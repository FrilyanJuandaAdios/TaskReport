import { addDays, nextDay, parse as parseDate, type Day } from 'date-fns'
import { normalize } from '@/lib/utils'
import { parseTimeInput, toISODate, today } from '@/lib/date'
import type { HHmm, ISODate, Priority, Project, Requester } from '@/types/domain'

/**
 * Quick-add syntax parser.
 *
 * Intentionally small and rule-based — no NLP, no dependencies beyond date-fns.
 * Everything it extracts is *optional*; a plain sentence with no tokens is a
 * perfectly valid task, which is the whole point of the fast-input principle.
 *
 *   "Revise CSM Calendar @David #CSM tomorrow 09:30 !high"
 *   -> title "Revise CSM Calendar", requester David, project CSM,
 *      targetDate tomorrow, plannedTime 09:30, priority high
 *
 * Unknown @names and #names are still returned so the caller can offer to create
 * them; that decision belongs to the service, not the parser.
 */

export interface ParsedQuickTask {
  title: string
  requesterName?: string
  requesterId?: string
  projectName?: string
  projectId?: string
  tagNames: string[]
  plannedTime?: HHmm
  targetDate?: ISODate
  priority?: Priority
  /** Tokens that matched nothing in the catalog — the UI can offer to create them. */
  unknownRequesterName?: string
  unknownProjectName?: string
}

export interface QuickParseCatalog {
  projects: Project[]
  requesters: Requester[]
}

const PRIORITY_TOKENS: Record<string, Priority> = {
  '!low': 'low',
  '!normal': 'normal',
  '!high': 'high',
  '!urgent': 'urgent',
  '!u': 'urgent',
  '!h': 'high',
}

const WEEKDAYS: Record<string, Day> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
}

const MONTH_NAME =
  '(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)'

/** "aug 28", "28 aug", "2026-08-28". Returns null when the text is not a date. */
function parseDateToken(text: string): ISODate | null {
  const value = text.trim().toLowerCase()

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value

  const monthFirst = value.match(new RegExp(`^${MONTH_NAME}\\s+(\\d{1,2})$`))
  const dayFirst = value.match(new RegExp(`^(\\d{1,2})\\s+${MONTH_NAME}$`))
  const match = monthFirst
    ? { month: monthFirst[1], day: monthFirst[2] }
    : dayFirst
      ? { month: dayFirst[2], day: dayFirst[1] }
      : null

  if (!match) return null

  const reference = new Date()
  const parsed = parseDate(`${match.month} ${match.day} ${reference.getFullYear()}`, 'MMM d yyyy', reference)
  if (Number.isNaN(parsed.getTime())) return null

  // "aug 28" typed in December means next year, not eight months ago.
  const iso = toISODate(parsed)
  if (iso < today()) {
    const nextYear = parseDate(
      `${match.month} ${match.day} ${reference.getFullYear() + 1}`,
      'MMM d yyyy',
      reference,
    )
    return Number.isNaN(nextYear.getTime()) ? iso : toISODate(nextYear)
  }
  return iso
}

function parseRelativeDate(word: string): ISODate | null {
  const value = word.toLowerCase()
  const now = new Date()

  if (value === 'today') return today()
  if (value === 'tomorrow' || value === 'tmr') return toISODate(addDays(now, 1))
  if (value === 'yesterday') return toISODate(addDays(now, -1))

  const weekday = WEEKDAYS[value]
  if (weekday !== undefined) return toISODate(nextDay(now, weekday))

  return null
}

function matchProject(name: string, projects: Project[]): Project | undefined {
  const target = normalize(name)
  return projects.find(
    (project) => normalize(project.code) === target || normalize(project.name) === target,
  )
}

function matchRequester(name: string, requesters: Requester[]): Requester | undefined {
  const target = normalize(name)
  return (
    requesters.find((requester) => normalize(requester.name) === target) ??
    requesters.find((requester) => normalize(requester.name).startsWith(target))
  )
}

export function parseQuickTask(input: string, catalog: QuickParseCatalog): ParsedQuickTask {
  const result: ParsedQuickTask = { title: '', tagNames: [] }
  const titleWords: string[] = []

  // Multi-word values can be quoted: @"Marketing Team", #"Reddot CRM".
  const tokens = input.match(/@"[^"]+"|#"[^"]+"|\S+/g) ?? []

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]
    const bare = token.replace(/^([@#])"(.+)"$/, '$1$2')

    if (bare.startsWith('@') && bare.length > 1) {
      const name = bare.slice(1)
      const requester = matchRequester(name, catalog.requesters)
      if (requester) {
        result.requesterId = requester.id
        result.requesterName = requester.name
      } else {
        result.unknownRequesterName = name
        result.requesterName = name
      }
      continue
    }

    if (bare.startsWith('#') && bare.length > 1) {
      const name = bare.slice(1)
      const project = matchProject(name, catalog.projects)
      if (project && !result.projectId) {
        result.projectId = project.id
        result.projectName = project.name
      } else if (!project && !result.projectId && !result.unknownProjectName) {
        result.unknownProjectName = name
        result.projectName = name
      } else {
        // A second #token is a tag, not a second project.
        result.tagNames.push(name)
      }
      continue
    }

    const priority = PRIORITY_TOKENS[bare.toLowerCase()]
    if (priority) {
      result.priority = priority
      continue
    }

    // "at 09:30" — consume the following token as the time.
    if (bare.toLowerCase() === 'at' && index + 1 < tokens.length) {
      const time = parseTimeInput(tokens[index + 1])
      if (time) {
        result.plannedTime = time
        index += 1
        continue
      }
    }

    if (/^\d{1,2}:\d{2}$/.test(bare)) {
      const time = parseTimeInput(bare)
      if (time) {
        result.plannedTime = time
        continue
      }
    }

    const relative = parseRelativeDate(bare)
    if (relative && !result.targetDate) {
      result.targetDate = relative
      continue
    }

    // Two-word dates: "aug 28" / "28 aug".
    if (index + 1 < tokens.length) {
      const pair = parseDateToken(`${bare} ${tokens[index + 1]}`)
      if (pair && !result.targetDate) {
        result.targetDate = pair
        index += 1
        continue
      }
    }

    const single = parseDateToken(bare)
    if (single && !result.targetDate) {
      result.targetDate = single
      continue
    }

    titleWords.push(token)
  }

  result.title = titleWords.join(' ').replace(/\s+/g, ' ').trim()

  // Never let syntax eat the whole title — fall back to the raw input.
  if (!result.title) result.title = input.trim()

  return result
}

/** Human-readable echo of what the parser found, shown under the quick-add input. */
export function describeParsedTask(parsed: ParsedQuickTask): string[] {
  const parts: string[] = []
  if (parsed.projectName) parts.push(parsed.projectName)
  if (parsed.requesterName) parts.push(`from ${parsed.requesterName}`)
  if (parsed.plannedTime) parts.push(`at ${parsed.plannedTime}`)
  if (parsed.targetDate) parts.push(`due ${parsed.targetDate}`)
  if (parsed.priority && parsed.priority !== 'normal') parts.push(parsed.priority)
  parsed.tagNames.forEach((tag) => parts.push(`#${tag}`))
  return parts
}
