import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Mic, Users, FileText, FolderKanban, Settings } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/meetings', label: 'Gravações', icon: <Mic size={18} /> },
  { to: '/people', label: 'Pessoas', icon: <Users size={18} /> },
  { to: '/templates', label: 'Templates', icon: <FileText size={18} /> },
  { to: '/meeting-types', label: 'Tipos de Reunião', icon: <FolderKanban size={18} /> },
  { to: '/settings', label: 'Configurações', icon: <Settings size={18} /> },
];

/** Fixed 240 px left sidebar with navigation links. */
export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col bg-dd-surface border-r border-dd-border h-screen sticky top-0">
      {/* Logo / brand */}
      <div className="px-5 py-5 border-b border-dd-border">
        <div className="flex items-center gap-2.5">
          <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
            <rect width="32" height="32" rx="8" fill="#6366f1" />
            <path d="M8 9h5.5a7 7 0 0 1 0 14H8V9z" stroke="#fff" strokeWidth="2.2" fill="none" />
            <path d="M15 9h5.5a7 7 0 0 1 0 14H15V9z" stroke="rgba(255,255,255,0.5)" strokeWidth="2.2" fill="none" />
          </svg>
          <span className="text-slate-100 font-semibold text-sm tracking-wide">DecisionDesk</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-dd-elevated',
              ].join(' ')
            }
          >
            <span className="shrink-0">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-dd-border">
        <p className="text-slate-500 text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
