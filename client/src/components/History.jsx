import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ClipboardCheck, AlertTriangle, FileText, Clock } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import { formatInstant, STATUS_META } from '../lib/format.js';

const TABS = [
  { id: 'shifts', label: 'Shifts' },
  { id: 'incidents', label: 'Incidents' },
  { id: 'reports', label: 'Reports' },
];

export default function History() {
  const toast = useToast();
  const [tab, setTab] = useState('shifts');
  const [query, setQuery] = useState('');
  const [shifts, setShifts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, i, r] = await Promise.all([
        api.get('/api/shifts'),
        api.get('/api/incidents'),
        api.get('/api/reports'),
      ]);
      setShifts(s);
      setIncidents(i);
      setReports(r);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (fields) => !q || fields.some((f) => String(f || '').toLowerCase().includes(q));
    return {
      shifts: shifts.filter((s) => match([s.officer_name, s.site_name, s.date, s.notes])),
      incidents: incidents.filter((i) => match([i.incident_type, i.location, i.details])),
      reports: reports.filter((r) => match([r.title, r.content, r.model])),
    };
  }, [query, shifts, incidents, reports]);

  const counts = { shifts: filtered.shifts.length, incidents: filtered.incidents.length, reports: filtered.reports.length };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--faint))' }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input pl-9"
          placeholder="Search patrol logs, incidents, reports…"
        />
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex-1 rounded-xl border px-3 py-2 text-sm font-semibold transition"
              style={
                active
                  ? { backgroundColor: 'rgb(var(--a-600))', borderColor: 'rgb(var(--a-600))', color: 'white' }
                  : { backgroundColor: 'rgb(var(--surface))', borderColor: 'rgb(var(--line))', color: 'rgb(var(--muted))' }
              }
            >
              {t.label} ({counts[t.id]})
            </button>
          );
        })}
      </div>

      {loading && <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />}

      {/* Shifts */}
      {!loading && tab === 'shifts' && (
        <div className="space-y-2">
          {filtered.shifts.length === 0 && <p className="py-8 text-center text-sm" style={{ color: 'rgb(var(--faint))' }}>No shifts found.</p>}
          {filtered.shifts.map((s) => {
            const isOpen = expanded === `s-${s.id}`;
            return (
              <div key={s.id} className="card">
                <button onClick={() => setExpanded(isOpen ? null : `s-${s.id}`)} className="flex w-full items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${s.status === 'completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400'}`}>
                      <Clock size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{s.officer_name}</p>
                      <p className="truncate text-xs" style={{ color: 'rgb(var(--muted))' }}>
                        {s.site_name ? `${s.site_name} · ` : ''}
                        {formatInstant(s.started_at, { year: true })} → {s.ended_at ? formatInstant(s.ended_at) : 'active'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs" style={{ color: 'rgb(var(--faint))' }}>
                      {s.patrol_count}/{s.patrol_total} · {s.incident_count} inc
                    </span>
                    <ChevronDown size={16} className={`transition ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'rgb(var(--faint))' }} />
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'rgb(var(--line))' }}>
                    {s.patrol_total === 0 && <p className="text-sm" style={{ color: 'rgb(var(--faint))' }}>No patrol data.</p>}
                    {s.notes && <p className="rounded-xl p-3 text-sm" style={{ backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--ink-2))' }}>{s.notes}</p>}
                    <ShiftPatrols shiftId={s.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Incidents */}
      {!loading && tab === 'incidents' && (
        <div className="grid gap-2 md:grid-cols-2">
          {filtered.incidents.length === 0 && (
            <p className="col-span-2 py-8 text-center text-sm" style={{ color: 'rgb(var(--faint))' }}>
              No incidents found.
            </p>
          )}
          {filtered.incidents.map((i) => {
            const isOpen = expanded === `i-${i.id}`;
            return (
              <div key={i.id} className="card">
                <button onClick={() => setExpanded(isOpen ? null : `i-${i.id}`)} className="flex w-full items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-rose-50 p-2.5 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{i.incident_type}</p>
                      <p className="truncate text-xs" style={{ color: 'rgb(var(--muted))' }}>
                        {i.location} · {formatInstant(i.occurred_at, { year: true })}
                      </p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'rgb(var(--faint))' }} />
                </button>
                {isOpen && (
                  <div className="mt-3 border-t pt-3" style={{ borderColor: 'rgb(var(--line))' }}>
                    <p className="text-sm" style={{ color: 'rgb(var(--ink-2))' }}>{i.details || 'No details.'}</p>
                    {i.media.length > 0 && <p className="mt-2 text-xs" style={{ color: 'rgb(var(--faint))' }}>{i.media.length} attachment(s)</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reports */}
      {!loading && tab === 'reports' && (
        <div className="space-y-2">
          {filtered.reports.length === 0 && <p className="py-8 text-center text-sm" style={{ color: 'rgb(var(--faint))' }}>No reports found.</p>}
          {filtered.reports.map((r) => {
            const isOpen = expanded === `r-${r.id}`;
            return (
              <div key={r.id} className="card">
                <button onClick={() => setExpanded(isOpen ? null : `r-${r.id}`)} className="flex w-full items-center justify-between gap-2 text-left">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                      <FileText size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-bold">{r.title}</p>
                      <p className="text-xs" style={{ color: 'rgb(var(--faint))' }}>{formatInstant(r.created_at, { year: true })}</p>
                    </div>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 transition ${isOpen ? 'rotate-180' : ''}`} style={{ color: 'rgb(var(--faint))' }} />
                </button>
                {isOpen && (
                  <pre
                    className="mt-3 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 font-mono text-xs"
                    style={{ backgroundColor: 'rgb(var(--header))', color: 'rgb(var(--header-text))' }}
                  >
                    {r.content}
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ShiftPatrols({ shiftId }) {
  const [patrols, setPatrols] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get(`/api/shifts/${shiftId}`)
      .then((s) => setPatrols(s.patrols))
      .catch((e) => setError(e.message));
  }, [shiftId]);

  if (error) return <p className="text-sm text-rose-500">{error}</p>;
  if (!patrols) return <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;

  return (
    <div className="space-y-2">
      {patrols.map((p) => {
        const meta = STATUS_META[p.status];
        return (
          <div key={p.id} className="rounded-xl border p-3" style={{ borderColor: 'rgb(var(--line))' }}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold">
                <ClipboardCheck size={14} className="mr-1 inline" style={{ color: 'rgb(var(--faint))' }} />
                {p.label}
              </p>
              {meta ? (
                <span
                  className="chip"
                  style={{
                    backgroundColor: 'rgb(var(--surface-2))',
                    borderColor: 'rgb(var(--line))',
                    color:
                      p.status === 'all_clear'
                        ? 'rgb(16 185 129)'
                        : p.status === 'minor_issues'
                        ? 'rgb(245 158 11)'
                        : 'rgb(244 63 94)',
                  }}
                >
                  {meta.label}
                </span>
              ) : p.started_at ? (
                <span className="chip" style={{ backgroundColor: 'rgb(var(--surface-2))', borderColor: 'rgb(var(--line))', color: 'rgb(var(--muted))' }}>
                  In progress
                </span>
              ) : (
                <span className="text-[11px]" style={{ color: 'rgb(var(--faint))' }}>Not started</span>
              )}
            </div>
            <p className="mt-1 text-xs" style={{ color: 'rgb(var(--muted))' }}>
              {p.started_at ? formatInstant(p.started_at) : '—'} → {p.completed_at ? formatInstant(p.completed_at) : '—'}
            </p>
            {p.checklist?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {p.checklist.map((c) => (
                  <span
                    key={c.name}
                    className="chip"
                    style={
                      c.ok
                        ? { backgroundColor: 'rgb(16 185 129 / 0.1)', borderColor: 'rgb(16 185 129 / 0.3)', color: 'rgb(16 185 129)' }
                        : { backgroundColor: 'rgb(244 63 94 / 0.1)', borderColor: 'rgb(244 63 94 / 0.3)', color: 'rgb(244 63 94)' }
                    }
                  >
                    {c.name} {c.ok ? '✓' : '!'}
                  </span>
                ))}
              </div>
            )}
            {p.notes && <p className="mt-2 rounded-lg p-2 text-xs" style={{ backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--ink-2))' }}>{p.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}