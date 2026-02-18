import { NavLink } from 'react-router-dom';
import { Mic, Users, Settings } from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Reuniões', icon: <Mic size={18} /> },
  { to: '/people', label: 'Pessoas', icon: <Users size={18} /> },
  { to: '/settings', label: 'Configurações', icon: <Settings size={18} /> },
];

/** Fixed 240 px left sidebar with navigation links. */
export function Sidebar() {
  return (
    <aside className="w-60 shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 h-screen sticky top-0">
      {/* Logo / brand */}
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0">
            <Mic size={14} className="text-white" />
          </div>
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
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800',
              ].join(' ')
            }
          >
            <span className="shrink-0">{icon}</span>
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-800">
        <p className="text-slate-500 text-xs">v0.1.0</p>
      </div>
    </aside>
  );
}
