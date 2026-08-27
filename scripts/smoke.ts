/**
 * Headless sanity check for the pure logic that has no DOM dependency:
 * quick-add parsing, date handling, filter predicates and report rendering.
 *
 * Run with:  npm run smoke
 */
import assert from 'node:assert/strict'
import { parseQuickTask } from '../src/services/quickParse'
import { addDaysISO, parseTimeInput, today, toISODate } from '../src/lib/date'
import { taskMatchesFilter } from '../src/repositories/filters'
import { renderReportMarkdown, summarizeTasks } from '../src/services/reportService'
import type { Project, Requester, Task, TaskWithRelations } from '../src/types/domain'

const project: Project = {
  id: 'p1',
  name: 'CSM',
  code: 'CSM',
  color: 'blue',
  status: 'active',
  createdAt: '',
  updatedAt: '',
}

const requester: Requester = {
  id: 'r1',
  name: 'David',
  team: 'Product',
  createdAt: '',
  updatedAt: '',
}

const catalog = { projects: [project], requesters: [requester] }

/* ------------------------------ quick parse ------------------------------- */

const parsed = parseQuickTask('Revise CSM Calendar @David #CSM tomorrow 09:30 !high', catalog)
assert.equal(parsed.title, 'Revise CSM Calendar')
assert.equal(parsed.requesterId, 'r1')
assert.equal(parsed.projectId, 'p1')
assert.equal(parsed.plannedTime, '09:30')
assert.equal(parsed.targetDate, addDaysISO(today(), 1))
assert.equal(parsed.priority, 'high')

const plain = parseQuickTask('Just a normal task with no syntax', catalog)
assert.equal(plain.title, 'Just a normal task with no syntax')
assert.equal(plain.projectId, undefined)
assert.equal(plain.requesterId, undefined)

const unknown = parseQuickTask('Fix login @Sarah #NewApp', catalog)
assert.equal(unknown.unknownRequesterName, 'Sarah')
assert.equal(unknown.unknownProjectName, 'NewApp')

const quoted = parseQuickTask('Landing page @"Marketing Team"', catalog)
assert.equal(quoted.requesterName, 'Marketing Team')
assert.equal(quoted.title, 'Landing page')

/* --------------------------------- dates ---------------------------------- */

assert.equal(parseTimeInput('9'), '09:00')
assert.equal(parseTimeInput('930'), '09:30')
assert.equal(parseTimeInput('9:5'), '09:05')
assert.equal(parseTimeInput('25:00'), null)
assert.equal(parseTimeInput(''), null)

// The day key must follow local time, not UTC.
const localNoon = new Date()
localNoon.setHours(23, 30, 0, 0)
assert.equal(toISODate(localNoon), today())

/* -------------------------------- filters --------------------------------- */

const task: Task = {
  id: 't1',
  title: 'Service Schedule UI',
  date: '2026-08-14',
  plannedTime: '09:00',
  startTime: null,
  endTime: null,
  status: 'completed',
  targetDate: null,
  isPlanned: true,
  priority: 'normal',
  projectId: 'p1',
  requesterId: 'r1',
  deliveryId: null,
  tagIds: ['tag1'],
  notes: 'waiting on API',
  startedAt: null,
  completedAt: null,
  order: 0,
  createdAt: '',
  updatedAt: '',
}

assert.equal(taskMatchesFilter(task, { query: 'service schedule' }), true)
assert.equal(taskMatchesFilter(task, { query: 'API' }), true)
assert.equal(taskMatchesFilter(task, { statuses: ['blocked'] }), false)
assert.equal(taskMatchesFilter(task, { from: '2026-08-01', to: '2026-08-31' }), true)
assert.equal(taskMatchesFilter(task, { from: '2026-09-01' }), false)
assert.equal(taskMatchesFilter(task, { tagIds: ['tag1'] }), true)
assert.equal(taskMatchesFilter(task, { isPlanned: false }), false)

/* -------------------------------- reports --------------------------------- */

const hydrated: TaskWithRelations = { ...task, project, requester, delivery: null, tags: [] }
const blocked: TaskWithRelations = {
  ...hydrated,
  id: 't2',
  title: 'PowerBI review',
  status: 'blocked',
}
const unplanned: TaskWithRelations = {
  ...hydrated,
  id: 't3',
  title: 'Urgent CRM revision',
  isPlanned: false,
}

const tasks = [hydrated, blocked, unplanned]
const summary = summarizeTasks(tasks)
assert.equal(summary.total, 3)
assert.equal(summary.completed, 2)
assert.equal(summary.blocked, 1)
assert.equal(summary.unplanned, 1)

const markdown = renderReportMarkdown(
  {
    date: '2026-08-14',
    report: null,
    tasks,
    meetings: [],
    summary,
    groups: {
      completed: tasks.filter((item) => item.status === 'completed'),
      inProgress: [],
      blocked: [blocked],
      planned: [],
      cancelled: [],
      unplanned: [unplanned],
    },
  },
  {
    id: 'rep1',
    date: '2026-08-14',
    issues: 'Missing API requirement',
    nextSteps: 'Follow up with engineering',
    notes: 'Urgent CRM task arrived at 14:00',
    summary,
    syncedToNotionAt: null,
    notionPageUrl: null,
    createdAt: '',
    updatedAt: '',
  },
)

assert.ok(markdown.includes('### Task Completed'))
assert.ok(markdown.includes('Service Schedule UI (CSM · req. David)'))
assert.ok(markdown.includes('Blocked: PowerBI review'))
assert.ok(markdown.includes('Missing API requirement'))
assert.ok(markdown.includes('Completed: 2'))

console.log('smoke: all checks passed')
