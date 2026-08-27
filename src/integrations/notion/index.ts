import { env } from '@/lib/env'
import { createMockNotionClient } from './mockClient'
import { createProxyNotionClient } from './proxyClient'
import type { NotionClient } from './types'

let client: NotionClient | null = null

/** The only place that decides which Notion transport is active. */
export function getNotionClient(): NotionClient {
  if (!client) {
    client = env.notionDriver === 'proxy' ? createProxyNotionClient() : createMockNotionClient()
  }
  return client
}

export type {
  NotionClient,
  NotionDailyReportPayload,
  NotionDeliveryPayload,
  NotionSyncResult,
} from './types'
