import * as React from 'react'
import {
  Archive,
  ArchiveRestore,
  FolderKanban,
  Mail,
  MoreHorizontal,
  Pencil,
  Plus,
  Tag as TagIcon,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Widget } from '@/components/common/Widget'
import { Page } from '@/components/layout/Page'
import { ProjectFormDialog } from '@/components/catalog/ProjectFormDialog'
import { RequesterFormDialog } from '@/components/catalog/RequesterFormDialog'
import {
  useCreateTag,
  useDeleteProject,
  useDeleteRequester,
  useDeleteTag,
  useProjects,
  useRequesters,
  useTags,
  useUpdateProject,
} from '@/hooks/useCatalog'
import { useTasksInRange } from '@/hooks/useTasks'
import { tagSchema } from '@/schemas'
import { PROJECT_COLOR_CLASSES } from '@/constants/status'
import { addDaysISO, today } from '@/lib/date'
import { cn, pluralize } from '@/lib/utils'
import { toastError } from '@/hooks/useToast'
import type { Project, Requester, TaskWithRelations } from '@/types/domain'

/**
 * The reusable-value manager: projects, requesters and tags.
 *
 * Cards rather than rows, because each of these is a *thing with a shape* — a
 * colour, a code, a workload — not a line in a list. The 90-day counts turn the
 * page from a settings screen into a picture of where the work actually goes.
 *
 * Deleting never destroys history: the service clears the reference on tasks and
 * deliveries so past work keeps its title, date and status.
 */
export function ProjectsPage() {
  // A 90-day window shows which lookups are live without loading the whole
  // archive on a management screen.
  const { data: recentTasks = [] } = useTasksInRange(addDaysISO(today(), -90), today())

  return (
    <Page className="space-y-4">
      <PageHeader title="Projects &amp; people" />

      <Tabs defaultValue="projects">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="requesters">People</TabsTrigger>
          <TabsTrigger value="tags">Tags</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <ProjectsTab recentTasks={recentTasks} />
        </TabsContent>
        <TabsContent value="requesters">
          <RequestersTab recentTasks={recentTasks} />
        </TabsContent>
        <TabsContent value="tags">
          <TagsTab recentTasks={recentTasks} />
        </TabsContent>
      </Tabs>
    </Page>
  )
}

/* --------------------------------- shared --------------------------------- */

