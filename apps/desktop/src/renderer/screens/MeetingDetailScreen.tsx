import { useState, useRef, useCallback, useEffect, Component, type ErrorInfo, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import type { Meeting, MeetingStatus, NoteBlock, NoteBlockType } from '../../shared/types';
import { TranscriptViewer } from '../components/transcript/TranscriptViewer';
import { AudioPlayerControlled } from '../components/transcript/AudioPlayerControlled';
import type { AudioPlayerHandle } from '../components/transcript/AudioPlayerControlled';
import { MeetingChatPanel } from '../components/MeetingChatPanel';
import { FolderPicker } from '../components/FolderPicker';
import { MeetingTypePicker } from '../components/MeetingTypePicker';
import { TagEditor } from '../components/TagEditor';
import { SeriesPicker } from '../components/SeriesPicker';
import { ActionItemsTab } from '../components/ActionItemsTab';

// ─── Error boundary ──────────────────────────────────────────

export class ScreenErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[MeetingDetail] React crash:', error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center max-w-md">
            <p className="text-red-400 font-medium">Erro ao renderizar a tela</p>
            <p className="mt-2 text-xs text-slate-500 font-mono break-all">{this.state.error.message}</p>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 rounded-lg bg-dd-elevated px-4 py-2 text-sm text-slate-100 hover:bg-dd-surface"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function statusBadge(status: MeetingStatus) {
  const configs: Record<MeetingStatus, { label: string; classes: string; pulse?: boolean }> = {
    PENDING_SYNC: { label: 'Pendente',    classes: 'bg-dd-elevated text-slate-300' },
    NEW:          { label: 'Novo',        classes: 'bg-blue-700 text-blue-100' },
    PROCESSING:   { label: 'Processando', classes: 'bg-amber-600 text-amber-100', pulse: true },
    DONE:         { label: 'Concluído',   classes: 'bg-indigo-700 text-indigo-100' },
    ERROR:        { label: 'Erro',        classes: 'bg-red-700 text-red-100' },
  };
  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${cfg.classes}`}>
      {cfg.pulse && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
      {cfg.label}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDurationDetail(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s}s`;
  return s > 0 ? `${m}m ${s}s` : `${m} min`;
}

// ─── Tab: Notas ───────────────────────────────────────────────

const BLOCK_TYPE_CONFIG: Record<NoteBlockType, { label: string; classes: string }> = {
  action_item: { label: 'Ação',      classes: 'bg-indigo-950/60 text-indigo-400 border-indigo-800' },
  decision:    { label: 'Decisão',   classes: 'bg-amber-950/60 text-amber-400 border-amber-800' },
  paragraph:   { label: 'Parágrafo', classes: 'bg-dd-elevated text-slate-400 border-dd-border' },
  heading:     { label: 'Título',    classes: 'bg-dd-elevated text-slate-300 border-dd-border' },
  question:    { label: 'Pergunta',  classes: 'bg-blue-950/60 text-blue-400 border-blue-800' },
  reference:   { label: 'Referência',classes: 'bg-violet-950/60 text-violet-400 border-violet-800' },
};

function NoteBlockItem({ block }: { block: NoteBlock }) {
  const cfg = BLOCK_TYPE_CONFIG[block.blockType];
  return (
    <div className="rounded-lg border border-dd-border bg-dd-surface p-3">
      <div className="mb-1.5 flex items-center gap-2">
        <span className={`rounded border px-1.5 py-0.5 text-xs font-medium ${cfg.classes}`}>
          {cfg.label}
        </span>
        {block.speakerLabel && (
          <span className="text-xs text-slate-500">{block.speakerLabel}</span>
        )}
      </div>
      {block.blockType === 'heading' ? (
        <p className="font-semibold text-slate-100">{block.content}</p>
      ) : (
        <p className="text-sm text-slate-300 leading-relaxed">{block.content}</p>
      )}
    </div>
  );
}

