import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from './queryKeys'
import { toastError } from './useToast'
import {
  createMeeting,
  deleteMeeting,
  getMeetingsForDate,
  listMeetingLogs,
  listMeetings,
  setMeetingStatus,
  updateMeeting,
} from '@/services/meetingService'
import type {
  CreateMeetingInput,
  ID,
  ISODate,
  MeetingStatus,
  UpdateMeetingInput,
} from '@/types/domain'

export function useMeetings() {
  return useQuery({ queryKey: queryKeys.meetings.all, queryFn: listMeetings })
}

export function useMeetingsForDate(date: ISODate) {
  return useQuery({
    queryKey: queryKeys.meetings.byDate(date),
    queryFn: () => getMeetingsForDate(date),
  })
}

export function useMeetingLogs(meetingId: ID | undefined) {
  return useQuery({
    queryKey: queryKeys.meetings.logs(meetingId ?? 'none'),
    queryFn: () => listMeetingLogs(meetingId as ID),
    enabled: Boolean(meetingId),
  })
}

/** A schedule change affects the calendar and every report that renders it. */
function useInvalidateMeetingViews() {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.meetings.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.reports.all })
    void queryClient.invalidateQueries({ queryKey: queryKeys.dashboard })
    void queryClient.invalidateQueries({ queryKey: queryKeys.activity.all })
  }
}

export function useCreateMeeting() {
  const invalidate = useInvalidateMeetingViews()
  return useMutation({
    mutationFn: (input: CreateMeetingInput) => createMeeting(input),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not create the meeting.'),
  })
}

export function useUpdateMeeting() {
  const invalidate = useInvalidateMeetingViews()
  return useMutation({
    mutationFn: ({ id, patch }: { id: ID; patch: UpdateMeetingInput }) => updateMeeting(id, patch),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not save the meeting.'),
  })
}

export function useDeleteMeeting() {
  const invalidate = useInvalidateMeetingViews()
  return useMutation({
    mutationFn: (id: ID) => deleteMeeting(id),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not delete the meeting.'),
  })
}

export function useSetMeetingStatus() {
  const invalidate = useInvalidateMeetingViews()
  return useMutation({
    mutationFn: ({
      meetingId,
      date,
      status,
    }: {
      meetingId: ID
      date: ISODate
      status: MeetingStatus
    }) => setMeetingStatus(meetingId, date, status),
    onSuccess: invalidate,
    onError: (error) => toastError(error, 'Could not update the meeting.'),
  })
}
