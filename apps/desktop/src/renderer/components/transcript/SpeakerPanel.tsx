import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { MeetingSpeaker, Person } from '../../../shared/types';
import { getSpeakerColor } from './speakerColors';

interface SpeakerPanelProps {
  meetingId: string;
  speakers: MeetingSpeaker[];
  totalDuration: number;
  onRunDiarization: () => void;
  isDiarizing: boolean;
  hasDiarization: boolean;
  /** Filter transcript by speaker — null means show all */
  onFilterSpeaker: (speakerId: string | null) => void;
  activeSpeakerFilter: string | null;
}

export function SpeakerPanel({
  meetingId,
  speakers,
  totalDuration,
  onRunDiarization,
  isDiarizing,
  hasDiarization,
  onFilterSpeaker,
  activeSpeakerFilter,
}: SpeakerPanelProps) {
  const queryClient = useQueryClient();
  const [mergeSelection, setMergeSelection] = useState<string[]>([]);

  const mergeMutation = useMutation({
    mutationFn: ({ keepId, absorbId }: { keepId: string; absorbId: string }) =>
      window.electronAPI.db.mergeSpeakers(meetingId, keepId, absorbId),
    onSuccess: () => {
      setMergeSelection([]);
      queryClient.invalidateQueries({ queryKey: ['speakers', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['segments', meetingId] });
    },
  });

  const handleMerge = () => {
    if (mergeSelection.length !== 2) return;
    mergeMutation.mutate({ keepId: mergeSelection[0], absorbId: mergeSelection[1] });
  };

  const toggleMergeSelect = (id: string) => {
    setMergeSelection((prev) => {
      if (prev.includes(id)) return prev.filter((s) => s !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Speakers
        </h3>
        <span className="text-xs text-slate-500">{speakers.length} detected</span>
      </div>

      {/* Speaker list */}
      <div className="space-y-2">
        {speakers.map((speaker) => (
          <SpeakerCard
            key={speaker.id}
            speaker={speaker}
            meetingId={meetingId}
            totalDuration={totalDuration}
            isSelected={mergeSelection.includes(speaker.id)}
            isFiltered={activeSpeakerFilter === speaker.id}
            onToggleMerge={() => toggleMergeSelect(speaker.id)}
            onFilter={() =>
              onFilterSpeaker(activeSpeakerFilter === speaker.id ? null : speaker.id)
            }
          />
        ))}
      </div>

      {/* Merge button */}
      {mergeSelection.length === 2 && (
        <button
          onClick={handleMerge}
          disabled={mergeMutation.isPending}
          className="rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-medium text-amber-300 hover:bg-amber-950/60 disabled:opacity-50"
        >
          {mergeMutation.isPending ? 'Mesclando...' : 'Mesclar speakers selecionados'}
        </button>
      )}

      {/* Diarization button */}
      <div className="border-t border-dd-border pt-3">
        <button
          onClick={onRunDiarization}
          disabled={isDiarizing}
          className="w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-xs font-medium text-slate-300 hover:bg-dd-surface hover:text-slate-100 disabled:opacity-50"
        >
          {isDiarizing ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-500 border-t-indigo-400" />
              Identificando...
            </span>
          ) : hasDiarization ? (
            'Re-identificar speakers'
          ) : (
            'Identificar speakers'
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Individual speaker card ─────────────────────────────────

function SpeakerCard({
  speaker,
  meetingId,
  totalDuration,
  isSelected,
  isFiltered,
  onToggleMerge,
  onFilter,
}: {
  speaker: MeetingSpeaker;
  meetingId: string;
  totalDuration: number;
  isSelected: boolean;
  isFiltered: boolean;
  onToggleMerge: () => void;
  onFilter: () => void;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [nameValue, setNameValue] = useState(speaker.displayName ?? '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const color = getSpeakerColor(speaker.colorIndex);
  const pct = totalDuration > 0 ? Math.round((speaker.talkTimeSec / totalDuration) * 100) : 0;

  const { data: people = [] } = useQuery({
    queryKey: ['people'],
    queryFn: () => window.electronAPI.db.listPeople(),
    enabled: editing,
  });

  const updateMutation = useMutation({
    mutationFn: (update: { displayName?: string; personId?: string }) =>
      window.electronAPI.db.upsertMeetingSpeaker({
        id: speaker.id,
        meetingId,
        label: speaker.label,
        colorIndex: speaker.colorIndex,
        talkTimeSec: speaker.talkTimeSec,
        ...update,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['speakers', meetingId] });
      setEditing(false);
      setShowSuggestions(false);
    },
  });

  const saveName = async (name: string, person?: Person) => {
    if (person) {
      // Link to existing person
      updateMutation.mutate({ displayName: person.displayName, personId: person.id });
      // Also add as meeting participant
      await window.electronAPI.db.addMeetingPerson({
        meetingId,
        personId: person.id,
        role: 'participant',
        createdAt: new Date().toISOString(),
      });
    } else if (name.trim()) {
      // Create new person and link
      const newPerson = await window.electronAPI.db.upsertPerson({ displayName: name.trim() });
      updateMutation.mutate({ displayName: name.trim(), personId: newPerson.id });
      await window.electronAPI.db.addMeetingPerson({
        meetingId,
        personId: newPerson.id,
        role: 'participant',
        createdAt: new Date().toISOString(),
      });
    }
  };

  const filteredPeople = people.filter((p) =>
    p.displayName.toLowerCase().includes(nameValue.toLowerCase())
  );

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function formatDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    if (m === 0) return `${s}s`;
    return s > 0 ? `${m}m ${s}s` : `${m}m`;
  }

  return (
    <div
      className={`rounded-lg border p-2.5 transition-colors ${
        isSelected
          ? 'border-amber-600 bg-amber-950/20'
          : isFiltered
          ? 'border-indigo-600 bg-indigo-950/20'
          : 'border-dd-border bg-dd-surface'
      }`}
    >
      <div className="flex items-start gap-2">
        {/* Color dot + merge checkbox */}
        <button
          onClick={onToggleMerge}
          className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 transition-colors ${
            isSelected ? 'border-amber-500 bg-amber-500' : `border-current ${color.text}`
          }`}
          title="Selecionar para mesclar"
        />

        <div className="flex-1 min-w-0">
          {/* Speaker label */}
          <p className="text-[10px] text-slate-500 mb-0.5">{speaker.label}</p>

          {/* Display name (editable) */}
          {editing ? (
            <div className="relative">
              <input
                ref={inputRef}
                value={nameValue}
                onChange={(e) => {
                  setNameValue(e.target.value);
                  setShowSuggestions(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveName(nameValue);
                  if (e.key === 'Escape') { setEditing(false); setShowSuggestions(false); }
                }}
                onBlur={() => setTimeout(() => { setEditing(false); setShowSuggestions(false); }, 200)}
                placeholder="Nome do speaker..."
                className="w-full rounded border border-indigo-500 bg-dd-elevated px-1.5 py-0.5 text-sm text-slate-100 outline-none"
              />
              {showSuggestions && filteredPeople.length > 0 && (
                <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-lg border border-dd-border bg-dd-elevated shadow-lg max-h-32 overflow-auto">
                  {filteredPeople.slice(0, 5).map((p) => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => saveName(p.displayName, p)}
                      className="block w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-dd-surface"
                    >
                      {p.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => { setNameValue(speaker.displayName ?? ''); setEditing(true); }}
              className="group flex items-center gap-1 text-left"
            >
              <span className={`text-sm font-medium ${color.text}`}>
                {speaker.displayName || speaker.label}
              </span>
              <svg
                className="h-3 w-3 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                fill="none" viewBox="0 0 24 24" stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          {/* Stats */}
          <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
            <span>{pct}%</span>
            <span>{formatDuration(speaker.talkTimeSec)}</span>
          </div>
        </div>

        {/* Filter button */}
        <button
          onClick={onFilter}
          className={`mt-0.5 rounded p-1 transition-colors ${
            isFiltered ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-slate-300 hover:bg-dd-elevated'
          }`}
          title={isFiltered ? 'Mostrar todos' : 'Filtrar por este speaker'}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
