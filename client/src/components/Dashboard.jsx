import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Play,
  CheckCircle2,
  Timer,
  ShieldCheck,
  LogOut,
  ClipboardCheck,
  Clock,
  MapPin,
  Building2,
  AlertTriangle,
  Loader2,
  Plus,
  ListChecks,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import Modal from './Modal.jsx';
import EditableTimestamp from './EditableTimestamp.jsx';
import CheckpointList from './CheckpointList.jsx';
import { formatClock, STATUS_META, INCIDENT_TYPES } from '../lib/format.js';

const SLOT_META = {
  1: { icon: ClipboardCheck, color: 'text-sky-600 bg-sky-50 border-sky-200 dark:text-sky-400 dark:bg-sky-500/10 dark:border-sky-500/30' },
  2: { icon: Timer, color: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-500/10 dark:border-amber-500/30' },
  3: { icon: ShieldCheck, color: 'text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-500/10 dark:border-indigo-500/30' },
};

const STATUS_CLASSES = {
  all_clear: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  minor_issues: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  requires_action: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/30',
};

function elapsedSince(startIso) {
  const ms = Date.now() - new Date(startIso).getTime();
  if (ms < 0) return '0h 00m';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${String(m).padStart(2, '0')}m`;
}

// Editable, reorderable checkpoint checklist with per-item check-in timestamps.
export default function Dashboard({ settings }) {
  const toast = useToast();
  const [shift, setShift] = useState(null);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [elapsed, setElapsed] = useState('');
  const [endModal, setEndModal] = useState(false);
  const [endNotes, setEndNotes] = useState('');
  const [drafts, setDrafts] = useState({});
  const pollRef = useRef(null);

  const [quick, setQuick] = useState({ incident_type: INCIDENT_TYPES[0], location: '', details: '' });

  const load = useCallback(async () => {
    try {
      const [res, siteList] = await Promise.all([api.get('/api/shifts/active'), api.sites.list()]);
      setSites(siteList);
      setShift(res.shift);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  // Live elapsed clock, restarts whenever the shift's start time is edited.
  useEffect(() => {
    if (!shift?.started_at) return;
    const update = () => setElapsed(elapsedSince(shift.started_at));
    update();
    const iv = setInterval(update, 1000);
    pollRef.current = iv;
    return () => clearInterval(iv);
  }, [shift?.started_at]);

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

  function applyShift(next) {
    setShift(next);
    setDrafts({});
  }

  async function startShift() {
    if (!selectedSiteId) return toast('Select a site to start your shift', 'error');
    setBusyId('start-shift');
    try {
      const s = await api.post('/api/shifts', { site_id: Number(selectedSiteId) });
      setShift(s);
      toast(`Shift started at ${s.site_name}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  function replacePatrol(slot, nextPatrol) {
    setShift((s) => ({ ...s, patrols: s.patrols.map((x) => (x.slot === slot ? nextPatrol : x)) }));
  }

  async function startPatrol(slot) {
    setBusyId(`start-${slot}`);
    try {
      const p = await api.post(`/api/shifts/${shift.id}/patrols/${slot}/start`);
      replacePatrol(slot, p);
      setDrafts((d) => ({
        ...d,
        [slot]: { status: 'all_clear', checklist: p.checklist, notes: '' },
      }));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function completePatrol(slot) {
    const draft = drafts[slot];
    if (!draft) return;
    setBusyId(`complete-${slot}`);
    try {
      const res = await api.post(`/api/shifts/${shift.id}/patrols/${slot}/complete`, {
        status: draft.status,
        checklist: draft.checklist,
        notes: draft.notes,
      });
      setShift((s) => ({
        ...s,
        ...(res.shift ? { status: 'completed', ended_at: res.shift.ended_at } : {}),
        patrols: s.patrols.map((x) => (x.slot === slot ? res.patrol : x)),
      }));
      setDrafts((d) => ({ ...d, [slot]: undefined }));
      toast('Patrol completed', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  // Live checkpoint persistence (add / edit / reorder / delete / check-in time).
  function updateChecklist(slot, next) {
    setDrafts((d) => ({ ...d, [slot]: { ...d[slot], checklist: next } }));
    api.saveChecklist(shift.id, slot, next).catch((e) => toast(e.message, 'error'));
  }

  async function savePatrolTimes(slot, data) {
    try {
      const p = await api.updatePatrol(shift.id, slot, data);
      replacePatrol(slot, p);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function saveShiftTimes(data) {
    try {
      const next = await api.updateShift(shift.id, data);
      setShift(next);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function endShift() {
    setBusyId('end');
    try {
      const s = await api.post(`/api/shifts/${shift.id}/end`, { notes: endNotes });
      applyShift(s);
      setEndModal(false);
      setEndNotes('');
      toast('Shift ended', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  async function logQuickIncident() {
    if (!quick.location.trim()) return toast('Location is required', 'error');
    setBusyId('quick-incident');
    try {
      await api.post('/api/incidents', {
        incident_type: quick.incident_type,
        occurred_at: new Date().toISOString(),
        location: quick.location,
        details: quick.details,
        media: [],
      });
      toast('Incident logged', 'success');
      setQuick({ incident_type: INCIDENT_TYPES[0], location: '', details: '' });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-40 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        <div className="grid gap-3 md:grid-cols-3">
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          <div className="h-28 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
        </div>
      </div>
    );
  }

  const isActive = shift?.status === 'active';

  // ---------- Start / completed view ----------
  if (!isActive) {
    return (
      <div className="space-y-4">
        <StartShiftCard
          sites={sites}
          selectedSiteId={selectedSiteId}
          setSelectedSiteId={setSelectedSiteId}
          onStart={startShift}
          busy={busyId === 'start-shift'}
          settings={settings}
        />
        {shift && shift.status === 'completed' && (
          <CompletedShiftSummary shift={shift} onUpdate={(s) => setShift(s)} />
        )}
      </div>
    );
  }

  const completed = shift.patrols.filter((p) => p.completed_at).length;
  const total = shift.patrols.length;

  // ---------- Active shift view ----------
  return (
    <div className="space-y-4">
      {/* Shift header */}
      <div
        className="card p-5 text-white"
        style={{ backgroundColor: 'rgb(var(--header))', borderColor: 'rgb(var(--header))' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider opacity-70">Shift · {shift.date}</p>
            <h2 className="mt-0.5 text-xl font-bold">{shift.officer_name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm opacity-90">
              <span className="inline-flex items-center gap-1">
                <MapPin size={14} /> {shift.site_name}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={14} /> started{' '}
                <EditableTimestamp
                  value={shift.started_at}
                  onSave={(iso) => saveShiftTimes({ started_at: iso })}
                />
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase tracking-wider opacity-70">Elapsed</p>
            <p className="font-mono text-lg font-bold text-accent-400">{elapsed}</p>
            <p className="text-xs opacity-70">
              {completed}/{total} patrols
            </p>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full opacity-30" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
          <div
            className="h-full rounded-full bg-accent-500 transition-all"
            style={{ width: `${total ? (completed / total) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Shift narrative log (auto-logged start/end requirements + entries) */}
      {shift.logs?.length > 0 && (
        <div className="card">
          <div className="mb-2 flex items-center gap-2">
            <ListChecks size={18} className="text-accent-600 dark:text-accent-400" />
            <h3 className="font-bold">Shift Log</h3>
          </div>
          <div className="space-y-1.5">
            {shift.logs.map((l) => (
              <div key={l.id} className="flex items-start gap-2 text-sm">
                <span
                  className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                    l.phase === 'start' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400' : l.phase === 'end' ? 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-400' : 'bg-slate-100 text-slate-600 dark:bg-slate-500/15 dark:text-slate-300'
                  }`}
                >
                  {l.phase}
                </span>
                <span className="min-w-0 flex-1" style={{ color: 'rgb(var(--ink-2))' }}>{l.text}</span>
                <span className="shrink-0 font-mono text-xs" style={{ color: 'rgb(var(--faint))' }}>{formatClock(l.logged_at)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Patrol slots */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {shift.patrols.map((patrol) => {
          const meta = SLOT_META[patrol.slot] || { icon: ClipboardCheck, color: 'text-slate-600 bg-slate-50 border-slate-200' };
          const Icon = meta.icon;
          const draft = drafts[patrol.slot];
          const inProgress = patrol.started_at && !patrol.completed_at;
          const done = Boolean(patrol.completed_at);
          const statusMeta = STATUS_META[patrol.status];

          return (
            <div key={patrol.slot} className="card flex flex-col">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl border p-2.5 ${meta.color}`}>
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-bold">{patrol.label}</p>
                    {inProgress && (
                      <p className="flex items-center gap-1 text-xs text-accent-600 dark:text-accent-400">
                        In progress · started{' '}
                        <EditableTimestamp
                          value={patrol.started_at}
                          onSave={(iso) => savePatrolTimes(patrol.slot, { started_at: iso })}
                        />
                      </p>
                    )}
                    {done && statusMeta && (
                      <>
                        <span className={`chip mt-0.5 ${STATUS_CLASSES[patrol.status]}`}>{statusMeta.label}</span>
                        <p className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: 'rgb(var(--faint))' }}>
                          completed{' '}
                          <EditableTimestamp
                            value={patrol.completed_at}
                            onSave={(iso) => savePatrolTimes(patrol.slot, { completed_at: iso })}
                          />
                        </p>
                      </>
                    )}
                    {!patrol.started_at && <p className="text-xs" style={{ color: 'rgb(var(--faint))' }}>Not started</p>}
                  </div>
                </div>
                {!inProgress && !done && (
                  <button onClick={() => startPatrol(patrol.slot)} disabled={busyId === `start-${patrol.slot}`} className="btn-primary px-3 py-2">
                    <Play size={15} /> Start
                  </button>
                )}
                {done && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={14} /> Done
                  </span>
                )}
              </div>

              {inProgress && (
                <div className="mt-4 flex flex-1 flex-col border-t pt-4" style={{ borderColor: 'rgb(var(--line))' }}>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(STATUS_META).map(([key, meta2]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDrafts((d) => ({ ...d, [patrol.slot]: { ...d[patrol.slot], status: key } }))}
                        className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                          draft?.status === key
                            ? STATUS_CLASSES[key]
                            : 'border-[rgb(var(--line))]'
                        }`}
                        style={
                          draft?.status !== key
                            ? { backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--muted))' }
                            : undefined
                        }
                      >
                        {meta2.label}
                      </button>
                    ))}
                  </div>

                  <p className="label mt-4">Checkpoints</p>
                  <CheckpointList
                    items={draft?.checklist || []}
                    onChange={(next) => updateChecklist(patrol.slot, next)}
                  />

                  <p className="label mt-4">Notes</p>
                  <textarea
                    value={draft?.notes || ''}
                    onChange={(e) => setDrafts((d) => ({ ...d, [patrol.slot]: { ...d[patrol.slot], notes: e.target.value } }))}
                    rows={2}
                    className="input"
                    placeholder="Anything to note…"
                  />

                  <button
                    onClick={() => completePatrol(patrol.slot)}
                    disabled={busyId === `complete-${patrol.slot}`}
                    className="btn-primary mt-4 w-full"
                  >
                    <CheckCircle2 size={18} /> Complete Patrol
                  </button>
                </div>
              )}

              {done && patrol.notes && (
                <p className="mt-3 rounded-xl p-3 text-sm" style={{ backgroundColor: 'rgb(var(--surface-2))', color: 'rgb(var(--ink-2))' }}>
                  “{patrol.notes}”
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Quick incident entry */}
      <div className="card">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle size={18} className="text-rose-500" />
          <h3 className="font-bold">Quick Incident Log</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <label className="label">Type</label>
            <select
              value={quick.incident_type}
              onChange={(e) => setQuick({ ...quick, incident_type: e.target.value })}
              className="input"
            >
              {INCIDENT_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Location</label>
            <input
              value={quick.location}
              onChange={(e) => setQuick({ ...quick, location: e.target.value })}
              className="input"
              placeholder="Room 312, North Lot…"
            />
          </div>
          <div>
            <label className="label">Details</label>
            <input
              value={quick.details}
              onChange={(e) => setQuick({ ...quick, details: e.target.value })}
              className="input"
              placeholder="Brief summary…"
            />
          </div>
        </div>
        <button
          onClick={logQuickIncident}
          disabled={busyId === 'quick-incident'}
          className="btn mt-3 w-full md:w-auto"
          style={{ backgroundColor: 'rgb(var(--a-600))', color: 'white' }}
        >
          {busyId === 'quick-incident' ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} Log Incident
        </button>
      </div>

      {/* End shift */}
      {shift.status === 'active' && (
        <button onClick={() => setEndModal(true)} className="btn-danger w-full" disabled={busyId === 'end'}>
          <LogOut size={16} /> End Shift
        </button>
      )}

      <Modal open={endModal} onClose={() => setEndModal(false)} title="End Shift">
        <p className="mb-3 text-sm" style={{ color: 'rgb(var(--muted))' }}>
          <Clock size={14} className="mr-1 inline" />
          Shift started at {formatClock(shift.started_at)} · {completed}/{total} patrols completed.
        </p>
        <label className="label">Shift notes (optional)</label>
        <textarea value={endNotes} onChange={(e) => setEndNotes(e.target.value)} rows={3} className="input" />
        <button onClick={endShift} className="btn-danger mt-4 w-full" disabled={busyId === 'end'}>
          <LogOut size={16} /> Confirm End of Shift
        </button>
      </Modal>
    </div>
  );
}

function StartShiftCard({ sites, selectedSiteId, setSelectedSiteId, onStart, busy, settings }) {
  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <p className="text-sm" style={{ color: 'rgb(var(--muted))' }}>
          {today}
        </p>
        <h2 className="mt-1 text-2xl font-bold">Start a shift</h2>
        <p className="mt-1 text-sm" style={{ color: 'rgb(var(--muted))' }}>
          {settings.officer_name || 'Security Officer'}
          {settings.badge_no ? ` · Badge #${settings.badge_no}` : ''}
        </p>

        {sites.length > 0 ? (
          <>
            <label className="label mt-5">Work site / location</label>
            <div className="relative">
              <Building2 size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--faint))' }} />
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="input pl-9"
              >
                <option value="">Select a site…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.site_name}
                    {s.company_name ? ` — ${s.company_name}` : ''} ({s.patrol_count} patrols)
                  </option>
                ))}
              </select>
            </div>
            <button onClick={onStart} disabled={busy} className="btn-primary mt-4 w-full">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />} Start Shift
            </button>
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: 'rgb(var(--line-strong))', color: 'rgb(var(--muted))' }}>
            No sites configured yet. Add your first site in Settings → Sites &amp; Locations to enable shift tracking.
          </div>
        )}
      </div>

      <div className="card text-sm" style={{ color: 'rgb(var(--muted))' }}>
        <p className="font-bold" style={{ color: 'rgb(var(--ink))' }}>
          How it works
        </p>
        <ul className="mt-2 space-y-1.5">
          <li>• Pick the site you are working today</li>
          <li>• Patrols are created automatically from the site's patrol plan</li>
          <li>• Build each patrol's checkpoint list as you go — add, edit, reorder, delete</li>
          <li>• Log incidents with photos and voice memos</li>
          <li>• Generate AI reports at the end of your shift</li>
        </ul>
      </div>
    </div>
  );
}

function CompletedShiftSummary({ shift, onUpdate }) {
  const completed = shift.patrols.filter((p) => p.completed_at).length;
  const total = shift.patrols.length;
  return (
    <div className="card">
      <div className="flex items-start gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-2.5 text-emerald-600 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-400">
          <ShieldCheck size={20} />
        </div>
        <div className="min-w-0">
          <p className="font-bold">Shift completed · {shift.site_name}</p>
          <p className="mt-0.5 text-xs" style={{ color: 'rgb(var(--muted))' }}>
            {shift.officer_name} · started{' '}
            <EditableTimestamp
              value={shift.started_at}
              onSave={async (iso) => onUpdate(await api.updateShift(shift.id, { started_at: iso }))}
            />
            {shift.ended_at ? (
              <>
                {' '}· ended{' '}
                <EditableTimestamp
                  value={shift.ended_at}
                  onSave={async (iso) => onUpdate(await api.updateShift(shift.id, { ended_at: iso }))}
                />
              </>
            ) : null}
          </p>
          <p className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
            {completed}/{total} patrols completed
          </p>
        </div>
      </div>
    </div>
  );
}