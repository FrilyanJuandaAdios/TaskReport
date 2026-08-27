import type { DailyReportSummary, DeliveryStatus, ISODate } from '@/types/domain'

/**
 * Integration boundary for Notion.
 *
 * The app never speaks Notion's wire format. It produces these neutral payloads
 * and hands them to a `NotionClient`. Swapping the mock client for a real one is
 * a one-line change in `createNotionClient()` — no service or component moves.
 */

export interface NotionDailyReportPayload {
  date: ISODate
  title: string
  completed: string[]
  inProgress: string[]
  issues: string[]
  nextSteps: string[]
  notes: string[]
  summary: DailyReportSummary
  markdown: string
}

export interface NotionDeliveryPayload {
  title: string
  project: string | null
  requester: string | null
  requestedDate: ISODate
  targetDeliveryDate: ISODate | null
  actualDeliveryDate: ISODate | null
  status: DeliveryStatus
  statusLabel: string
  figmaUrl: string | null
  referenceUrl: string | null
  notes: string | null
  relatedTasks: Array<{ date: ISODate; title: string; status: string }>
}

export interface NotionSyncResult {
  ok: boolean
  /** Page URL when the provider returned one. */
  url: string | null
  /** Human-readable outcome shown in a toast. */
  message: string
}

export interface NotionClient {
  readonly kind: 'mock' | 'proxy'
  /** False when required configuration is missing; the UI disables the button. */
  isConfigured(): boolean
  syncDailyReport(payload: NotionDailyReportPayload): Promise<NotionSyncResult>
  syncDelivery(payload: NotionDeliveryPayload): Promise<NotionSyncResult>
}
