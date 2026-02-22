import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function SeriesPicker({ meetingId, currentSeriesId }: { meetingId: string; currentSeriesId: string | null }) {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => window.electronAPI.db.listMeetingSeries(),
  });

  const assignMutation = useMutation({
    mutationFn: async (seriesId: string) => {
      if (currentSeriesId) {
        await window.electronAPI.db.removeSeriesEntry(meetingId, currentSeriesId);
      }
      if (seriesId) {
        const ordinal = await window.electronAPI.db.getNextSeriesOrdinal(seriesId);
        await window.electronAPI.db.addSeriesEntry({ meetingId, seriesId, ordinal });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['series-for-meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const series = await window.electronAPI.db.upsertMeetingSeries({ name });
      if (currentSeriesId) {
        await window.electronAPI.db.removeSeriesEntry(meetingId, currentSeriesId);
      }
      const ordinal = await window.electronAPI.db.getNextSeriesOrdinal(series.id);
      await window.electronAPI.db.addSeriesEntry({ meetingId, seriesId: series.id, ordinal });
      return series;
    },
    onSuccess: () => {
      setCreating(false);
      setNewName('');
      queryClient.invalidateQueries({ queryKey: ['series-for-meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    },
  });

  if (creating) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) createMutation.mutate(newName.trim());
            if (e.key === 'Escape') { setCreating(false); setNewName(''); }
          }}
          placeholder="Nome da série..."
          className="w-32 rounded border border-dd-border bg-dd-elevated px-2 py-0.5 text-xs text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
        />
        <button
          onClick={() => newName.trim() && createMutation.mutate(newName.trim())}
          disabled={!newName.trim() || createMutation.isPending}
          className="rounded bg-indigo-600 px-2 py-0.5 text-[10px] text-white hover:bg-indigo-500 disabled:opacity-50"
        >
          OK
        </button>
        <button
          onClick={() => { setCreating(false); setNewName(''); }}
          className="text-slate-500 hover:text-slate-300"
        >
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <select
      value={currentSeriesId ?? ''}
      onChange={(e) => {
        const val = e.target.value;
        if (val === '__create__') {
          setCreating(true);
        } else {
          assignMutation.mutate(val);
        }
      }}
      className="rounded-lg border border-dd-border bg-dd-elevated px-2.5 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
    >
      <option value="">Sem série</option>
      {seriesList.map((s) => (
        <option key={s.id} value={s.id}>{s.name}</option>
      ))}
      <option value="__create__">+ Criar série...</option>
    </select>
  );
}
