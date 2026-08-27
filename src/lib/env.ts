/**
 * Typed, validated access to import.meta.env.
 * Nothing else in the app reads import.meta.env directly.
 */

export type DbDriver = 'local' | 'supabase'
export type NotionDriver = 'mock' | 'proxy'

function readString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback
}

/** Falls back to an empty object outside Vite (Node scripts, tests). */
const raw: Partial<ImportMetaEnv> = import.meta.env ?? {}

const requestedDriver = readString(raw.VITE_DB_DRIVER, 'local')
const supabaseUrl = readString(raw.VITE_SUPABASE_URL)
const supabaseAnonKey = readString(raw.VITE_SUPABASE_ANON_KEY)

/**
 * Supabase is only selected when it is actually configured. A half-configured
 * .env falls back to local storage instead of throwing on first paint.
 */
const dbDriver: DbDriver =
  requestedDriver === 'supabase' && supabaseUrl && supabaseAnonKey ? 'supabase' : 'local'

export const env = {
  dbDriver,
  dbDriverRequested: requestedDriver as DbDriver,
  supabaseUrl,
  supabaseAnonKey,
  notionDriver: (readString(raw.VITE_NOTION_DRIVER, 'mock') === 'proxy'
    ? 'proxy'
    : 'mock') as NotionDriver,
  notionProxyUrl: readString(raw.VITE_NOTION_PROXY_URL),
  notionReportsDatabaseId: readString(raw.VITE_NOTION_REPORTS_DATABASE_ID),
  notionDeliveriesDatabaseId: readString(raw.VITE_NOTION_DELIVERIES_DATABASE_ID),
  isDev: raw.DEV,
} as const

export const DB_DRIVER_MISCONFIGURED =
  requestedDriver === 'supabase' && dbDriver === 'local'
