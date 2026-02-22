import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ActionItem } from '../../shared/types';

// ─── ActionItemRow ──────────────────────────────────────────

function ActionItemRow({
  item, meetingId, showSource, onToggle, onDelete
}: {
  item: ActionItem;
  meetingId: string;
  showSource?: boolean;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isDone = item.status === 'done';
  const isOverdue = item.dueDate && new Date(item.dueDate) < new Date() && !isDone;

  return (
    <div className={`group flex items-start gap-2.5 rounded-lg px-3 py-2 transition-colors ${isDone ? 'opacity-60' : 'hover:bg-dd-surface/50'}`}>
      <button
        onClick={() => onToggle(item.id)}
        className={`mt-0.5 flex-shrink-0 h-4 w-4 rounded border transition-colors ${
          isDone
            ? 'border-indigo-500 bg-indigo-600 text-white'
            : 'border-slate-600 hover:border-indigo-500'
        }`}
      >
        {isDone && (
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p className={`text-sm text-slate-200 ${isDone ? 'line-through text-slate-500' : ''}`}>
          {item.content}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          {item.assigneeName && (
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] ${
              item.assigneeId
                ? 'border border-indigo-500/20 bg-indigo-500/10 text-indigo-400'
                : 'border border-slate-600 bg-slate-700/50 text-slate-400'
            }`}>
              {item.assigneeName}
            </span>
          )}
          {item.dueDate && (
            <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] ${
              isOverdue
                ? 'border border-red-500/20 bg-red-500/10 text-red-400'
                : 'border border-slate-600 bg-slate-700/50 text-slate-400'
            }`}>
              {new Date(item.dueDate).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {showSource && item.meetingTitle && (
            <span className="text-[10px] text-slate-600">
              · {item.meetingTitle}
              {item.meetingCreatedAt && ` · ${new Date(item.meetingCreatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })}`}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => onDelete(item.id)}
        className="flex-shrink-0 opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all"
        title="Excluir"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── AddItemForm ────────────────────────────────────────────

function AddItemForm({ meetingId, seriesId }: { meetingId: string; seriesId: string | null }) {
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [expanded, setExpanded] = useState(false);

  const mutation = useMutation({
    mutationFn: (text: string) =>
      window.electronAPI.db.upsertActionItem({ meetingId, seriesId, content: text }),
    onSuccess: () => {
      setContent('');
      setExpanded(false);
      queryClient.invalidateQueries({ queryKey: ['action-items', meetingId] });
    },
  });

  if (!expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-slate-500 hover:text-indigo-400 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Adicionar item manualmente
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <input
        autoFocus
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && content.trim()) mutation.mutate(content.trim());
          if (e.key === 'Escape') { setExpanded(false); setContent(''); }
        }}
        placeholder="Descreva a tarefa..."
        className="flex-1 rounded-lg border border-dd-border bg-dd-elevated px-3 py-1.5 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-indigo-500"
      />
      <button
        onClick={() => content.trim() && mutation.mutate(content.trim())}
        disabled={!content.trim() || mutation.isPending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        Adicionar
      </button>
      <button
        onClick={() => { setExpanded(false); setContent(''); }}
        className="text-slate-500 hover:text-slate-300"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

// ─── ActionItemsTab ─────────────────────────────────────────

export function ActionItemsTab({ meetingId, hasTranscript }: { meetingId: string; hasTranscript: boolean }) {
  const queryClient = useQueryClient();
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI.settings.get(),
  });

  const { data: items = [] } = useQuery({
    queryKey: ['action-items', meetingId],
    queryFn: () => window.electronAPI.db.listActionItems(meetingId),
  });

  const { data: seriesId } = useQuery({
    queryKey: ['series-for-meeting', meetingId],
    queryFn: () => window.electronAPI.db.getSeriesIdForMeeting(meetingId),
  });

  const { data: seriesOpenItems = [] } = useQuery({
    queryKey: ['series-open-items', seriesId],
    queryFn: () => window.electronAPI.db.listOpenActionItemsForSeries(seriesId!),
    enabled: !!seriesId,
  });

  // Filter out current meeting's items from series open items
  const previousItems = seriesOpenItems.filter(i => i.meetingId !== meetingId);

  // Group previous items by source meeting
  const previousByMeeting = new Map<string, ActionItem[]>();
  for (const item of previousItems) {
    const key = item.meetingId;
    const group = previousByMeeting.get(key) ?? [];
    group.push(item);
    previousByMeeting.set(key, group);
  }

  // Listen for auto-extraction events
  useEffect(() => {
    window.electronAPI.onActionItemsExtracted((extractedMeetingId) => {
      if (extractedMeetingId === meetingId) {
        queryClient.invalidateQueries({ queryKey: ['action-items', meetingId] });
      }
    });
  }, [meetingId, queryClient]);

  const handleExtract = async () => {
    if (extracting) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const extract = (settings as any)?.preferLocal
        ? window.electronAPI.ollama.extractActionItems(meetingId)
        : window.electronAPI.api.extractActionItems(meetingId);
      await extract;
      queryClient.invalidateQueries({ queryKey: ['action-items', meetingId] });
    } catch (err: any) {
      setExtractError(err?.message ?? 'Erro na extração');
    } finally {
      setExtracting(false);
    }
  };

  const toggleMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI.db.toggleActionItem(id, meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items', meetingId] });
      if (seriesId) queryClient.invalidateQueries({ queryKey: ['series-open-items', seriesId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.electronAPI.db.deleteActionItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-items', meetingId] });
      if (seriesId) queryClient.invalidateQueries({ queryKey: ['series-open-items', seriesId] });
    },
  });

  const openCount = items.filter(i => i.status === 'open').length;
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <div className="space-y-4">
      {/* Extract button */}
      {hasTranscript && (
        <div className="flex items-center gap-3">
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="flex items-center gap-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-600/30 transition-colors disabled:opacity-50"
          >
            {extracting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500/30 border-t-indigo-400" />
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            )}
            {items.length > 0 ? 'Re-extrair Itens de Ação' : 'Extrair Itens de Ação'}
          </button>
          {extractError && (
            <p className="text-xs text-red-400">{extractError}</p>
          )}
        </div>
      )}

      {/* This meeting's items */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Itens desta reunião
          </h4>
          {items.length > 0 && (
            <span className="text-[10px] text-slate-600">
              {openCount} aberto{openCount !== 1 ? 's' : ''}{doneCount > 0 ? ` · ${doneCount} concluído${doneCount !== 1 ? 's' : ''}` : ''}
            </span>
          )}
        </div>

        {items.length === 0 ? (
          <div className="rounded-lg border border-dashed border-dd-border bg-dd-surface/30 px-4 py-6 text-center">
            <p className="text-sm text-slate-500">
              {hasTranscript ? 'Nenhum item de ação extraído ainda' : 'Transcreva a reunião para extrair itens de ação'}
            </p>
            {hasTranscript && (
              <p className="mt-1 text-xs text-slate-600">
                Clique em "Extrair Itens de Ação" ou gere um resumo para extração automática
              </p>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-dd-border bg-dd-surface/30">
            {items.map((item) => (
              <ActionItemRow
                key={item.id}
                item={item}
                meetingId={meetingId}
                onToggle={(id) => toggleMutation.mutate(id)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Previous meetings' open items (series continuity) */}
      {seriesId && previousByMeeting.size > 0 && (
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Pendências de reuniões anteriores ({previousItems.length})
          </h4>
          <div className="space-y-2">
            {Array.from(previousByMeeting.entries()).map(([srcMeetingId, groupItems]) => {
              const firstItem = groupItems[0];
              const label = firstItem.meetingTitle ?? 'Reunião';
              const date = firstItem.meetingCreatedAt
                ? new Date(firstItem.meetingCreatedAt).toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' })
                : '';
              return (
                <div key={srcMeetingId} className="rounded-lg border border-dd-border bg-dd-surface/20">
                  <div className="px-3 py-1.5 border-b border-dd-border">
                    <span className="text-[10px] font-medium text-slate-500">
                      {label} {date && `· ${date}`}
                    </span>
                  </div>
                  {groupItems.map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      meetingId={meetingId}
                      onToggle={(id) => toggleMutation.mutate(id)}
                      onDelete={(id) => deleteMutation.mutate(id)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Manual add */}
      <AddItemForm meetingId={meetingId} seriesId={seriesId ?? null} />
    </div>
  );
}
