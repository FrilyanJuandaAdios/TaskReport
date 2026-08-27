import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { toast, toastError } from './useToast'
import {
  deleteReport,
  getDailyReportView,
  getDaySummaries,
  upsertDailyReport,
} from '@/services/reportService'
import { sendDailyReportToNotion } from '@/services/notionService'
import type { ID, ISODate, UpsertDailyReportInput } from '@/types/domain'

export function useDailyReportView(date: ISODate) {
  return useQuery({
    queryKey: queryKeys.reports.view(date),
    queryFn: () => getDailyReportView(date),
  })
}

export function useDaySummaries(from: ISODate, to: ISODate) {
  return useQuery({
    queryKey: queryKeys.reports.daySummaries(from, to),
    queryFn: () => getDaySummaries(from, to),
  })
}

export function useSaveDailyReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: UpsertDailyReportInput) => upsertDailyReport(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.activity.all })
    },
    onError: (error) => toastError(error, 'Could not save the report.'),
  })
}

export function useDeleteReport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: ID) => deleteReport(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    },
    onError: (error) => toastError(error, 'Could not delete the report.'),
  })
}

export function useSendReportToNotion() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (date: ISODate) => sendDailyReportToNotion(date),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
      toast({
        title: result.ok ? 'Notion' : 'Notion sync failed',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    },
    onError: (error) => toastError(error, 'Could not reach Notion.'),
  })
}
