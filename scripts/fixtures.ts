/**
 * Test-only fixtures.
 *
 * The application ships with an empty database — this file exists purely so
 * `smoke:db` has something relational to exercise. It goes through the public
 * service layer rather than writing rows directly, which means the fixtures
 * themselves are part of what gets tested.
 */
import { createProject, createRequester, createTag } from '../src/services/catalogService'
import { createDelivery } from '../src/services/deliveryService'
import { createTask } from '../src/services/taskService'
import { upsertDailyReport } from '../src/services/reportService'
import { createMeeting } from '../src/services/meetingService'
import { addDaysISO, today } from '../src/lib/date'
import type { Delivery, Meeting, Project, Requester, Tag } from '../src/types/domain'

export interface Fixtures {
  projects: Project[]
  requesters: Requester[]
  tags: Tag[]
  deliveries: Delivery[]
  meetings: Meeting[]
  taskCount: number
}

export async function createFixtures(): Promise<Fixtures> {
  const projects = await Promise.all([
    createProject({ name: 'CSM', code: 'CSM' }),
    createProject({ name: 'FSM', code: 'FSM' }),
    createProject({ name: 'Reddot CRM', code: 'RC' }),
  ])

  const requesters = await Promise.all([
    createRequester({ name: 'David', team: 'Product' }),
    createRequester({ name: 'Pak Rito', team: 'Operations' }),
  ])

  const tags = await Promise.all([createTag('hifi'), createTag('review')])

  const deliveries = await Promise.all([
    createDelivery({
      title: 'Service Schedule Revamp',
      requestedDate: addDaysISO(today(), -6),
      targetDeliveryDate: addDaysISO(today(), 2),
      projectId: projects[0].id,
      requesterId: requesters[0].id,
      status: 'in_progress',
    }),
    createDelivery({
      title: 'Work Order Prototype',
      requestedDate: addDaysISO(today(), -8),
      targetDeliveryDate: addDaysISO(today(), -2),
      projectId: projects[1].id,
      requesterId: requesters[1].id,
      status: 'waiting_feedback',
    }),
  ])

  const plan: Array<{
    title: string
    daysAgo: number
    status: 'planned' | 'in_progress' | 'completed' | 'blocked'
    isPlanned?: boolean
    delivery?: number
    project?: number
    requester?: number
  }> = [
    { title: 'Revise Service Schedule UI', daysAgo: 0, status: 'in_progress', delivery: 0, project: 0, requester: 0 },
    { title: 'Review PowerBI feedback', daysAgo: 0, status: 'planned' },
    { title: 'Urgent CRM adjustment', daysAgo: 0, status: 'completed', isPlanned: false, project: 2 },
    { title: 'Hi-fi design pass', daysAgo: 1, status: 'completed', delivery: 0, project: 0, requester: 0 },
    { title: 'Waiting on API field list', daysAgo: 1, status: 'blocked' },
    { title: 'Wireframe week view', daysAgo: 2, status: 'completed', delivery: 0, project: 0 },
    { title: 'Work order interaction states', daysAgo: 3, status: 'completed', delivery: 1, project: 1, requester: 1 },
  ]

  for (const [index, item] of plan.entries()) {
    await createTask({
      title: item.title,
      date: addDaysISO(today(), -item.daysAgo),
      status: item.status,
      isPlanned: item.isPlanned ?? true,
      plannedTime: index % 2 === 0 ? '09:00' : null,
      projectId: item.project === undefined ? null : projects[item.project].id,
      requesterId: item.requester === undefined ? null : requesters[item.requester].id,
      deliveryId: item.delivery === undefined ? null : deliveries[item.delivery].id,
      tagIds: index === 0 ? [tags[0].id] : [],
    })
  }

  const meetings = await Promise.all([
    createMeeting({
      title: 'Daily stand-up',
      time: '09:15',
      durationMinutes: 15,
      recurrence: 'weekdays',
      projectId: projects[0].id,
    }),
    createMeeting({
      title: 'Design sync',
      time: '14:00',
      durationMinutes: 45,
      recurrence: 'weekly',
      weekdays: [3],
      requesterId: requesters[0].id,
    }),
  ])

  await upsertDailyReport({
    date: addDaysISO(today(), -1),
    issues: 'Waiting on the PowerBI metric list',
    nextSteps: 'Continue the schedule hi-fi',
    notes: '',
  })

  return { projects, requesters, tags, deliveries, meetings, taskCount: plan.length }
}