function NotesTab({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();
  const [newContent, setNewContent] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: blocks = [], isLoading } = useQuery({
    queryKey: ['note-blocks', meetingId],
    queryFn: () => window.electronAPI.db.listNoteBlocks(meetingId),
  });

  const addBlockMutation = useMutation({
    mutationFn: (content: string) =>
      window.electronAPI.db.upsertNoteBlock({
        meetingId,
        content,
        blockType: 'paragraph',
        ordinal: blocks.length,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['note-blocks', meetingId] });
      setNewContent('');
    },
  });

  const handleAdd = () => {
    const trimmed = newContent.trim();
    if (!trimmed) return;
    addBlockMutation.mutate(trimmed);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {blocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10">
          <p className="text-slate-400">Nenhuma nota registrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...blocks]
            .sort((a, b) => a.ordinal - b.ordinal)
            .map((block) => (
              <NoteBlockItem key={block.id} block={block} />
            ))}
        </div>
      )}

      {/* Add paragraph */}
      <div className="rounded-xl border border-dd-border bg-dd-surface p-4">
        <p className="mb-2 text-xs font-medium text-slate-400">Adicionar nota</p>
        <textarea
          ref={textareaRef}
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd();
          }}
          placeholder="Escreva uma nota e pressione ⌘Enter para salvar..."
          rows={3}
          className="w-full rounded-lg border border-dd-border bg-dd-elevated p-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
        />
        <div className="mt-2 flex justify-end">
          <button
            onClick={handleAdd}
            disabled={!newContent.trim() || addBlockMutation.isPending}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addBlockMutation.isPending ? 'Salvando...' : 'Salvar nota'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Resumo ──────────────────────────────────────────────

