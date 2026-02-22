import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function FolderPicker({ meetingId, currentFolderId }: { meetingId: string; currentFolderId?: string | null }) {
  const queryClient = useQueryClient();

  const { data: folders = [] } = useQuery({
    queryKey: ['folders'],
    queryFn: () => window.electronAPI.db.listFolders(),
  });

  const mutation = useMutation({
    mutationFn: (folderId: string) =>
      window.electronAPI.db.upsertMeeting({ id: meetingId, folderId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  return (
    <select
      value={currentFolderId ?? ''}
      onChange={(e) => mutation.mutate(e.target.value)}
      className="rounded-lg border border-dd-border bg-dd-elevated px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
    >
      <option value="">Sem pasta</option>
      {folders.map((f) => (
        <option key={f.id} value={f.id}>{f.name}</option>
      ))}
    </select>
  );
}
