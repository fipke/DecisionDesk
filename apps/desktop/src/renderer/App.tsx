import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { QueueScreen } from './screens/QueueScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ElectronAPI } from '../preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

function Sidebar() {
  const { data: whisperStatus } = useQuery({
    queryKey: ['whisper-status'],
    queryFn: () => window.electronAPI.whisper.getStatus()
  });

  const { data: syncCount } = useQuery({
    queryKey: ['sync-count'],
    queryFn: () => window.electronAPI.db.syncQueueCount(),
    refetchInterval: 5000
  });

  const [connectivity, setConnectivity] = useState<{ online: boolean; backendReachable: boolean }>({
    online: true,
    backendReachable: false
  });

  useEffect(() => {
    window.electronAPI.connectivity.getStatus().then(setConnectivity);
    window.electronAPI.connectivity.onStatusChange(setConnectivity);
  }, []);

  return (
    <aside className="flex w-64 flex-col border-r border-slate-800 bg-slate-900">
      {/* Drag region / app title */}
      <div className="drag-region flex h-14 items-center border-b border-slate-800 px-5">
        <h1 className="text-lg font-semibold text-slate-100">DecisionDesk</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-emerald-950/50 text-emerald-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Fila de Transcrição
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? 'bg-emerald-950/50 text-emerald-400'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
            }`
          }
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Configurações
        </NavLink>
      </nav>

      {/* Status footer */}
      <div className="border-t border-slate-800 p-4 space-y-2">
        {/* Connectivity */}
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${
            connectivity.backendReachable
              ? 'bg-emerald-500'
              : connectivity.online
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`} />
          <span className="text-xs text-slate-400">
            {connectivity.backendReachable
              ? 'Backend conectado'
              : connectivity.online
                ? 'Offline do backend'
                : 'Sem conexão'}
          </span>
          {(syncCount ?? 0) > 0 && (
            <span className="ml-auto rounded-full bg-amber-900/50 px-1.5 py-0.5 text-[10px] font-medium text-amber-400">
              {syncCount} pendente{(syncCount ?? 0) > 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Whisper */}
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${whisperStatus?.available ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-400">
            {whisperStatus?.available ? 'Whisper disponível' : 'Whisper não encontrado'}
          </span>
        </div>
        {whisperStatus?.available && (
          <div className="text-xs text-slate-500 pl-4">
            Modelos: {whisperStatus.models.join(', ') || 'Nenhum'}
          </div>
        )}
      </div>
    </aside>
  );
}

export function App() {
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    // Listen for queue updates
    window.electronAPI.queue.onJobReceived(() => {
      setQueueCount(c => c + 1);
    });

    window.electronAPI.queue.onJobCompleted(() => {
      setQueueCount(c => Math.max(0, c - 1));
    });

    window.electronAPI.queue.onJobFailed(() => {
      setQueueCount(c => Math.max(0, c - 1));
    });
  }, []);

  return (
    <HashRouter>
      <div className="flex h-screen bg-slate-950">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<QueueScreen />} />
            <Route path="/settings" element={<SettingsScreen />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}
