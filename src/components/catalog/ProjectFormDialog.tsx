import * as React from 'react'
import { Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormField } from '@/components/common/FormField'
import { useCreateProject, useUpdateProject } from '@/hooks/useCatalog'
import { projectSchema, type ProjectValues } from '@/schemas'
import { PROJECT_COLORS, PROJECT_COLOR_CLASSES } from '@/constants/status'
import { cn } from '@/lib/utils'
import type { Project } from '@/types/domain'

interface ProjectFormDialogProps {
  /** `null` opens the dialog in create mode. */
  project: Project | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

function emptyValues(): ProjectValues {
  return { name: '', code: '', description: '', color: PROJECT_COLORS[1], status: 'active' }
}

function toValues(project: Project): ProjectValues {
  return {
    name: project.name,
    code: project.code,
    description: project.description ?? '',
    color: project.color,
    status: project.status,
  }
}

/**
 * Create and edit a project in one dialog.
 *
 * Editing here only touches the project row — every task and delivery that
 * points at it keeps pointing at it, so renaming a project rewrites history
 * consistently instead of orphaning it.
 */
export function ProjectFormDialog({ project, open, onOpenChange }: ProjectFormDialogProps) {
  const [values, setValues] = React.useState<ProjectValues>(emptyValues)
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const pending = createProject.isPending || updateProject.isPending

  React.useEffect(() => {
    if (!open) return
    setValues(project ? toValues(project) : emptyValues())
    setErrors({})
  }, [project, open])

  const set = <K extends keyof ProjectValues>(key: K, value: ProjectValues[K]) =>
    setValues((state) => ({ ...state, [key]: value }))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const result = projectSchema.safeParse(values)

    if (!result.success) {
      setErrors(
        Object.fromEntries(
          result.error.issues.map((issue) => [String(issue.path[0] ?? 'form'), issue.message]),
        ),
      )
      return
    }

    setErrors({})
    const payload = { ...result.data, description: result.data.description || undefined }

    if (project) await updateProject.mutateAsync({ id: project.id, patch: payload })
    else await createProject.mutateAsync(payload)

    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {project
              ? 'Renaming keeps every task and delivery already linked to it.'
              : 'A product or stream you design for.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-[1fr_96px] gap-3">
            <FormField id="project-name" label="Name" error={errors.name} required>
              <Input
                id="project-name"
                autoFocus
                value={values.name}
                onChange={(event) => set('name', event.target.value)}
                placeholder="Reddot CRM"
              />
            </FormField>
            <FormField
              id="project-code"
              label="Code"
              error={errors.code}
              hint={project ? undefined : 'Auto'}
            >
              <Input
                id="project-code"
                value={values.code}
                onChange={(event) => set('code', event.target.value.toUpperCase())}
                placeholder="RC"
                maxLength={12}
              />
            </FormField>
          </div>

          <FormField id="project-color" label="Colour">
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Project colour">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={values.color === color}
                  aria-label={color}
                  onClick={() => set('color', color)}
                  className={cn(
                    'flex h-7 w-7 items-center justify-center rounded-full transition-transform duration-200 ease-fluid hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2',
                    PROJECT_COLOR_CLASSES[color],
                  )}
                >
                  {values.color === color && (
                    <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </FormField>

          <FormField id="project-description" label="Description" error={errors.description}>
            <Textarea
              id="project-description"
              rows={2}
              value={values.description}
              onChange={(event) => set('description', event.target.value)}
              placeholder="Optional"
            />
          </FormField>

          {project && (
            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2.5">
              <div>
                <Label htmlFor="project-active" className="text-sm">
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Archived projects stay in history but leave the pickers.
                </p>
              </div>
              <Switch
                id="project-active"
                checked={values.status === 'active'}
                onCheckedChange={(checked) => set('status', checked ? 'active' : 'archived')}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              {project ? 'Save' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
