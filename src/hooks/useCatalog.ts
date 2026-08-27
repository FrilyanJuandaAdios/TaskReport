import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { toastError } from './useToast'
import {
  createProject,
  createRequester,
  createTag,
  deleteProject,
  deleteRequester,
  deleteTag,
  listProjects,
  listRequesters,
  listTags,
  updateProject,
  updateRequester,
} from '@/services/catalogService'
import type {
  CreateProjectInput,
  CreateRequesterInput,
  ID,
  Project,
  Requester,
} from '@/types/domain'

/** Lookup values change rarely — cached long, invalidated explicitly. */
const CATALOG_STALE_TIME = 5 * 60 * 1000

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.catalog.projects,
    queryFn: listProjects,
    staleTime: CATALOG_STALE_TIME,
  })
}

export function useRequesters() {
  return useQuery({
    queryKey: queryKeys.catalog.requesters,
    queryFn: listRequesters,
    staleTime: CATALOG_STALE_TIME,
  })
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.catalog.tags,
    queryFn: listTags,
    staleTime: CATALOG_STALE_TIME,
  })
}

function useCatalogInvalidation() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['catalog'] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all })
  }
}

export function useCreateProject() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not create the project.'),
  })
}

export function useUpdateProject() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: ({ id, patch }: { id: ID; patch: Partial<Project> }) => updateProject(id, patch),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not update the project.'),
  })
}

export function useDeleteProject() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (id: ID) => deleteProject(id),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not delete the project.'),
  })
}

export function useCreateRequester() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (input: CreateRequesterInput) => createRequester(input),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not create the requester.'),
  })
}

export function useUpdateRequester() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: ({ id, patch }: { id: ID; patch: Partial<Requester> }) =>
      updateRequester(id, patch),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not update the requester.'),
  })
}

export function useDeleteRequester() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (id: ID) => deleteRequester(id),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not delete the requester.'),
  })
}

export function useCreateTag() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (name: string) => createTag(name),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not create the tag.'),
  })
}

export function useDeleteTag() {
  const invalidate = useCatalogInvalidation()
  return useMutation({
    mutationFn: (id: ID) => deleteTag(id),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not delete the tag.'),
  })
}
