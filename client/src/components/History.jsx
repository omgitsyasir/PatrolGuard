import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, ChevronDown, ClipboardCheck, AlertTriangle, FileText, Clock, ListChecks } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import EditableTimestamp from './EditableTimestamp.jsx';
import CheckpointList from './CheckpointList.jsx';
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
                    <ShiftDetail shiftId={s.id} />
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

function ShiftDetail({ shiftId }) {
  const toast = useToast();
  const [shift, setShift] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get(`/api/shifts/${shiftId}`)
      .then(setShift)
      .catch((e) => setError(e.message));
  }, [shiftId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <p className="text-sm text-rose-500">{error}</p>;
  if (!shift) return <div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />;

  async function saveShift(data) {
    try {
      setShift(await api.updateShift(shift.id, data));
      toast('Shift updated', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function savePatrol(slot, data) {
    try {
      const p = await api.updatePatrol(shift.id, slot, data);
      setShift((s) => ({ ...s, patrols: s.patrols.map((x) => (x.slot === slot ? p : x)) }));
      toast('Patrol updated', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function saveChecklist(slot, checklist) {
    setShift((s) => ({ ...s, patrols: s.patrols.map((x) => (x.slot === slot ? { ...x, checklist } : x)) }));
    api.saveChecklist(shift.id, slot, checklist).catch((e) => toast(e.message, 'error'));
  }

  return (
    <div className="space-y-3">
      <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: 'rgb(var(--muted))' }}>
        <span className="flex items-center gap-1">
          <Clock size={12} /> started{' '}
          <EditableTimestamp value={shift.started_at} onSave={(iso) => saveShift({ started_at: iso })} />
        </span>
        {shift.ended_at && (
          <span className="flex items-center gap-1">
            ended{' '}
            <EditableTimestamp value={shift.ended_at} onSave={(iso) => saveShift({ ended_at: iso })} />
          </span>
        )}
      </p>

      {shift.logs?.length > 0 && (
        <div className="rounded-xl border p-3" style={{ borderColor: 'rgb(var(--line))' }}>
          <p className="mb-1.5 flex items-center gap-1 text-xs font-bold" style={{ color: 'rgb(var(--ink))' }}>
            <ListChecks size={13} className="text-accent-600 dark:text-accent-400" /> Shift Log
          </p>
          <div className="space-y-1">
            {shift.logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 text-xs" style={{ color: 'rgb(var(--ink-2))' }}>
                <span className={`mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-bold uppercase ${l.phase === 'start' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : l.phase === 'end' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'}`}>
                  {l.phase}
                </span>
                <span className="min-w-0 flex-1">{l.text}</span>
                <span className="shrink-0 font-mono" style={{ color: 'rgb(var(--faint))' }}>{formatInstant(l.logged_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        {shift.patrols.map((p) => {
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
              <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs" style={{ color: 'rgb(var(--muted))' }}>
                <span>
                  started{' '}
                  <EditableTimestamp value={p.started_at} onSave={(iso) => savePatrol(p.slot, { started_at: iso })} emptyLabel="—" />
                </span>
                <span>→</span>
                <span>
                  ended{' '}
                  <EditableTimestamp value={p.completed_at} onSave={(iso) => savePatrol(p.slot, { completed_at: iso })} emptyLabel="—" />
                </span>
              </p>

              {p.checklist?.length > 0 && (
                <div className="mt-2 rounded-lg p-2" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
                  <CheckpointList items={p.checklist} onChange={(checklist) => saveChecklist(p.slot, checklist)} />
                </div>
              )}
              {p.notes && <p className="mt-2 rounded-lg p-2 text-xs" style={{ backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--ink-2))' }}>{p.notes}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
}