function SummaryTab({ meetingId, hasTranscript }: { meetingId: string; hasTranscript: boolean }) {
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<'local' | 'cloud'>('local');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | undefined>();
  const [selectedSummaryId, setSelectedSummaryId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'rendered' | 'raw'>('rendered');
  const [copied, setCopied] = useState(false);
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const generateRef = useRef<HTMLDivElement>(null);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  // Local summaries from SQLite (always works offline)
  const { data: summaries = [], isLoading: loadingSummaries } = useQuery({
    queryKey: ['summaries', meetingId],
    queryFn: () => window.electronAPI.db.listSummaries(meetingId),
  });

  // Templates from local SQLite (seeded + pulled from backend)
  const { data: templates = [] } = useQuery({
    queryKey: ['local-templates'],
    queryFn: () => window.electronAPI.db.listTemplates(),
  });

  // Ollama availability
  const { data: ollamaAvailable = false } = useQuery({
    queryKey: ['ollama-check'],
    queryFn: () => window.electronAPI.ollama.check(),
    refetchInterval: 30_000,
  });

  // Settings (for aiConfig local model)
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI.settings.get(),
  });

  // Pull summary from backend on mount (best-effort)
  useQuery({
    queryKey: ['pull-summary', meetingId],
    queryFn: () => window.electronAPI.sync.pullSummary(meetingId),
    staleTime: 60_000,
  });

  // Read preferLocal setting to set initial provider
  useEffect(() => {
    if (settings) {
      setProvider((settings as any).preferLocal ? 'local' : 'cloud');
    }
  }, [(settings as any)?.preferLocal]);

  // Auto-select default template
  useState(() => {
    window.electronAPI.db.listTemplates().then(tpls => {
      const def = tpls.find(t => t.isDefault);
      if (def) setSelectedTemplateId(def.id);
    });
  });

  // Auto-select latest summary when summaries load
  useState(() => {
    if (summaries.length > 0 && !selectedSummaryId) {
      const latest = summaries.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
      setSelectedSummaryId(latest.id);
    }
  });

  // Keep selection in sync
  const sortedSummaries = [...summaries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const selectedSummary = summaries.find(s => s.id === selectedSummaryId) ?? null;

  // Reset viewMode when switching summary tabs
  const selectSummary = useCallback((id: string) => {
    setSelectedSummaryId(id);
    setViewMode('rendered');
    setCopied(false);
  }, []);

  // Auto-select latest on new data
  if (summaries.length > 0 && !selectedSummary) {
    const latest = summaries.reduce((a, b) => (a.createdAt > b.createdAt ? a : b));
    setSelectedSummaryId(latest.id);
  }

  // Generate via local Ollama (template)
  const localMutation = useMutation({
    mutationFn: (templateId?: string) =>
      window.electronAPI.ollama.generateSummary(meetingId, templateId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['summaries', meetingId] });
      if (result?.id) setSelectedSummaryId(result.id);
    },
  });

  // Generate via backend (cloud, template)
  const cloudMutation = useMutation({
    mutationFn: (templateId?: string) =>
      window.electronAPI.api.generateSummary(meetingId, templateId),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['summaries', meetingId] });
      if (result?.id) setSelectedSummaryId(result.id);
    },
  });

  // Generate via local Ollama (custom prompt)
  const customLocalMutation = useMutation({
    mutationFn: (prompt: string) =>
      window.electronAPI.ollama.generateSummaryCustom(meetingId, prompt),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['summaries', meetingId] });
      if (result?.id) setSelectedSummaryId(result.id);
    },
  });

  // Generate via backend (cloud, custom prompt)
  const customCloudMutation = useMutation({
    mutationFn: (prompt: string) =>
      window.electronAPI.api.generateSummaryCustom(meetingId, prompt),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['summaries', meetingId] });
      if (result?.id) setSelectedSummaryId(result.id);
    },
  });

  const isPending = localMutation.isPending || cloudMutation.isPending
    || customLocalMutation.isPending || customCloudMutation.isPending;
  const errorMsg = localMutation.error?.message ?? cloudMutation.error?.message
    ?? customLocalMutation.error?.message ?? customCloudMutation.error?.message ?? null;

  const handleGenerate = () => {
    if (useCustomPrompt) {
      if (!customPrompt.trim()) return;
      if (provider === 'local') {
        customLocalMutation.mutate(customPrompt.trim());
      } else {
        customCloudMutation.mutate(customPrompt.trim());
      }
    } else {
      if (provider === 'local') {
        localMutation.mutate(selectedTemplateId);
      } else {
        cloudMutation.mutate(selectedTemplateId);
      }
    }
  };

  if (loadingSummaries) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Generate new summary section ── */}
      <div ref={generateRef} className="rounded-xl border border-dd-border bg-dd-surface p-4 space-y-3">
        <p className="text-xs font-medium text-slate-300">Gerar novo resumo</p>

        {/* Provider toggle */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">Processamento:</span>
          <div className="flex rounded-lg border border-dd-border overflow-hidden">
            <button
              onClick={() => setProvider('local')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                provider === 'local'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
              }`}
            >
              Local (Ollama)
            </button>
            <button
              onClick={() => setProvider('cloud')}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-dd-border ${
                provider === 'cloud'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
              }`}
            >
              Backend (Cloud)
            </button>
          </div>
        </div>

        {/* Ollama warning */}
        {provider === 'local' && !ollamaAvailable && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-200/90">Ollama nao esta rodando.</p>
            <p className="mt-1 text-xs text-slate-400">
              Inicie com: <code className="rounded bg-dd-base px-1.5 py-0.5 text-amber-300 font-mono">ollama serve</code>
            </p>
          </div>
        )}

        {/* No transcript warning */}
        {!hasTranscript && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3">
            <p className="text-sm text-amber-200/90">Transcreva a reuniao primeiro para gerar um resumo.</p>
          </div>
        )}

        {/* Mode toggle: Template vs Custom */}
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400">Modo:</span>
          <div className="flex rounded-lg border border-dd-border overflow-hidden">
            <button
              onClick={() => setUseCustomPrompt(false)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                !useCustomPrompt
                  ? 'bg-indigo-600 text-white'
                  : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
              }`}
            >
              Template
            </button>
            <button
              onClick={() => setUseCustomPrompt(true)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-dd-border ${
                useCustomPrompt
                  ? 'bg-indigo-600 text-white'
                  : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
              }`}
            >
              Prompt livre
            </button>
          </div>
        </div>

        {useCustomPrompt ? (
          /* Custom prompt textarea */
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Escreva seu prompt aqui... A transcrição será injetada automaticamente."
            rows={4}
            className="w-full rounded-lg border border-dd-border bg-dd-elevated p-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none"
          />
        ) : (
          /* Template picker + model display */
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-xs font-medium text-slate-400">Template:</span>
            <select
              value={selectedTemplateId ?? ''}
              onChange={(e) => setSelectedTemplateId(e.target.value || undefined)}
              className="rounded-lg border border-dd-border bg-dd-elevated px-3 py-1.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.isDefault ? ' (padrao)' : ''}
                </option>
              ))}
            </select>

            <span className="text-xs text-slate-500">
              Modelo: {provider === 'local'
                ? (settings?.aiConfig?.summarization?.model ?? 'qwen3:14b')
                : (templates.find(t => t.id === selectedTemplateId)?.model ?? 'gpt-4o')}
            </span>
          </div>
        )}

        {/* Generate button */}
        <button
          onClick={handleGenerate}
          disabled={isPending || !hasTranscript || (provider === 'local' && !ollamaAvailable) || (useCustomPrompt && !customPrompt.trim())}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
              Gerando resumo...
            </span>
          ) : (
            'Gerar Resumo'
          )}
        </button>

        {/* Error */}
        {errorMsg && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-400">
            {errorMsg}
          </div>
        )}
      </div>

      {/* Summary pill tabs */}
      {sortedSummaries.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {sortedSummaries.map((s) => (
            <button
              key={s.id}
              onClick={() => selectSummary(s.id)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors border ${
                selectedSummaryId === s.id
                  ? 'border-indigo-500 bg-indigo-500/15 text-indigo-400'
                  : 'border-dd-border bg-dd-elevated text-slate-400 hover:text-slate-200 hover:border-slate-500'
              }`}
            >
              {s.style}
              <span className="ml-1.5 text-slate-500">
                {new Date(s.createdAt).toLocaleDateString('pt-BR', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Selected summary display */}
      {selectedSummary && (
        <div className="rounded-xl border border-dd-border bg-dd-surface p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className={`rounded-full px-2 py-0.5 font-medium ${
                selectedSummary.provider === 'ollama'
                  ? 'bg-emerald-900/40 text-emerald-400'
                  : 'bg-blue-900/40 text-blue-400'
              }`}>
                {selectedSummary.provider === 'ollama' ? 'Local' : 'Cloud'}
              </span>
              <span>{selectedSummary.model}</span>
              <span>·</span>
              <span>{selectedSummary.style}</span>
            </div>

            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="flex rounded-md border border-dd-border overflow-hidden">
                <button
                  onClick={() => setViewMode('rendered')}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors ${
                    viewMode === 'rendered'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Formatado
                </button>
                <button
                  onClick={() => setViewMode('raw')}
                  className={`px-2 py-1 text-[10px] font-medium transition-colors border-l border-dd-border ${
                    viewMode === 'raw'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Markdown
                </button>
              </div>

              {/* Copy button */}
              <button
                onClick={() => handleCopy(selectedSummary.bodyMarkdown)}
                className="flex items-center gap-1 rounded-md border border-dd-border bg-dd-elevated px-2 py-1 text-[10px] font-medium text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
              >
                {copied ? (
                  <>
                    <svg className="h-3 w-3 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-emerald-400">Copiado!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copiar
                  </>
                )}
              </button>
            </div>
          </div>

          {viewMode === 'rendered' ? (
            <div className="prose prose-invert prose-sm max-w-none text-slate-300 prose-headings:text-slate-100 prose-strong:text-slate-200 prose-li:text-slate-300 prose-a:text-indigo-400">
              <ReactMarkdown>{selectedSummary.bodyMarkdown}</ReactMarkdown>
            </div>
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-xs text-slate-300 leading-relaxed bg-dd-base rounded-lg p-4 border border-dd-border overflow-auto">
              {selectedSummary.bodyMarkdown}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Transcribe button (unified: Whisper local + OpenAI) ──────

function TranscribeButton({ meetingId, recordingUri, hasTranscript, externalOpen, onOpenChange }: {
  meetingId: string;
  recordingUri?: string | null;
  hasTranscript?: boolean;
  externalOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = externalOpen ?? internalOpen;
  const setOpen = (v: boolean) => { setInternalOpen(v); onOpenChange?.(v); };
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['meetings'] });
    queryClient.invalidateQueries({ queryKey: ['segments', meetingId] });
    queryClient.invalidateQueries({ queryKey: ['speakers', meetingId] });
  };

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // OpenAI remote transcription (backend handles it)
  const openaiMutation = useMutation({
    mutationFn: () =>
      window.electronAPI.api.transcribeMeeting(meetingId, { provider: 'remote_openai' }),
    onSuccess: () => {
      setStatusMsg(null);
      setErrorMsg(null);
      setOpen(false);
      invalidate();
    },
    onError: (err) => {
      setStatusMsg(null);
      const msg = (err as Error)?.message ?? 'Erro desconhecido';
      setErrorMsg(`Falha ao transcrever via OpenAI: ${msg}`);
      console.error('[Transcribe OpenAI]', err);
    },
  });

  // Whisper local transcription
  const whisperMutation = useMutation({
    mutationFn: async () => {
      setErrorMsg(null);
      const status = await window.electronAPI.whisper.getStatus();
      if (!status.available) throw new Error('whisper-cli não encontrado no sistema. Instale via: brew install whisper-cpp');

      let audioPath = recordingUri;
      if (!audioPath) {
        setStatusMsg('Baixando áudio do servidor...');
        try {
          audioPath = await window.electronAPI.api.downloadAudio(meetingId);
        } catch (dlErr) {
          throw new Error(`Falha ao baixar áudio: ${(dlErr as Error)?.message ?? 'erro desconhecido'}. Verifique se a gravação tem áudio no servidor.`);
        }
      }

      setStatusMsg('Transcrevendo com Whisper (pode levar alguns minutos)...');
      const settings = await window.electronAPI.settings.get();
      const result = await window.electronAPI.whisper.transcribe(audioPath, {
        model: settings.whisperModel ?? 'large-v3',
        language: 'pt',
        enableDiarization: settings.enableDiarization ?? true,
      });

      if (!result.text || result.text.trim().length === 0) {
        throw new Error('Whisper não conseguiu extrair texto do áudio. O arquivo pode estar vazio ou corrompido.');
      }

      setStatusMsg('Salvando transcrição...');
      await window.electronAPI.db.upsertMeeting({
        id: meetingId,
        transcriptText: result.text,
        language: result.language ?? 'pt',
        status: 'DONE',
      });

      // Persist structured segments + speakers if available
      if (result.segments && result.segments.length > 0) {
        // Clear old segments first
        await window.electronAPI.db.deleteSegments(meetingId);

        // Extract unique speakers and create MeetingSpeaker rows
        const speakerLabels = [...new Set(
          result.segments.map((s: { speaker?: string }) => s.speaker).filter(Boolean) as string[]
        )];
        const speakerMap = new Map<string, string>(); // label → speaker id
        for (let i = 0; i < speakerLabels.length; i++) {
          const speaker = await window.electronAPI.db.upsertMeetingSpeaker({
            meetingId,
            label: speakerLabels[i],
            colorIndex: i % 8,
            talkTimeSec: 0,
          });
          speakerMap.set(speakerLabels[i], speaker.id);
        }

        // Insert segments with speaker references
        const segmentData = result.segments.map((s: { start: number; end: number; text: string; speaker?: string }, i: number) => ({
          meetingId,
          ordinal: i,
          startSec: s.start,
          endSec: s.end,
          text: s.text,
          speakerLabel: s.speaker ?? null,
          speakerId: s.speaker ? (speakerMap.get(s.speaker) ?? null) : null,
        }));
        await window.electronAPI.db.insertSegmentsBatch(meetingId, segmentData);

        // Update talk time stats per speaker
        for (const [label, speakerId] of speakerMap) {
          const talkTime = result.segments
            .filter((s: { speaker?: string }) => s.speaker === label)
            .reduce((sum: number, s: { start: number; end: number }) => sum + (s.end - s.start), 0);
          await window.electronAPI.db.upsertMeetingSpeaker({
            id: speakerId,
            meetingId,
            label,
            colorIndex: speakerLabels.indexOf(label) % 8,
            talkTimeSec: talkTime,
          });
        }
      }

      try { await window.electronAPI.db.triggerSync(); } catch { /* best-effort */ }

      return result;
    },
    onSuccess: () => {
      setStatusMsg(null);
      setErrorMsg(null);
      setOpen(false);
      invalidate();
    },
    onError: (err) => {
      setStatusMsg(null);
      const msg = (err as Error)?.message ?? 'Erro desconhecido';
      setErrorMsg(msg);
      console.error('[Transcribe Whisper]', err);
    },
  });

  const isPending = openaiMutation.isPending || whisperMutation.isPending;

  return (
    <div className="relative">
      <button
        onClick={() => { setErrorMsg(null); setOpen(!open); }}
        disabled={isPending}
        className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
      >
        {isPending ? (
          <span className="flex items-center gap-1.5">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {statusMsg ?? 'Transcrevendo...'}
          </span>
        ) : (
          hasTranscript ? 'Re-transcrever' : 'Transcrever'
        )}
      </button>

      {open && !isPending && (
        <div className="absolute right-0 top-full z-10 mt-1 w-56 rounded-lg border border-dd-border bg-dd-elevated shadow-lg overflow-hidden">
          <button
            onClick={() => { setOpen(false); whisperMutation.mutate(); }}
            className="block w-full px-4 py-2.5 text-left hover:bg-dd-surface"
          >
            <span className="text-xs font-medium text-slate-200">Whisper local</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">whisper.cpp no seu Mac</span>
          </button>
          <div className="border-t border-dd-border" />
          <button
            onClick={() => { setOpen(false); openaiMutation.mutate(); }}
            className="block w-full px-4 py-2.5 text-left hover:bg-dd-surface"
          >
            <span className="text-xs font-medium text-slate-200">OpenAI</span>
            <span className="block text-[10px] text-slate-500 mt-0.5">Whisper API na nuvem</span>
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="absolute right-0 top-full z-10 mt-1 w-72 rounded-lg border border-red-800 bg-red-950/90 p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <svg className="h-4 w-4 flex-shrink-0 text-red-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div className="flex-1">
              <p className="text-xs font-medium text-red-300">Erro na transcrição</p>
              <p className="mt-1 text-xs text-red-400/80">{errorMsg}</p>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-300">
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reset status button ─────────────────────────────────────

function ResetStatusButton({ meetingId }: { meetingId: string }) {
  const queryClient = useQueryClient();

  const resetMutation = useMutation({
    mutationFn: () => window.electronAPI.api.resetMeetingStatus(meetingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', meetingId] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  return (
    <button
      onClick={() => resetMutation.mutate()}
      disabled={resetMutation.isPending}
      className="rounded-md border border-dd-border bg-transparent px-2 py-1 text-xs text-slate-400 hover:text-slate-200 hover:border-slate-500 disabled:opacity-50"
    >
      {resetMutation.isPending ? 'Reiniciando...' : 'Reiniciar status'}
    </button>
  );
}

// ─── MeetingDetailScreen ──────────────────────────────────────

type Tab = 'transcript' | 'notes' | 'summary' | 'action-items';

export function MeetingDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('transcript');
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleValue, setTitleValue] = useState('');
  const audioRef = useRef<AudioPlayerHandle>(null);
  const [transcribeOpen, setTranscribeOpen] = useState(false);

  const { data: meeting, isLoading, error } = useQuery({
    queryKey: ['meeting', id],
    queryFn: async () => {
      // Fetch both local and remote, merge (remote is authoritative)
      const [local, remote] = await Promise.all([
        window.electronAPI.db.getMeeting(id!),
        window.electronAPI.api.fetchMeeting(id!).catch(() => null),
      ]);
      if (!remote && !local) return null;
      if (!remote) return local;
      if (!local) return remote;
      // Merge: remote is authoritative, but preserve local-only data
      // (e.g., transcript from local whisper that hasn't synced to backend yet)
      return {
        ...remote,
        recordingUri: local.recordingUri ?? remote.recordingUri,
        transcriptText: remote.transcriptText || local.transcriptText || null,
        summarySnippet: local.summarySnippet ?? remote.summarySnippet ?? null,
        language: remote.language || local.language || null,
        status: remote.transcriptText ? remote.status : (local.transcriptText ? local.status : remote.status),
      };
    },
    enabled: !!id,
    // Auto-poll every 5s while meeting is processing
    refetchInterval: (query) => {
      const m = query.state.data;
      return m?.status === 'PROCESSING' ? 5000 : false;
    },
  });

  const { data: detailSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI.settings.get(),
  });

  const [generatingSnippet, setGeneratingSnippet] = useState(false);
  const [snippetError, setSnippetError] = useState<string | null>(null);
  const handleGenerateSnippet = async () => {
    if (!id || generatingSnippet || !meeting?.transcriptText) return;
    setGeneratingSnippet(true);
    setSnippetError(null);
    try {
      const transcript = meeting.transcriptText;
      const generate = (detailSettings as any)?.preferLocal
        ? window.electronAPI.ollama.generateSnippet(id, transcript)
        : window.electronAPI.api.generateSnippet(id, transcript);
      await generate;
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    } catch (err: any) {
      const msg = err?.message ?? 'Erro desconhecido';
      console.error('[MeetingDetail] snippet generation failed:', msg);
      setSnippetError(msg);
    } finally {
      setGeneratingSnippet(false);
    }
  };

  const { data: seriesId } = useQuery({
    queryKey: ['series-for-meeting', id],
    queryFn: () => window.electronAPI.db.getSeriesIdForMeeting(id!),
    enabled: !!id,
  });

  const upsertMutation = useMutation({
    mutationFn: (title: string) =>
      window.electronAPI.db.upsertMeeting({ id: id!, title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    },
  });

  const handleTitleBlur = () => {
    setEditingTitle(false);
    const trimmed = titleValue.trim();
    if (trimmed && trimmed !== (meeting?.title ?? '')) {
      upsertMutation.mutate(trimmed);
    }
  };

  const startEditTitle = () => {
    setTitleValue(meeting?.title ?? '');
    setEditingTitle(true);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
      </div>
    );
  }

  if (error || !meeting) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Gravação não encontrada</p>
          <button
            onClick={() => navigate('/meetings')}
            className="mt-4 rounded-lg bg-dd-elevated px-4 py-2 text-sm hover:bg-dd-elevated text-slate-100"
          >
            Voltar
          </button>
        </div>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'transcript', label: 'Transcrição' },
    { key: 'notes',      label: 'Notas' },
    { key: 'summary',       label: 'Resumo' },
    { key: 'action-items',  label: 'Ações' },
  ];

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="border-b border-dd-border bg-dd-base px-6 py-4">
        {/* Back link */}
        <button
          onClick={() => navigate('/meetings')}
          className="mb-3 flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Gravações
        </button>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* Editable title */}
            {editingTitle ? (
              <input
                autoFocus
                value={titleValue}
                onChange={(e) => setTitleValue(e.target.value)}
                onBlur={handleTitleBlur}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                  if (e.key === 'Escape') { setEditingTitle(false); }
                }}
                className="w-full rounded-md border border-indigo-500 bg-dd-elevated px-2 py-1 text-xl font-bold text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
              />
            ) : (
              <button
                onClick={startEditTitle}
                className="group flex items-center gap-2 text-left"
                title="Clique para editar"
              >
                <h2 className="text-xl font-bold text-slate-100">
                  {meeting.title ?? 'Gravação'}
                </h2>
                <svg
                  className="h-4 w-4 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
              </button>
            )}

            <p className="mt-1 text-sm text-slate-500">
              {formatDate(meeting.createdAt)}
              {meeting.durationSec != null && meeting.durationSec > 0 && (
                <span> · {formatDurationDetail(meeting.durationSec)}</span>
              )}
              {meeting.durationSec == null && meeting.minutes != null && meeting.minutes > 0 && (
                <span> · {meeting.minutes} min</span>
              )}
            </p>

            {/* Summary snippet with regenerate */}
            <div className="mt-1.5 flex items-center gap-2">
              {meeting.summarySnippet ? (
                <p className="text-xs text-slate-400 italic line-clamp-1">{meeting.summarySnippet}</p>
              ) : meeting.transcriptText ? (
                <p className="text-xs text-slate-500 italic">Sem resumo curto</p>
              ) : null}
              {meeting.transcriptText && (
                <button
                  onClick={handleGenerateSnippet}
                  disabled={generatingSnippet}
                  title={meeting.summarySnippet ? 'Regenerar resumo curto' : 'Gerar resumo curto'}
                  className="flex-shrink-0 rounded p-0.5 text-slate-500 hover:text-indigo-400 transition-colors disabled:opacity-50"
                >
                  {generatingSnippet ? (
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border border-slate-600 border-t-indigo-400" />
                  ) : (
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  )}
                </button>
              )}
              {snippetError && (
                <p className="text-[10px] text-red-400">{snippetError}</p>
              )}
            </div>

            {/* Metadata row: folder, type, tags */}
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Pasta:</span>
                <FolderPicker meetingId={meeting.id} currentFolderId={meeting.folderId} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Tipo:</span>
                <MeetingTypePicker meetingId={meeting.id} currentTypeId={meeting.meetingTypeId} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Tags:</span>
                <TagEditor meetingId={meeting.id} tags={meeting.tags ?? {}} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-500">Série:</span>
                <SeriesPicker meetingId={meeting.id} currentSeriesId={seriesId ?? null} />
              </div>
            </div>
          </div>

          <div className="flex flex-shrink-0 items-center gap-3">
            {statusBadge(meeting.status)}

            {(meeting.status === 'PROCESSING' || meeting.status === 'ERROR') && (
              <ResetStatusButton meetingId={meeting.id} />
            )}

            {meeting.status !== 'PROCESSING' && (
              <TranscribeButton meetingId={meeting.id} recordingUri={meeting.recordingUri} hasTranscript={!!meeting.transcriptText} externalOpen={transcribeOpen} onOpenChange={setTranscribeOpen} />
            )}
          </div>
        </div>

        {/* Processing banner */}
        {meeting.status === 'PROCESSING' && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-amber-800/50 bg-amber-950/40 px-4 py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-amber-600/30 border-t-amber-400" />
            <div>
              <p className="text-sm font-medium text-amber-200">Transcrição em andamento</p>
              <p className="text-xs text-amber-400/70">A página atualizará automaticamente quando concluir.</p>
            </div>
          </div>
        )}

        {/* Error banner */}
        {meeting.status === 'ERROR' && (
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-red-800/50 bg-red-950/40 px-4 py-3">
            <svg className="h-5 w-5 flex-shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-red-200">Erro na transcrição</p>
              <p className="text-xs text-red-400/70">Use "Reiniciar status" para tentar novamente.</p>
            </div>
          </div>
        )}

        {/* Audio player */}
        <div className="mt-3">
          <AudioPlayerControlled ref={audioRef} meetingId={meeting.id} recordingUri={meeting.recordingUri} />
        </div>

        {/* Meeting Q&A */}
        <div className="mt-3">
          <MeetingChatPanel meetingId={meeting.id} hasTranscript={!!meeting.transcriptText} />
        </div>

        {/* Tab bar */}
        <div className="mt-4 flex gap-1 border-b border-dd-border -mb-px">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-6 py-6">
        {activeTab === 'transcript' && <TranscriptViewer meeting={meeting} audioRef={audioRef} onRetranscribe={() => setTranscribeOpen(true)} />}
        {activeTab === 'notes'      && <NotesTab meetingId={meeting.id} />}
        {activeTab === 'summary'      && <SummaryTab meetingId={meeting.id} hasTranscript={!!meeting.transcriptText} />}
        {activeTab === 'action-items' && <ActionItemsTab meetingId={meeting.id} hasTranscript={!!meeting.transcriptText} />}
      </div>
    </div>
  );
}
