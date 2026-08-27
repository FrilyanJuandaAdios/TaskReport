/**
 * Headless integration check of the full stack below React:
 * repository -> services -> report generation, running against a fake IndexedDB.
 *
 * Run with:  npm run smoke:db
 */
import 'fake-indexeddb/auto'
import assert from 'node:assert/strict'
import { initRepository, getRepository } from '../src/repositories'
import { createFixtures } from './fixtures'
import {
  carryOverTasks,
  getTasksForDate,
  quickAddTask,
  setTaskStatus,
} from '../src/services/taskService'
import { createDelivery, getDeliveryWorkLog, updateDelivery } from '../src/services/deliveryService'
import {
  deleteProject,
  deleteRequester,
  updateProject,
  updateRequester,
} from '../src/services/catalogService'
import { getDailyReportView, getDaySummaries, upsertDailyReport } from '../src/services/reportService'
import { globalSearch } from '../src/services/searchService'
import {
  countMeetingsPerDay,
  getMeetingsForDate,
  meetingOccursOn,
  setMeetingStatus,
  updateMeeting,
} from '../src/services/meetingService'
import { buildBackup, restoreBackup } from '../src/services/backupService'
import { addDaysISO, fromISODate, today } from '../src/lib/date'
import { getISODay } from 'date-fns'

