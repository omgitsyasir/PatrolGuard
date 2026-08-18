import { useCallback, useEffect, useState } from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  FileText,
  History,
  Settings as SettingsIcon,
  ClipboardList,
} from 'lucide-react';
import { ToastProvider, useToast } from './components/Toast.jsx';
import Dashboard from './components/Dashboard.jsx';
import Incidents from './components/Incidents.jsx';
import Reports from './components/Reports.jsx';
import HistoryTab from './components/History.jsx';
import SettingsTab from './components/Settings.jsx';
import { ThemeProvider, useTheme, loadThemePrefs } from './theme.jsx';
import { api } from './lib/api.js';

const TABS = [
  { id: 'shift', label: 'Shift', icon: ShieldCheck },
  { id: 'incidents', label: 'Incidents', icon: AlertTriangle },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'history', label: 'History', icon: History },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

function Shell() {
  const toast = useToast();
  const [tab, setTab] = useState('shift');
  const [settings, setSettings] = useState({ officer_name: '', badge_no: '', theme_mode: 'system', color_palette: 'emerald' });
  const { setTheme } = useTheme();

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.get('/api/settings');
      setSettings(s);
      if (!loadThemePrefs()) {
        setTheme(s.theme_mode || 'system', s.color_palette || 'emerald');
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }, [toast, setTheme]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = useCallback(
    (next) => {
      setSettings((s) => ({ ...s, ...next }));
    },
    []
  );

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside
        className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r md:flex"
        style={{ backgroundColor: 'rgb(var(--surface))', borderColor: 'rgb(var(--line))' }}
      >
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="rounded-xl p-2 text-accent-400" style={{ backgroundColor: 'rgb(var(--a-500) / 0.15)' }}>
            <ClipboardList size={24} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-none">PatrolGuard</h1>
            <p className="mt-1 text-xs" style={{ color: 'rgb(var(--muted))' }}>
              {settings.officer_name || 'Hotel Security'}
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active ? '' : 'hover:opacity-80'
                }`}
                style={
                  active
                    ? { backgroundColor: 'rgb(var(--a-500) / 0.12)', color: 'rgb(var(--a-700))' }
                    : { color: 'rgb(var(--muted))' }
                }
              >
                <Icon size={19} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t px-5 py-4 text-xs" style={{ borderColor: 'rgb(var(--line))', color: 'rgb(var(--muted))' }}>
          <p className="font-semibold" style={{ color: 'rgb(var(--ink))' }}>
            {settings.officer_name || 'Unnamed Officer'}
          </p>
          <p>{settings.badge_no ? `Badge #${settings.badge_no}` : 'No badge set'}</p>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile header */}
        <header
          className="sticky top-0 z-40 flex items-center justify-between px-4 py-3 md:hidden"
          style={{ backgroundColor: 'rgb(var(--header))', color: 'rgb(var(--header-text))' }}
        >
          <div className="flex items-center gap-2">
            <div className="rounded-lg p-1.5 text-accent-400" style={{ backgroundColor: 'rgb(var(--a-500) / 0.2)' }}>
              <ClipboardList size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold leading-none">PatrolGuard</h1>
              <p className="mt-0.5 text-[11px]" style={{ color: 'rgb(var(--header-text))', opacity: 0.7 }}>
                {settings.officer_name || 'Hotel Security Officer'}
              </p>
            </div>
          </div>
          {settings.badge_no && (
            <span className="rounded-full px-2 py-1 text-[11px] font-semibold" style={{ backgroundColor: 'rgb(var(--a-500) / 0.2)', color: 'rgb(var(--a-400))' }}>
              #{settings.badge_no}
            </span>
          )}
        </header>

        {/* Content */}
        <main className="flex-1 px-4 pb-24 pt-4 md:px-8 md:pb-10 md:pt-6">
          <div className="mx-auto w-full max-w-6xl">
            {tab === 'shift' && <Dashboard settings={settings} onSettingsChange={updateSettings} />}
            {tab === 'incidents' && <Incidents />}
            {tab === 'reports' && <Reports />}
            {tab === 'history' && <HistoryTab />}
            {tab === 'settings' && <SettingsTab settings={settings} onSettingsChange={updateSettings} />}
          </div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] md:hidden"
        style={{ backgroundColor: 'rgb(var(--surface))', borderColor: 'rgb(var(--line))' }}
      >
        <div className="grid grid-cols-5">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold"
                style={{ color: active ? 'rgb(var(--a-600))' : 'rgb(var(--faint))' }}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <ThemeProvider>
        <Shell />
      </ThemeProvider>
    </ToastProvider>
  );
}