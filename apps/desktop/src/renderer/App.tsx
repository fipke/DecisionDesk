import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { DashboardScreen } from './screens/DashboardScreen';
import { QueueScreen } from './screens/QueueScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { MeetingsScreen } from './screens/MeetingsScreen';
import { MeetingDetailScreen, ScreenErrorBoundary } from './screens/MeetingDetailScreen';
import { RecordScreen } from './screens/RecordScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { TemplatesScreen } from './screens/TemplatesScreen';
import { ThemeProvider } from './ThemeContext';
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

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'bg-indigo-500/10 text-indigo-400'
        : 'text-slate-400 hover:bg-dd-elevated hover:text-slate-200'
    }`;

  return (
    <aside className="flex w-64 flex-col border-r border-dd-border bg-dd-surface">
      {/* Drag region / app title */}
      <div className="drag-region flex h-14 items-center gap-2.5 border-b border-dd-border pl-[70px] pr-5">
        <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
          <rect width="32" height="32" rx="8" fill="#6366f1" />
          <path d="M8 9h5.5a7 7 0 0 1 0 14H8V9z" stroke="#fff" strokeWidth="2.2" fill="none" />
          <path d="M15 9h5.5a7 7 0 0 1 0 14H15V9z" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2" fill="none" />
        </svg>
        <h1 className="text-sm font-semibold text-slate-100 tracking-wide">DecisionDesk</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-3">
        {/* Dashboard */}
        <NavLink to="/" end className={navLinkClass}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          Dashboard
        </NavLink>

        {/* Gravações */}
        <NavLink to="/meetings" className={navLinkClass}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          Gravações
        </NavLink>

        {/* Gravar */}
        <NavLink to="/record" className={navLinkClass}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
          </svg>
          Gravar
        </NavLink>

        {/* Fila */}
        <NavLink to="/queue" className={navLinkClass}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
          Fila
        </NavLink>

        {/* Pessoas */}
        <NavLink to="/people" className={navLinkClass}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Pessoas
        </NavLink>

        {/* Templates */}
        <NavLink to="/templates" className={navLinkClass}>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Templates
        </NavLink>

        {/* Configurações */}
        <NavLink to="/settings" className={navLinkClass}>
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
      <div className="border-t border-dd-border p-4 space-y-2">
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

/** Listens for navigation events from the main process (e.g. notification clicks). */
function MainProcessNavigator() {
  const navigate = useNavigate();
  useEffect(() => {
    window.electronAPI.onNavigate((path) => navigate(path));
  }, [navigate]);
  return null;
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

  // suppress unused variable warning — queueCount is kept for future badge display
  void queueCount;

  return (
    <ThemeProvider>
      <HashRouter>
        <MainProcessNavigator />
        <div className="flex h-screen bg-dd-base">
          <Sidebar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/meetings" element={<MeetingsScreen />} />
              <Route path="/meetings/:id" element={<ScreenErrorBoundary><MeetingDetailScreen /></ScreenErrorBoundary>} />
              <Route path="/record" element={<RecordScreen />} />
              <Route path="/queue" element={<QueueScreen />} />
              <Route path="/people" element={<PeopleScreen />} />
              <Route path="/templates" element={<TemplatesScreen />} />
              <Route path="/settings" element={<SettingsScreen />} />
            </Routes>
          </main>
        </div>
      </HashRouter>
    </ThemeProvider>
  );
}
