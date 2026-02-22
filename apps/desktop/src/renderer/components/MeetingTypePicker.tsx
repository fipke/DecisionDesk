import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function MeetingTypePicker({ meetingId, currentTypeId }: { meetingId: string; currentTypeId?: string | null }) {
  const queryClient = useQueryClient();

  const { data: types = [] } = useQuery({
    queryKey: ['meeting-types'],
    queryFn: () => window.electronAPI.db.listMeetingTypes(),
  });

  const mutation = useMutation({
    mutationFn: (meetingTypeId: string) =>
      window.electronAPI.db.upsertMeeting({ id: meetingId, meetingTypeId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  return (
    <select
      value={currentTypeId ?? ''}
      onChange={(e) => mutation.mutate(e.target.value)}
      className="rounded-lg border border-dd-border bg-dd-elevated px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
    >
      <option value="">Sem tipo</option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>{t.name}</option>
      ))}
    </select>
  );
}
