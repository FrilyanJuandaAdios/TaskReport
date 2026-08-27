/**
 * Notion proxy — deploy this next to the app and point VITE_NOTION_PROXY_URL at it.
 *
 * Why a proxy at all:
 *  - a Notion integration token is a secret. Anything in a VITE_ variable is
 *    bundled into the JavaScript your browser downloads, so the token would be
 *    public. This function keeps it server-side.
 *  - Notion's API does not send CORS headers, so a browser cannot call it directly.
 *
 * This file is an *example*, not part of the build. Copy it to
 *   Vercel:  api/notion.ts
 *   Netlify: netlify/functions/notion.ts
 * and set NOTION_TOKEN in that platform's environment variables.
 *
 * Contract (matches src/integrations/notion/proxyClient.ts):
 *   POST { type: 'daily_report' | 'delivery', databaseId: string, payload: {...} }
 *   200  { url: string }
 */

const NOTION_API = 'https://api.notion.com/v1/pages'
const NOTION_VERSION = '2022-06-28'

interface DailyReportPayload {
  date: string
  title: string
  completed: string[]
  inProgress: string[]
  issues: string[]
  nextSteps: string[]
  notes: string[]
  summary: {
    planned: number
    completed: number
    inProgress: number
    blocked: number
    unplanned: number
    total: number
  }
  markdown: string
}

interface DeliveryPayload {
  title: string
  project: string | null
  requester: string | null
  requestedDate: string
  targetDeliveryDate: string | null
  actualDeliveryDate: string | null
  statusLabel: string
  figmaUrl: string | null
  referenceUrl: string | null
  notes: string | null
  relatedTasks: Array<{ date: string; title: string; status: string }>
}

/** Notion caps a rich-text block at 2000 characters. */
function paragraph(text: string) {
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: [{ type: 'text', text: { content: text.slice(0, 2000) } }] },
  }
}

function heading(text: string) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [{ type: 'text', text: { content: text } }] },
  }
}

function bullets(items: string[]) {
  return items.length === 0
    ? [paragraph('—')]
    : items.map((item) => ({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: {
          rich_text: [{ type: 'text', text: { content: item.slice(0, 2000) } }],
        },
      }))
}

function dailyReportPage(databaseId: string, payload: DailyReportPayload) {
  return {
    parent: { database_id: databaseId },
    properties: {
      // Property names must exist in your Notion database with these types.
      Name: { title: [{ text: { content: payload.title } }] },
      Date: { date: { start: payload.date } },
      Completed: { number: payload.summary.completed },
      'In Progress': { number: payload.summary.inProgress },
      Blocked: { number: payload.summary.blocked },
      Unplanned: { number: payload.summary.unplanned },
    },
    children: [
      heading('Task Completed'),
      ...bullets(payload.completed),
      heading('On Going / In Progress Work'),
      ...bullets(payload.inProgress),
      heading('Issues / Challenges'),
      ...bullets(payload.issues),
      heading('Next Step'),
      ...bullets(payload.nextSteps),
      heading('Notes'),
      ...bullets(payload.notes),
    ],
  }
}

function deliveryPage(databaseId: string, payload: DeliveryPayload) {
  return {
    parent: { database_id: databaseId },
    properties: {
      Name: { title: [{ text: { content: payload.title } }] },
      Status: { select: { name: payload.statusLabel } },
      Requested: { date: { start: payload.requestedDate } },
      ...(payload.targetDeliveryDate
        ? { Target: { date: { start: payload.targetDeliveryDate } } }
        : {}),
      ...(payload.actualDeliveryDate
        ? { Delivered: { date: { start: payload.actualDeliveryDate } } }
        : {}),
      ...(payload.requester
        ? { Requester: { rich_text: [{ text: { content: payload.requester } }] } }
        : {}),
      ...(payload.project ? { Project: { select: { name: payload.project } } } : {}),
      ...(payload.figmaUrl ? { Figma: { url: payload.figmaUrl } } : {}),
    },
    children: [
      heading('Related work log'),
      ...bullets(
        payload.relatedTasks.map((task) => `${task.date} — ${task.title} (${task.status})`),
      ),
      ...(payload.notes ? [heading('Notes'), paragraph(payload.notes)] : []),
    ],
  }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const token = process.env.NOTION_TOKEN
  if (!token) {
    return new Response(JSON.stringify({ error: 'NOTION_TOKEN is not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = (await request.json()) as {
    type: 'daily_report' | 'delivery'
    databaseId: string
    payload: DailyReportPayload | DeliveryPayload
  }

  if (!body.databaseId) {
    return new Response(JSON.stringify({ error: 'databaseId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const page =
    body.type === 'daily_report'
      ? dailyReportPage(body.databaseId, body.payload as DailyReportPayload)
      : deliveryPage(body.databaseId, body.payload as DeliveryPayload)

  const response = await fetch(NOTION_API, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(page),
  })

  if (!response.ok) {
    return new Response(await response.text(), { status: response.status })
  }

  const created = (await response.json()) as { url?: string }
  return new Response(JSON.stringify({ url: created.url ?? null }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