function CardMenu({
  label,
  onEdit,
  onDelete,
  deleteLabel,
  extra,
}: {
  label: string
  onEdit: () => void
  onDelete: () => void
  deleteLabel: string
  extra?: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Actions for ${label}`}
        className="rounded-md p-1 text-muted-foreground opacity-0 transition-opacity duration-200 ease-fluid hover:bg-muted hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
      >
        <MoreHorizontal className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={onEdit}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        {extra}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
          <Trash2 className="h-4 w-4" />
          {deleteLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** Shared card shell, so projects, people and tags share one silhouette. */
function CatalogCard({
  onOpen,
  muted,
  children,
  menu,
}: {
  onOpen: () => void
  muted?: boolean
  children: React.ReactNode
  menu: React.ReactNode
}) {
  return (
    <article
      className={cn(
        'group relative rounded-2xl border border-border/70 bg-card p-4 transition-all duration-200 ease-fluid hover:border-foreground/15 hover:bg-muted/30',
        muted && 'opacity-55',
      )}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={onOpen}
          className="min-w-0 flex-1 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {children}
        </button>
        {menu}
      </div>
    </article>
  )
}

function CardStats({ items }: { items: Array<{ label: string; value: number }> }) {
  return (
    <dl className="mt-3 flex gap-5">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-[11px] text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-semibold leading-tight tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}

const CARD_GRID = 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'

/* -------------------------------- projects -------------------------------- */

function ProjectsTab({ recentTasks }: { recentTasks: TaskWithRelations[] }) {
  const { data: projects = [] } = useProjects()
  const updateProject = useUpdateProject()
  const deleteProject = useDeleteProject()

  const [editing, setEditing] = React.useState<Project | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<Project | null>(null)

  const open = (project: Project | null) => {
    setEditing(project)
    setFormOpen(true)
  }

  const active = projects.filter((project) => project.status === 'active')
  const archived = projects.filter((project) => project.status === 'archived')

  const renderCard = (project: Project, muted?: boolean) => {
    const tasks = recentTasks.filter((task) => task.projectId === project.id)

    return (
      <CatalogCard
        key={project.id}
        muted={muted}
        onOpen={() => open(project)}
        menu={
          <CardMenu
            label={project.name}
            onEdit={() => open(project)}
            onDelete={() => setPendingDelete(project)}
            deleteLabel="Delete project"
            extra={
              <DropdownMenuItem
                onSelect={() =>
                  updateProject.mutate({
                    id: project.id,
                    patch: { status: project.status === 'active' ? 'archived' : 'active' },
                  })
                }
              >
                {project.status === 'active' ? (
                  <>
                    <Archive className="h-4 w-4" />
                    Archive
                  </>
                ) : (
                  <>
                    <ArchiveRestore className="h-4 w-4" />
                    Restore
                  </>
                )}
              </DropdownMenuItem>
            }
          />
        }
      >
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'h-2.5 w-2.5 shrink-0 rounded-full',
              PROJECT_COLOR_CLASSES[project.color] ?? 'bg-muted-foreground',
            )}
            aria-hidden
          />
          <span className="break-words text-[15px] font-medium leading-snug">{project.name}</span>
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {project.code}
          </Badge>
        </span>

        {project.description && (
          <span className="mt-1 block break-words text-xs leading-relaxed text-muted-foreground">
            {project.description}
          </span>
        )}

        <CardStats
          items={[
            { label: 'Tasks · 90d', value: tasks.length },
            { label: 'Done', value: tasks.filter((task) => task.status === 'completed').length },
          ]}
        />
      </CatalogCard>
    )
  }

  return (
    <div className="space-y-4">
      <Widget
        title="Projects"
        description={pluralize(active.length, 'active project')}
        icon={FolderKanban}
        action={
          <Button size="sm" onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        }
      >
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Add the products you design for — or type #Name in the quick-add box and it gets created for you."
            action={
              <Button variant="outline" size="sm" onClick={() => open(null)}>
                Add a project
              </Button>
            }
          />
        ) : (
          <div className="space-y-5">
            <div className={CARD_GRID}>{active.map((project) => renderCard(project))}</div>

            {archived.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                  Archived
                </p>
                <div className={CARD_GRID}>
                  {archived.map((project) => renderCard(project, true))}
                </div>
              </div>
            )}
          </div>
        )}
      </Widget>

      <ProjectFormDialog project={editing} open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? 'this project'}?`}
        description="Tasks and deliveries keep their history — they simply lose the project link. Archive instead if you only want it out of the pickers."
        confirmLabel="Delete project"
        destructive
        loading={deleteProject.isPending}
        onConfirm={async () => {
          if (pendingDelete) await deleteProject.mutateAsync(pendingDelete.id)
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

/* ------------------------------- requesters ------------------------------- */

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function RequestersTab({ recentTasks }: { recentTasks: TaskWithRelations[] }) {
  const { data: requesters = [] } = useRequesters()
  const deleteRequester = useDeleteRequester()

  const [editing, setEditing] = React.useState<Requester | null>(null)
  const [formOpen, setFormOpen] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<Requester | null>(null)

  const open = (requester: Requester | null) => {
    setEditing(requester)
    setFormOpen(true)
  }

  return (
    <div className="space-y-4">
      <Widget
        title="People"
        description={pluralize(requesters.length, 'requester')}
        icon={Users}
        action={
          <Button size="sm" onClick={() => open(null)}>
            <Plus className="h-4 w-4" />
            New
          </Button>
        }
      >
        {requesters.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No people yet"
            description="Add whoever asks you for work — or type @Name in the quick-add box and it gets created for you."
            action={
              <Button variant="outline" size="sm" onClick={() => open(null)}>
                Add a requester
              </Button>
            }
          />
        ) : (
          <div className={CARD_GRID}>
            {requesters.map((requester) => {
              const tasks = recentTasks.filter((task) => task.requesterId === requester.id)

              return (
                <CatalogCard
                  key={requester.id}
                  onOpen={() => open(requester)}
                  menu={
                    <CardMenu
                      label={requester.name}
                      onEdit={() => open(requester)}
                      onDelete={() => setPendingDelete(requester)}
                      deleteLabel="Delete requester"
                    />
                  }
                >
                  <span className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground"
                      aria-hidden
                    >
                      {initials(requester.name)}
                    </span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="break-words text-[15px] font-medium leading-snug">{requester.name}</span>
                        {requester.isSelf && (
                          <Badge variant="outline" className="shrink-0 text-[10px]">
                            Built-in
                          </Badge>
                        )}
                      </span>
                      {requester.team && (
                        <span className="block break-words text-xs leading-relaxed text-muted-foreground">
                          {requester.team}
                        </span>
                      )}
                    </span>
                  </span>

                  {requester.email && (
                    <span className="mt-2.5 flex items-start gap-1.5 break-words text-xs leading-relaxed text-muted-foreground">
                      <Mail className="h-3 w-3 shrink-0" aria-hidden />
                      {requester.email}
                    </span>
                  )}

                  <CardStats
                    items={[
                      { label: 'Requests · 90d', value: tasks.length },
                      {
                        label: 'Done',
                        value: tasks.filter((task) => task.status === 'completed').length,
                      },
                    ]}
                  />
                </CatalogCard>
              )
            })}
          </div>
        )}
      </Widget>

      <RequesterFormDialog requester={editing} open={formOpen} onOpenChange={setFormOpen} />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(value) => !value && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? 'this requester'}?`}
        description="Past tasks stay in your history and simply lose the requester link."
        confirmLabel="Delete requester"
        destructive
        loading={deleteRequester.isPending}
        onConfirm={async () => {
          try {
            if (pendingDelete) await deleteRequester.mutateAsync(pendingDelete.id)
          } catch (error) {
            toastError(error)
          }
          setPendingDelete(null)
        }}
      />
    </div>
  )
}

/* ---------------------------------- tags ---------------------------------- */

function TagsTab({ recentTasks }: { recentTasks: TaskWithRelations[] }) {
  const { data: tags = [] } = useTags()
  const createTag = useCreateTag()
  const deleteTag = useDeleteTag()

  const [name, setName] = React.useState('')
  const [error, setError] = React.useState<string>()

  const add = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = tagSchema.safeParse({ name: name.replace(/^#/, '') })

    if (!result.success) {
      setError(result.error.issues[0]?.message)
      return
    }

    setError(undefined)
    await createTag.mutateAsync(result.data.name)
    setName('')
  }

  return (
    <Widget
      title="Tags"
      description={pluralize(tags.length, 'tag')}
      icon={TagIcon}
      action={
        <form onSubmit={add} className="flex items-center gap-1.5">
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Add a tag…"
            aria-label="Tag name"
            aria-invalid={Boolean(error)}
            className="h-8 w-40"
          />
          <Button
            type="submit"
            size="sm"
            aria-label="Add tag"
            disabled={createTag.isPending || name.trim().length === 0}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </form>
      }
    >
      {error && (
        <p role="alert" className="mb-2 text-xs text-destructive">
          {error}
        </p>
      )}

      {tags.length === 0 ? (
        <EmptyState
          icon={TagIcon}
          title="No tags yet"
          description="Optional — use them for the cuts you search on later."
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const count = recentTasks.filter((task) => task.tagIds.includes(tag.id)).length

            return (
              <span
                key={tag.id}
                className="group inline-flex items-center gap-2 rounded-full border border-border/70 py-1 pl-3 pr-2 text-[13px] transition-colors duration-200 ease-fluid hover:border-foreground/20"
              >
                #{tag.name}
                <span className="text-xs tabular-nums text-muted-foreground">{count}</span>
                <button
                  type="button"
                  onClick={() => deleteTag.mutate(tag.id)}
                  aria-label={`Delete tag ${tag.name}`}
                  className="rounded-full text-muted-foreground opacity-0 transition-all duration-200 ease-fluid hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            )
          })}
        </div>
      )}
    </Widget>
  )
}
