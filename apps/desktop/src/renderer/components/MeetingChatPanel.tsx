import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  timestamp: string;
}

export function MeetingChatPanel({
  meetingId,
  hasTranscript,
}: {
  meetingId: string;
  hasTranscript: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<'local' | 'cloud'>('local');
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const chatActive = messages.length > 0;

  const { data: ollamaAvailable = false } = useQuery({
    queryKey: ['ollama-check'],
    queryFn: () => window.electronAPI.ollama.check(),
    refetchInterval: 30_000,
  });

  // Read preferLocal setting to set initial provider
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => window.electronAPI.settings.get(),
  });
  useEffect(() => {
    if (settings) {
      setProvider(settings.preferLocal ? 'local' : 'cloud');
    }
  }, [settings?.preferLocal]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      if (provider === 'local') {
        return window.electronAPI.chat.sendLocal(meetingId, message);
      }
      return window.electronAPI.chat.sendCloud(meetingId, message);
    },
    onSuccess: (result) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: result.answer,
          model: result.model,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
    onError: (error) => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `Erro: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        },
      ]);
    },
  });

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed || chatMutation.isPending) return;

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'user',
        content: trimmed,
        timestamp: new Date().toISOString(),
      },
    ]);
    setInput('');
    chatMutation.mutate(trimmed);
  };

  const handleClear = () => {
    setMessages([]);
    inputRef.current?.focus();
  };

  const isDisabled = !hasTranscript || (provider === 'local' && !ollamaAvailable);

  return (
    <div className="rounded-xl border border-dd-border bg-dd-surface overflow-hidden transition-all">
      {/* Chat header — only visible in chat mode */}
      {chatActive && (
        <div className="flex items-center justify-between border-b border-dd-border px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">
              {messages.filter((m) => m.role === 'user').length} pergunta(s)
            </span>
            <span className="text-slate-600">·</span>
            <ProviderToggle provider={provider} onChange={setProvider} />
          </div>
          <button
            onClick={handleClear}
            className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
          >
            Limpar
          </button>
        </div>
      )}

      {/* Ollama warning */}
      {provider === 'local' && !ollamaAvailable && hasTranscript && (
        <div className="border-b border-amber-500/20 bg-amber-500/5 px-4 py-2">
          <p className="text-xs text-amber-200/90">
            Ollama nao disponivel. Inicie com:{' '}
            <code className="rounded bg-dd-base px-1 py-0.5 text-amber-300 font-mono text-[10px]">
              ollama serve
            </code>
          </p>
        </div>
      )}

      {/* Messages area — only when chat is active */}
      {chatActive && (
        <div className="max-h-96 overflow-y-auto p-4 space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'bg-dd-elevated text-slate-300 border border-dd-border'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p>{msg.content}</p>
                )}
                {msg.model && (
                  <p className="mt-1 text-[10px] opacity-60">{msg.model}</p>
                )}
              </div>
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex justify-start">
              <div className="bg-dd-elevated border border-dd-border rounded-lg px-3 py-2">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.15s]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce [animation-delay:0.3s]" />
                </div>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Input bar */}
      <div className={`flex items-center gap-2 px-3 py-2.5 ${chatActive ? 'border-t border-dd-border' : ''}`}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={
            !hasTranscript
              ? 'Transcreva a reuniao para perguntar...'
              : 'Pergunte sobre a reuniao...'
          }
          disabled={isDisabled || chatMutation.isPending}
          className="flex-1 rounded-lg border border-dd-border bg-dd-elevated px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed"
        />
        {/* Send button */}
        <button
          onClick={handleSend}
          disabled={!input.trim() || isDisabled || chatMutation.isPending}
          className="flex-shrink-0 rounded-lg bg-indigo-600 p-2 text-white hover:bg-indigo-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Enviar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
        {/* Provider toggle — inline in compact mode */}
        {!chatActive && hasTranscript && (
          <ProviderToggle provider={provider} onChange={setProvider} />
        )}
      </div>
    </div>
  );
}

function ProviderToggle({
  provider,
  onChange,
}: {
  provider: 'local' | 'cloud';
  onChange: (p: 'local' | 'cloud') => void;
}) {
  return (
    <div className="flex rounded-md border border-dd-border overflow-hidden flex-shrink-0">
      <button
        onClick={() => onChange('local')}
        className={`px-2 py-1 text-[10px] font-medium transition-colors ${
          provider === 'local'
            ? 'bg-indigo-600 text-white'
            : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
        }`}
      >
        Local
      </button>
      <button
        onClick={() => onChange('cloud')}
        className={`px-2 py-1 text-[10px] font-medium transition-colors border-l border-dd-border ${
          provider === 'cloud'
            ? 'bg-indigo-600 text-white'
            : 'bg-dd-elevated text-slate-400 hover:text-slate-200'
        }`}
      >
        Cloud
      </button>
    </div>
  );
}
