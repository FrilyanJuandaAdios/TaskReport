import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { toastError } from './useToast'
import {
  createDelivery,
  deleteDelivery,
  getDelivery,
  getDeliveryWorkLog,
  listDeliveries,
  setDeliveryStatus,
  updateDelivery,
} from '@/services/deliveryService'
import type {
  CreateDeliveryInput,
  Delivery,
  DeliveryFilter,
  DeliveryStatus,
  ID,
} from '@/types/domain'

export function useDeliveries(filter: DeliveryFilter = {}) {
  return useQuery({
    queryKey: queryKeys.deliveries.list(filter),
    queryFn: () => listDeliveries(filter),
  })
}

export function useDelivery(id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.deliveries.detail(id ?? 'none'),
    queryFn: () => getDelivery(id as ID),
    enabled: Boolean(id),
  })
}

export function useDeliveryWorkLog(id: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.deliveries.workLog(id ?? 'none'),
    queryFn: () => getDeliveryWorkLog(id as ID),
    enabled: Boolean(id),
  })
}

function useInvalidateDeliveryViews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.deliveries.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity.all })
  }
}

export function useCreateDelivery() {
  const invalidate = useInvalidateDeliveryViews()
  return useMutation({
    mutationFn: (input: CreateDeliveryInput) => createDelivery(input),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not create the delivery.'),
  })
}

export function useUpdateDelivery() {
  const invalidate = useInvalidateDeliveryViews()
  return useMutation({
    mutationFn: ({ id, patch }: { id: ID; patch: Partial<Delivery> }) => updateDelivery(id, patch),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not save the delivery.'),
  })
}

export function useSetDeliveryStatus() {
  const invalidate = useInvalidateDeliveryViews()
  return useMutation({
    mutationFn: ({ id, status }: { id: ID; status: DeliveryStatus }) =>
      setDeliveryStatus(id, status),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not update the delivery status.'),
  })
}

export function useDeleteDelivery() {
  const invalidate = useInvalidateDeliveryViews()
  return useMutation({
    mutationFn: (id: ID) => deleteDelivery(id),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not delete the delivery.'),
  })
}
