import { useQuery } from '@tanstack/react-query';
import { fetchMeeting } from '../services/api';
import type { Meeting } from '../types';

/**
 * Fetches a single meeting by ID.
 * Polls every 10 seconds while the meeting is in PROCESSING state.
 */
export function useMeetingDetail(id: string | undefined) {
  return useQuery<Meeting, Error>({
    queryKey: ['meetings', id],
    queryFn: () => {
      if (!id) throw new Error('Meeting ID is required');
      return fetchMeeting(id);
    },
    enabled: Boolean(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.status === 'PROCESSING') return 10_000;
      return false;
    },
    staleTime: 5_000,
  });
}
