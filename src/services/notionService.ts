import { getNotionClient } from '@/integrations/notion'
import type { NotionDailyReportPayload, NotionSyncResult } from '@/integrations/notion'
import {
  getDailyReportView,
  markReportSynced,
  renderReportMarkdown,
} from './reportService'
import { getDelivery, getDeliveryWorkLog } from './deliveryService'
import { parseLines } from '@/lib/utils'
import { formatReportDate } from '@/lib/date'
import { DELIVERY_STATUS_META, TASK_STATUS_META } from '@/constants/status'
import type { ID, ISODate } from '@/types/domain'

/**
 * Application-side of the Notion integration: turns domain records into the
 * neutral payloads defined by the integration layer. Contains no Notion API
 * knowledge whatsoever.
 */

export function isNotionConfigured(): boolean {
  return getNotionClient().isConfigured()
}

export function notionMode(): 'mock' | 'proxy' {
  return getNotionClient().kind
}

export async function buildDailyReportPayload(
  date: ISODate,
): Promise<NotionDailyReportPayload> {
  const view = await getDailyReportView(date)
  const report = view.report

  return {
    date,
    title: `Daily Report — ${formatReportDate(date)}`,
    completed: view.groups.completed.map((task) => task.title),
    inProgress: [...view.groups.inProgress, ...view.groups.planned].map((task) => task.title),
    issues: [
      ...parseLines(report?.issues ?? ''),
      ...view.groups.blocked.map((task) => `Blocked: ${task.title}`),
    ],
    nextSteps: parseLines(report?.nextSteps ?? ''),
    notes: parseLines(report?.notes ?? ''),
    summary: view.summary,
    markdown: renderReportMarkdown(view, report),
  }
}

export async function sendDailyReportToNotion(date: ISODate): Promise<NotionSyncResult> {
  const payload = await buildDailyReportPayload(date)
  const result = await getNotionClient().syncDailyReport(payload)

  if (result.ok) {
    const view = await getDailyReportView(date)
    if (view.report) await markReportSynced(view.report.id, result.url)
  }

  return result
}

export async function sendDeliveryToNotion(deliveryId: ID): Promise<NotionSyncResult> {
  const delivery = await getDelivery(deliveryId)
  if (!delivery) {
    return { ok: false, url: null, message: 'Delivery not found.' }
  }

  const tasks = await getDeliveryWorkLog(deliveryId)

  return getNotionClient().syncDelivery({
    title: delivery.title,
    project: delivery.project?.name ?? null,
    requester: delivery.requester?.name ?? null,
    requestedDate: delivery.requestedDate,
    targetDeliveryDate: delivery.targetDeliveryDate ?? null,
    actualDeliveryDate: delivery.actualDeliveryDate ?? null,
    status: delivery.status,
    statusLabel: DELIVERY_STATUS_META[delivery.status].label,
    figmaUrl: delivery.figmaUrl ?? null,
    referenceUrl: delivery.referenceUrl ?? null,
    notes: delivery.notes ?? null,
    relatedTasks: tasks.map((task) => ({
      date: task.date,
      title: task.title,
      status: TASK_STATUS_META[task.status].label,
    })),
  })
}
