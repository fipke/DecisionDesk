import { Server, Info } from 'lucide-react';

const API_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8087';

/** Simple settings page showing the configured API URL. */
export function SettingsPage() {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-950">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-slate-800">
        <h1 className="text-slate-100 text-xl font-semibold">Configurações</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-lg space-y-4">
          {/* API URL card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Server size={15} className="text-emerald-400 shrink-0" />
              <h2 className="text-slate-100 text-sm font-medium">Servidor da API</h2>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg px-4 py-3">
              <p className="text-emerald-400 text-sm font-mono break-all">{API_URL}</p>
            </div>

            <div className="mt-3 flex items-start gap-2">
              <Info size={13} className="text-slate-500 mt-0.5 shrink-0" />
              <p className="text-slate-500 text-xs leading-relaxed">
                Para alterar o servidor, edite a variável{' '}
                <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-xs">
                  VITE_API_URL
                </code>{' '}
                no arquivo{' '}
                <code className="text-slate-400 bg-slate-800 px-1 py-0.5 rounded text-xs">
                  .env
                </code>{' '}
                e reinicie o servidor de desenvolvimento.
              </p>
            </div>
          </div>

          {/* Version card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <h2 className="text-slate-100 text-sm font-medium mb-3">Sobre</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Versão</span>
                <span className="text-slate-300">0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Plataforma</span>
                <span className="text-slate-300">Web</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
