import { env } from '@/lib/env'
import type {
  NotionClient,
  NotionDailyReportPayload,
  NotionDeliveryPayload,
  NotionSyncResult,
} from './types'

/**
 * Real integration path.
 *
 * The Notion integration token is a *secret*: it must never be bundled into the
 * browser. This client therefore posts to a tiny serverless function you own
 * (Vercel / Netlify / Supabase Edge Function) which holds the token and calls
 * `https://api.notion.com/v1/pages`.
 *
 * Expected contract of that function:
 *   POST { type: 'daily_report' | 'delivery', databaseId: string, payload: … }
 *   200  { url?: string }
 *
 * See README -> "Notion integration" for a ready-to-paste function.
 */
export function createProxyNotionClient(): NotionClient {
  const post = async (
    type: 'daily_report' | 'delivery',
    databaseId: string,
    payload: unknown,
  ): Promise<NotionSyncResult> => {
    if (!env.notionProxyUrl) {
      return { ok: false, url: null, message: 'VITE_NOTION_PROXY_URL is not set.' }
    }

    try {
      const response = await fetch(env.notionProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, databaseId, payload }),
      })

      if (!response.ok) {
        const detail = await response.text()
        return {
          ok: false,
          url: null,
          message: `Notion sync failed (${response.status}): ${detail.slice(0, 200)}`,
        }
      }

      const body = (await response.json()) as { url?: string }
      return { ok: true, url: body.url ?? null, message: 'Sent to Notion.' }
    } catch (error) {
      return {
        ok: false,
        url: null,
        message: error instanceof Error ? error.message : 'Notion sync failed.',
      }
    }
  }

  return {
    kind: 'proxy',
    isConfigured: () => Boolean(env.notionProxyUrl),

    syncDailyReport(payload: NotionDailyReportPayload) {
      return post('daily_report', env.notionReportsDatabaseId, payload)
    },

    syncDelivery(payload: NotionDeliveryPayload) {
      return post('delivery', env.notionDeliveriesDatabaseId, payload)
    },
  }
}
