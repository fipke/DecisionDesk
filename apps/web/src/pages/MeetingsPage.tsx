import { useCallback, useMemo, useRef, useState } from 'react';
import { Search, Upload, X } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useMeetings } from '../hooks/useMeetings';
import { MeetingCard } from '../components/MeetingCard';
import { importAudioFile, importTranscriptText } from '../services/api';
import type { Meeting } from '../types';

// ─── Date grouping helpers ────────────────────────────────────────────────────

/** Returns a group label for an ISO date string relative to today. */
function getGroupLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return 'Hoje';
  if (sameDay(date, yesterday)) return 'Ontem';

  return date.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

/** Groups an ordered list of meetings by date label. */
function groupByDate(meetings: Meeting[]): [string, Meeting[]][] {
  const map = new Map<string, Meeting[]>();
  for (const m of meetings) {
    const label = getGroupLabel(m.createdAt);
    const group = map.get(label) ?? [];
    group.push(m);
    map.set(label, group);
  }
  return Array.from(map.entries());
}

// ─── Component ────────────────────────────────────────────────────────────────

/** Main meeting list page with search and date-grouped cards. */
export function MeetingsPage() {
  const { data: meetings, isLoading, isError } = useMeetings();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importTab, setImportTab] = useState<'audio' | 'text'>('audio');
  const [importText, setImportText] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAudioImport = useCallback(async (file: File) => {
    setImporting(true);
    setImportError(null);
    try {
      await importAudioFile(file, importTitle || undefined);
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowImport(false);
      setImportTitle('');
    } catch (err: any) {
      setImportError(err?.message ?? 'Erro ao importar áudio');
    } finally {
      setImporting(false);
    }
  }, [importTitle, queryClient]);

  const handleTextImport = useCallback(async () => {
    if (!importText.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      await importTranscriptText(importText, importTitle || undefined);
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      setShowImport(false);
      setImportText('');
      setImportTitle('');
    } catch (err: any) {
      setImportError(err?.message ?? 'Erro ao importar transcrição');
    } finally {
      setImporting(false);
    }
  }, [importText, importTitle, queryClient]);

  const filtered = useMemo(() => {
    if (!meetings) return [];
    const q = search.toLowerCase().trim();
    if (!q) return meetings;
    return meetings.filter((m) => {
      const title = (m.title ?? 'gravação').toLowerCase();
      return title.includes(q);
    });
  }, [meetings, search]);

  // Sort newest first before grouping
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [filtered],
  );

  const groups = useMemo(() => groupByDate(sorted), [sorted]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-dd-base">
      {/* Import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-lg rounded-2xl border border-dd-border bg-dd-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-100">Importar</h3>
              <button onClick={() => setShowImport(false)} className="text-slate-400 hover:text-slate-200">
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="mb-4 flex gap-1 rounded-lg bg-dd-elevated p-1">
              <button
                onClick={() => setImportTab('audio')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${importTab === 'audio' ? 'bg-dd-surface text-slate-100' : 'text-slate-400'}`}
              >
                Arquivo de áudio
              </button>
              <button
                onClick={() => setImportTab('text')}
                className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${importTab === 'text' ? 'bg-dd-surface text-slate-100' : 'text-slate-400'}`}
              >
                Texto da transcrição
              </button>
            </div>

            {/* Title */}
            <input
              type="text"
              placeholder="Título (opcional)"
              value={importTitle}
              onChange={(e) => setImportTitle(e.target.value)}
              className="mb-3 w-full rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
            />

            {importTab === 'audio' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleAudioImport(file);
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="w-full rounded-lg border-2 border-dashed border-dd-border py-8 text-center text-sm text-slate-400 hover:border-indigo-500 hover:text-indigo-400"
                >
                  {importing ? 'Enviando...' : 'Clique para selecionar arquivo de áudio'}
                </button>
              </div>
            ) : (
              <div>
                <textarea
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder="Cole a transcrição aqui..."
                  rows={8}
                  className="mb-3 w-full resize-none rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
                <button
                  onClick={handleTextImport}
                  disabled={importing || !importText.trim()}
                  className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {importing ? 'Importando...' : 'Importar transcrição'}
                </button>
              </div>
            )}

            {importError && (
              <p className="mt-3 text-sm text-red-400">{importError}</p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-dd-border bg-dd-base sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-slate-100 text-xl font-semibold">Gravações</h1>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 rounded-lg bg-dd-elevated px-3 py-2 text-sm text-slate-300 hover:bg-dd-elevated"
          >
            <Upload size={15} />
            Importar
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar gravação..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-dd-surface border border-dd-border rounded-xl pl-9 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 transition-colors"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {isLoading && (
          <div className="text-slate-500 text-sm text-center py-12">Carregando gravações...</div>
        )}

        {isError && (
          <div className="text-red-400 text-sm text-center py-12">
            Erro ao carregar gravações. Verifique a conexão com o servidor.
          </div>
        )}

        {!isLoading && !isError && groups.length === 0 && (
          <div className="text-slate-500 text-sm text-center py-12">Nenhuma gravação ainda</div>
        )}

        {groups.map(([label, items]) => (
          <section key={label} className="mb-6">
            <h2 className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
              {label}
            </h2>
            <div className="space-y-2">
              {items.map((m) => (
                <MeetingCard key={m.id} meeting={m} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
