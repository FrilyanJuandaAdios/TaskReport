import { getRepository } from '@/repositories'
import { newId, normalize, nowISO } from '@/lib/utils'
import { PROJECT_COLORS } from '@/constants/status'
import type {
  CreateProjectInput,
  CreateRequesterInput,
  ID,
  Project,
  Requester,
  Tag,
} from '@/types/domain'

/**
 * Projects, requesters and tags — the reusable lookup values.
 *
 * All three support "find or create by name" so a combobox can offer
 * `Create "Marketing Team"` without the caller worrying about duplicates.
 */

/* -------------------------------- Projects -------------------------------- */

export function listProjects(): Promise<Project[]> {
  return getRepository().projects.list()
}

/** Derives "CSM" from "CSM", "RC" from "Reddot CRM". Overridable by the user. */
function deriveCode(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length === 1) return words[0].slice(0, 4).toUpperCase()
  return words
    .map((word) => word[0])
    .join('')
    .slice(0, 4)
    .toUpperCase()
}

function nextColor(existing: Project[]): string {
  return PROJECT_COLORS[existing.length % PROJECT_COLORS.length]
}

export async function createProject(input: CreateProjectInput): Promise<Project> {
  const repository = getRepository()
  const existing = await repository.projects.list()
  const timestamp = nowISO()

  const project: Project = {
    id: newId(),
    name: input.name.trim(),
    code: (input.code?.trim() || deriveCode(input.name)).toUpperCase(),
    description: input.description,
    color: input.color ?? nextColor(existing),
    status: input.status ?? 'active',
    createdAt: timestamp,
    updatedAt: timestamp,
  }

  return repository.projects.create(project)
}

export function updateProject(id: ID, patch: Partial<Project>): Promise<Project> {
  return getRepository().projects.update(id, { ...patch, updatedAt: nowISO() })
}

/**
 * Deleting a project must not orphan tasks. Every reference is cleared first so
 * historical tasks keep their title, date and requester.
 */
export async function deleteProject(id: ID): Promise<void> {
  const repository = getRepository()
  const [tasks, deliveries] = await Promise.all([
    repository.tasks.search({ projectIds: [id] }),
    repository.deliveries.search({ projectIds: [id] }),
  ])

  await Promise.all([
    ...tasks.map((task) => repository.tasks.update(task.id, { projectId: null })),
    ...deliveries.map((delivery) => repository.deliveries.update(delivery.id, { projectId: null })),
  ])

  await repository.projects.remove(id)
}

export async function findOrCreateProject(name: string): Promise<Project> {
  const projects = await listProjects()
  const target = normalize(name)
  const match = projects.find(
    (project) => normalize(project.name) === target || normalize(project.code) === target,
  )
  return match ?? createProject({ name })
}

/* ------------------------------- Requesters ------------------------------- */

export function listRequesters(): Promise<Requester[]> {
  return getRepository().requesters.list()
}

export async function createRequester(input: CreateRequesterInput): Promise<Requester> {
  const timestamp = nowISO()
  const requester: Requester = {
    id: newId(),
    name: input.name.trim(),
    team: input.team,
    email: input.email,
    notes: input.notes,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return getRepository().requesters.create(requester)
}

export function updateRequester(id: ID, patch: Partial<Requester>): Promise<Requester> {
  return getRepository().requesters.update(id, { ...patch, updatedAt: nowISO() })
}

export async function deleteRequester(id: ID): Promise<void> {
  const repository = getRepository()
  const requester = await repository.requesters.getById(id)
  if (requester?.isSelf) {
    throw new Error('"Self Initiated" is a built-in requester and cannot be deleted.')
  }

  const [tasks, deliveries] = await Promise.all([
    repository.tasks.search({ requesterIds: [id] }),
    repository.deliveries.search({ requesterIds: [id] }),
  ])

  await Promise.all([
    ...tasks.map((task) => repository.tasks.update(task.id, { requesterId: null })),
    ...deliveries.map((delivery) =>
      repository.deliveries.update(delivery.id, { requesterId: null }),
    ),
  ])

  await repository.requesters.remove(id)
}

export async function findOrCreateRequester(name: string): Promise<Requester> {
  const requesters = await listRequesters()
  const target = normalize(name)
  const match = requesters.find((requester) => normalize(requester.name) === target)
  return match ?? createRequester({ name })
}

/* ---------------------------------- Tags ---------------------------------- */

export function listTags(): Promise<Tag[]> {
  return getRepository().tags.list()
}

export async function createTag(name: string): Promise<Tag> {
  const timestamp = nowISO()
  const tag: Tag = {
    id: newId(),
    name: name.trim().replace(/^#/, ''),
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  return getRepository().tags.create(tag)
}

export async function deleteTag(id: ID): Promise<void> {
  const repository = getRepository()
  const tasks = await repository.tasks.search({ tagIds: [id] })
  await Promise.all(
    tasks.map((task) =>
      repository.tasks.update(task.id, { tagIds: task.tagIds.filter((tagId) => tagId !== id) }),
    ),
  )
  await repository.tags.remove(id)
}

export async function findOrCreateTag(name: string): Promise<Tag> {
  const tags = await listTags()
  const target = normalize(name.replace(/^#/, ''))
  const match = tags.find((tag) => normalize(tag.name) === target)
  return match ?? createTag(name)
}
