import type {
  NotionClient,
  NotionDailyReportPayload,
  NotionDeliveryPayload,
  NotionSyncResult,
} from './types'

/**
 * Default client: does no network I/O.
 *
 * It copies the exact markdown that a real integration would post, so the
 * feature is genuinely useful before any Notion credentials exist — paste the
 * clipboard into a Notion page and you have the same result, by hand.
 */
export function createMockNotionClient(): NotionClient {
  const copy = async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      return false
    }
  }

  return {
    kind: 'mock',
    isConfigured: () => true,

    async syncDailyReport(payload: NotionDailyReportPayload): Promise<NotionSyncResult> {
      console.info('[notion:mock] daily report payload', payload)
      const copied = await copy(payload.markdown)
      return {
        ok: true,
        url: null,
        message: copied
          ? 'Notion is in mock mode — the report markdown was copied to your clipboard.'
          : 'Notion is in mock mode — the payload was logged to the console.',
      }
    },

    async syncDelivery(payload: NotionDeliveryPayload): Promise<NotionSyncResult> {
      console.info('[notion:mock] delivery payload', payload)
      const lines = [
        `# ${payload.title}`,
        '',
        `Project: ${payload.project ?? '—'}`,
        `Requested by: ${payload.requester ?? '—'}`,
        `Requested: ${payload.requestedDate}`,
        `Target: ${payload.targetDeliveryDate ?? '—'}`,
        `Delivered: ${payload.actualDeliveryDate ?? '—'}`,
        `Status: ${payload.statusLabel}`,
        '',
        '## Related work log',
        ...payload.relatedTasks.map((task) => `- ${task.date} — ${task.title} (${task.status})`),
      ]
      const copied = await copy(lines.join('\n'))
      return {
        ok: true,
        url: null,
        message: copied
          ? 'Notion is in mock mode — the delivery summary was copied to your clipboard.'
          : 'Notion is in mock mode — the payload was logged to the console.',
      }
    },
  }
}