async function main() {
  await initRepository()
  const repository = getRepository()

  /* --------------------------- starts out empty ---------------------------- */

  assert.equal(await repository.maintenance.isEmpty(), true, 'a fresh database must be empty')

  const fixtures = await createFixtures()
  assert.equal((await repository.projects.list()).length, 3)
  assert.equal((await repository.requesters.list()).length, 2)

  /* ------------------------------ quick add ------------------------------- */

  const { task } = await quickAddTask('Revise Service Schedule @David #CSM 10:30', today())
  assert.equal(task.title, 'Revise Service Schedule')
  assert.equal(task.projectId, fixtures.projects[0].id, '#CSM must resolve to the existing project')
  assert.equal(task.requesterId, fixtures.requesters[0].id, '@David must resolve to the existing requester')
  assert.equal(task.plannedTime, '10:30')

  const created = await quickAddTask('Task for a brand new person @Nadia #BrandNew', today())
  assert.ok(created.task.requesterId, 'unknown @name should be created')
  assert.ok(created.task.projectId, 'unknown #name should be created')

  /* ------------------------- status + audit stamps ------------------------ */

  const started = await setTaskStatus(task.id, 'in_progress')
  assert.ok(started.startedAt, 'starting a task must stamp startedAt')

  const done = await setTaskStatus(task.id, 'completed')
  assert.ok(done.completedAt, 'completing a task must stamp completedAt')

  const reopened = await setTaskStatus(task.id, 'planned')
  assert.equal(reopened.completedAt, null, 'reopening must clear completedAt')
  assert.ok(reopened.startedAt, 'reopening must keep the original startedAt')

  const activity = await repository.activity.listByEntity('task', task.id)
  assert.ok(activity.length >= 3, 'every status change should be logged')

  /* --------------------------- catalog editing ---------------------------- */

  const renamedProject = await updateProject(fixtures.projects[2].id, {
    name: 'Reddot CRM v2',
    code: 'RC2',
    color: 'violet',
  })
  assert.equal(renamedProject.name, 'Reddot CRM v2')
  assert.equal(renamedProject.code, 'RC2')

  const archived = await updateProject(fixtures.projects[2].id, { status: 'archived' })
  assert.equal(archived.status, 'archived')

  const renamedRequester = await updateRequester(fixtures.requesters[1].id, {
    name: 'Pak Rito S.',
    team: 'Field Operations',
    email: 'rito@example.com',
  })
  assert.equal(renamedRequester.name, 'Pak Rito S.')
  assert.equal(renamedRequester.team, 'Field Operations')

  /* ------------------------------ deliveries ------------------------------ */

  const delivery = await createDelivery({
    title: 'Smoke Test Delivery',
    requestedDate: addDaysISO(today(), -3),
    targetDeliveryDate: addDaysISO(today(), 2),
    projectId: fixtures.projects[0].id,
  })

  await repository.tasks.update(task.id, { deliveryId: delivery.id })
  const workLog = await getDeliveryWorkLog(delivery.id)
  assert.equal(workLog.length, 1, 'the delivery should surface its linked daily task')

  const revised = await updateDelivery(delivery.id, { status: 'revision' })
  assert.equal(revised.revisionCount, 1, 'moving to revision increments the counter')

  const delivered = await updateDelivery(delivery.id, { status: 'delivered' })
  assert.equal(delivered.actualDeliveryDate, today(), 'delivering stamps the actual date')
  assert.ok(delivered.deliveredAt, 'delivering stamps deliveredAt')

  const undelivered = await updateDelivery(delivery.id, { status: 'in_progress' })
  assert.equal(undelivered.actualDeliveryDate, null, 'un-delivering clears the actual date')

  /* -------------------------------- reports ------------------------------- */

  const report = await upsertDailyReport({
    date: today(),
    issues: 'Waiting on the API list',
    nextSteps: 'Continue the prototype',
    notes: 'Two unplanned tasks today',
  })
  assert.ok(report.summary.total > 0, 'the report snapshot must count the day’s tasks')

  const updatedReport = await upsertDailyReport({
    date: today(),
    issues: 'Updated issue',
    nextSteps: '',
    notes: '',
  })
  assert.equal(updatedReport.id, report.id, 'saving again must update, not duplicate')

  const view = await getDailyReportView(today())
  assert.equal(view.report?.issues, 'Updated issue')
  assert.equal(view.tasks.length, view.summary.total)

  const summaries = await getDaySummaries(addDaysISO(today(), -30), today())
  assert.ok(summaries.length >= 4, 'history should cover the fixture days')
  assert.ok(summaries.some((summary) => summary.hasReport), 'reports must be flagged in history')

  /* -------------------------------- meetings ------------------------------- */

  const [standup, designSync] = fixtures.meetings
  const isoWeekday = getISODay(fromISODate(today()))
  const isWeekday = isoWeekday <= 5

  assert.equal(
    meetingOccursOn(standup, today()),
    isWeekday,
    'a weekdays schedule must land on Mon–Fri only',
  )
  assert.equal(
    meetingOccursOn(designSync, today()),
    isoWeekday === 3,
    'a weekly schedule must land only on its listed days',
  )

  const occurrences = await getMeetingsForDate(today())
  assert.equal(
    occurrences.length,
    (isWeekday ? 1 : 0) + (isoWeekday === 3 ? 1 : 0),
    'today should expand exactly the schedules that apply',
  )
  assert.ok(
    occurrences.every((occurrence) => occurrence.status === 'scheduled'),
    'an untouched day records nothing',
  )

  // Marking attended creates the log lazily; marking again updates it in place.
  await setMeetingStatus(standup.id, today(), 'attended')
  await setMeetingStatus(standup.id, today(), 'skipped')
  const standupLogs = (await repository.meetingLogs.listByMeeting(standup.id)).filter(
    (log) => log.date === today(),
  )
  assert.equal(standupLogs.length, 1, 'one log row per meeting per day')
  assert.equal(standupLogs[0].status, 'skipped', 'the log reflects the latest status')

  const paused = await updateMeeting(designSync.id, { isActive: false })
  assert.equal(paused.isActive, false)
  assert.equal(
    meetingOccursOn(paused, today()),
    false,
    'a paused schedule stops producing occurrences',
  )

  const weekCounts = await countMeetingsPerDay(addDaysISO(today(), -6), today())
  assert.ok(weekCounts.size > 0, 'the calendar needs per-day meeting counts')

  // The report view carries the day's meetings — minus the one just paused.
  const meetingView = await getDailyReportView(today())
  assert.equal(
    meetingView.meetings.length,
    occurrences.filter((occurrence) => occurrence.meeting.id !== designSync.id).length,
    'a paused schedule disappears from the daily report view',
  )
  assert.ok(
    meetingView.meetings.every((occurrence) => occurrence.meeting.id !== designSync.id),
    'the paused meeting must not appear',
  )

  /* --------------------------------- search ------------------------------- */

  const byTitle = await globalSearch('Service Schedule')
  assert.ok(byTitle.tasks.length > 0, 'search should find tasks by title')

  const byPerson = await globalSearch('David')
  assert.ok(byPerson.tasks.length > 0, 'search should find tasks by requester name')

  const byProject = await globalSearch('CSM')
  assert.ok(byProject.tasks.length > 0, 'search should find tasks by project')

  /* ------------------------------ carry over ------------------------------ */

  const tomorrow = addDaysISO(today(), 1)
  const carried = await carryOverTasks(today(), tomorrow)
  const tomorrowTasks = await getTasksForDate(tomorrow)
  assert.equal(tomorrowTasks.length, carried, 'carry over should copy every open task')

  /* -------------------- deleting a lookup keeps history -------------------- */

  const tasksBefore = (await repository.tasks.list()).length
  await deleteProject(fixtures.projects[1].id)
  await deleteRequester(fixtures.requesters[0].id)
  const tasksAfter = await repository.tasks.list()
  assert.equal(tasksAfter.length, tasksBefore, 'deleting a lookup must not delete tasks')
  assert.ok(
    tasksAfter.every((item) => item.projectId !== fixtures.projects[1].id),
    'deleted project references must be cleared',
  )
  assert.ok(
    tasksAfter.every((item) => item.requesterId !== fixtures.requesters[0].id),
    'deleted requester references must be cleared',
  )

  /* --------------------------- backup round-trip -------------------------- */

  const backup = await buildBackup()
  const taskCount = backup.data.tasks.length
  assert.equal(backup.data.meetings.length, 2, 'the backup must carry the schedule')
  assert.ok(backup.data.meetingLogs.length >= 1, 'the backup must carry the meeting log')
  const restored = await restoreBackup(JSON.stringify(backup))
  assert.equal(restored.tasks, taskCount, 'restore must reinstate every task')

  const afterRestore = await repository.tasks.list()
  assert.equal(afterRestore.length, taskCount, 'restore must not duplicate rows')
  assert.equal((await repository.meetings.list()).length, 2, 'restore must reinstate meetings')

  console.log(
    `smoke:db all checks passed (${taskCount} tasks, ${backup.data.deliveries.length} deliveries, ${backup.data.reports.length} reports, ${backup.data.meetings.length} meetings)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
