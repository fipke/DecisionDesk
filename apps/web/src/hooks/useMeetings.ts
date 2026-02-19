import { useQuery } from '@tanstack/react-query';
import { fetchMeetings } from '../services/api';
import type { Meeting } from '../types';

/**
 * Fetches the full list of meetings from the backend.
 * Refetches every 15 seconds to pick up status changes (polling-only MVP).
 */
export function useMeetings() {
  return useQuery<Meeting[], Error>({
    queryKey: ['meetings'],
    queryFn: fetchMeetings,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });
}
