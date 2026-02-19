import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PendingJob {
  meetingId: string;
  model: string;
  language: string;
  diarization: boolean;
}

interface JobState {
  status: 'pending' | 'accepted' | 'processing' | 'completed' | 'failed';
  progress?: string;
  error?: string;
}

export function QueueScreen() {
  const queryClient = useQueryClient();
  const [jobStates, setJobStates] = useState<Map<string, JobState>>(new Map());
  const [processingId, setProcessingId] = useState<string | null>(null);

  const { data: pendingJobs, isLoading, error, refetch } = useQuery({
    queryKey: ['pending-jobs'],
    queryFn: () => window.electronAPI.queue.getPending(),
    refetchInterval: 10000 // Poll every 10 seconds
  });

  const acceptMutation = useMutation({
    mutationFn: (meetingId: string) => window.electronAPI.queue.acceptJob(meetingId),
    onSuccess: (_, meetingId) => {
      setJobStates(prev => new Map(prev).set(meetingId, { status: 'accepted' }));
    }
  });

  const processMutation = useMutation({
    mutationFn: (meetingId: string) => window.electronAPI.queue.processJob(meetingId),
    onMutate: (meetingId) => {
      setProcessingId(meetingId);
      setJobStates(prev => new Map(prev).set(meetingId, { status: 'processing' }));
    },
    onSuccess: (_, meetingId) => {
      setJobStates(prev => new Map(prev).set(meetingId, { status: 'completed' }));
      setProcessingId(null);
      refetch();
    },
    onError: (err, meetingId) => {
      setJobStates(prev => new Map(prev).set(meetingId, { 
        status: 'failed', 
        error: err instanceof Error ? err.message : 'Falha na transcrição'
      }));
      setProcessingId(null);
    }
  });

  useEffect(() => {
    window.electronAPI.queue.onJobReceived((job: PendingJob) => {
      queryClient.invalidateQueries({ queryKey: ['pending-jobs'] });
    });

    window.electronAPI.queue.onJobCompleted((meetingId: string) => {
      setJobStates(prev => new Map(prev).set(meetingId, { status: 'completed' }));
      setProcessingId(null);
      queryClient.invalidateQueries({ queryKey: ['pending-jobs'] });
    });

    window.electronAPI.queue.onJobFailed(({ meetingId, error }: { meetingId: string; error: string }) => {
      setJobStates(prev => new Map(prev).set(meetingId, { status: 'failed', error }));
      setProcessingId(null);
    });
  }, [queryClient]);

  const handleAcceptAndProcess = async (meetingId: string) => {
    try {
      await acceptMutation.mutateAsync(meetingId);
      await processMutation.mutateAsync(meetingId);
    } catch (err) {
      // Error handled by mutation
    }
  };

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-red-400">Erro ao carregar fila</p>
          <p className="mt-1 text-sm text-slate-500">{String(error)}</p>
          <button
            onClick={() => refetch()}
            className="mt-4 rounded-lg bg-dd-elevated px-4 py-2 text-sm hover:bg-dd-elevated"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-100">Fila de Transcrição</h2>
          <p className="mt-1 text-sm text-slate-400">
            Transcrições aguardando processamento local
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="flex items-center gap-2 rounded-lg bg-dd-elevated px-4 py-2 text-sm hover:bg-dd-elevated"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
        </div>
      ) : !pendingJobs?.length ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-dd-border bg-dd-surface/50 py-16">
          <svg className="h-16 w-16 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-4 text-lg font-medium text-slate-400">Nenhuma transcrição pendente</p>
          <p className="mt-1 text-sm text-slate-500">
            Novas transcrições aparecerão aqui automaticamente
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingJobs.map((job) => {
            const state = jobStates.get(job.meetingId);
            const isProcessing = processingId === job.meetingId;

            return (
              <div
                key={job.meetingId}
                className="rounded-xl border border-dd-border bg-dd-surface p-4"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-slate-300">
                        {job.meetingId.slice(0, 8)}...
                      </span>
                      {state?.status === 'processing' && (
                        <span className="flex items-center gap-1 text-xs text-indigo-400">
                          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                          Processando
                        </span>
                      )}
                      {state?.status === 'completed' && (
                        <span className="text-xs text-indigo-400">✓ Concluído</span>
                      )}
                      {state?.status === 'failed' && (
                        <span className="text-xs text-red-400">✗ Falhou</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="rounded-md bg-dd-elevated px-2 py-1 text-xs text-slate-300">
                        {job.model}
                      </span>
                      <span className="rounded-md bg-dd-elevated px-2 py-1 text-xs text-slate-300">
                        {job.language}
                      </span>
                      {job.diarization && (
                        <span className="rounded-md bg-indigo-500/10 px-2 py-1 text-xs text-indigo-400">
                          Diarização
                        </span>
                      )}
                    </div>
                    {state?.error && (
                      <p className="mt-2 text-sm text-red-400">{state.error}</p>
                    )}
                  </div>

                  <div className="ml-4 flex gap-2">
                    {(!state || state.status === 'pending') && !isProcessing && (
                      <button
                        onClick={() => handleAcceptAndProcess(job.meetingId)}
                        disabled={processingId !== null}
                        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
                      >
                        Processar
                      </button>
                    )}
                    {isProcessing && (
                      <div className="flex items-center gap-2 px-4 py-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-indigo-400" />
                        <span className="text-sm text-slate-400">Processando...</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
