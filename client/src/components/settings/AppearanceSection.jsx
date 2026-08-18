import { useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';
import { useTheme, loadThemePrefs, THEME_MODES, PALETTES } from '../../theme.jsx';

export default function AppearanceSection({ settings, onSave }) {
  const { mode, palette, setTheme } = useTheme();

  // Sync server settings into the live theme only when this device has no
  // locally saved preference (device-level choice wins for that device).
  useEffect(() => {
    if (loadThemePrefs()) return;
    if (settings.theme_mode && settings.theme_mode !== mode) setTheme(settings.theme_mode, null);
    if (settings.color_palette && settings.color_palette !== palette) setTheme(null, settings.color_palette);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.theme_mode, settings.color_palette]);

  const modeIcons = { light: Sun, dark: Moon, system: Monitor };

  function chooseMode(next) {
    setTheme(next, null);
    onSave({ theme_mode: next });
  }

  function choosePalette(next) {
    setTheme(null, next);
    onSave({ color_palette: next });
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <Sun size={18} className="text-accent-600 dark:text-accent-400" />
        <h3 className="font-bold">Appearance</h3>
      </div>

      <p className="label">Theme Mode</p>
      <div className="grid grid-cols-3 gap-2">
        {THEME_MODES.map((m) => {
          const Icon = modeIcons[m.id];
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => chooseMode(m.id)}
              className="flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition"
              style={
                active
                  ? { backgroundColor: 'rgb(var(--a-500) / 0.12)', borderColor: 'rgb(var(--a-500))', color: 'rgb(var(--a-700))' }
                  : { backgroundColor: 'rgb(var(--surface-2))', borderColor: 'rgb(var(--line))', color: 'rgb(var(--muted))' }
              }
            >
              <Icon size={18} />
              {m.label}
            </button>
          );
        })}
      </div>

      <p className="label mt-5">Accent Color</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {PALETTES.map((p) => {
          const active = palette === p.id;
          return (
            <button
              key={p.id}
              onClick={() => choosePalette(p.id)}
              className="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition"
              style={{
                backgroundColor: 'rgb(var(--surface-2))',
                borderColor: active ? 'rgb(var(--a-600))' : 'rgb(var(--line))',
                color: 'rgb(var(--ink))',
              }}
            >
              <span className="h-5 w-5 shrink-0 rounded-full border border-black/10" style={{ backgroundColor: p.swatch }} />
              <span className="truncate">{p.label}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[11px]" style={{ color: 'rgb(var(--muted))' }}>
        Theme and color choices are saved to the database and remembered on this device.
      </p>
    </div>
  );
}