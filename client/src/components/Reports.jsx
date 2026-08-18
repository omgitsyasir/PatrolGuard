import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Copy, Check, Trash2, ShieldAlert, RefreshCw, BrainCircuit } from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import Modal from './Modal.jsx';
import { copyText, formatInstant } from '../lib/format.js';

function ReportPreview({ report, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await copyText(report.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <Modal open onClose={onClose} title={report.title} wide>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs" style={{ color: 'rgb(var(--muted))' }}>
        <span className="chip" style={{ backgroundColor: 'rgb(var(--surface-2))', borderColor: 'rgb(var(--line))' }}>
          {report.kind.toUpperCase()}
        </span>
        <span>{report.model}</span>
        <span>· {formatInstant(report.created_at, { year: true })}</span>
      </div>
      <pre
        className="max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl p-4 font-mono text-[13px] leading-relaxed"
        style={{ backgroundColor: 'rgb(var(--header))', color: 'rgb(var(--header-text))' }}
      >
        {report.content}
      </pre>
      <button onClick={copy} className="btn-primary mt-4 w-full">
        {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied!' : 'Copy to Clipboard'}
      </button>
    </Modal>
  );
}

export default function Reports() {
  const toast = useToast();
  const [reports, setReports] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [incidents, setIncidents] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);

  const [darShift, setDarShift] = useState('');
  const [incidentId, setIncidentId] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, s, i, p] = await Promise.all([
        api.get('/api/reports'),
        api.get('/api/shifts'),
        api.get('/api/incidents'),
        api.llm.list(),
      ]);
      setReports(r);
      setShifts(s);
      setIncidents(i);
      setProfiles(p);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedProfileId) {
      const def = profiles.find((x) => x.is_default) || profiles[0];
      if (def) setSelectedProfileId(String(def.id));
    }
  }, [profiles, selectedProfileId]);

  useEffect(() => {
    if (shifts.length && !darShift) setDarShift(String(shifts[0].id));
    if (incidents.length && !incidentId) setIncidentId(String(incidents[0].id));
  }, [shifts, incidents, darShift, incidentId]);

  const selectedProfile = profiles.find((p) => String(p.id) === String(selectedProfileId));

  async function generateDar() {
    if (!darShift) return toast('Select a shift first', 'error');
    setBusy('dar');
    try {
      const report = await api.post('/api/reports/dar', { shift_id: Number(darShift), llm_profile_id: Number(selectedProfileId) });
      setPreview(report);
      setReports((r) => [report, ...r]);
      toast('DAR generated', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function generateIncident() {
    if (!incidentId) return toast('Select an incident first', 'error');
    setBusy('incident');
    try {
      const report = await api.post('/api/reports/incident', { incident_id: Number(incidentId), llm_profile_id: Number(selectedProfileId) });
      setPreview(report);
      setReports((r) => [report, ...r]);
      toast('Incident report generated', 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeReport(id) {
    try {
      await api.del(`/api/reports/${id}`);
      setReports((r) => r.filter((x) => x.id !== id));
      toast('Report deleted', 'success');
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="space-y-4">
      {/* LLM profile selector */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BrainCircuit size={18} className="text-accent-600 dark:text-accent-400" />
            <h3 className="font-bold">AI Profile</h3>
          </div>
          {selectedProfile && (
            <span className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
              {selectedProfile.model_name || 'No model'} ·{' '}
              <span className="font-semibold" style={{ color: 'rgb(var(--ink))' }}>
                {selectedProfile.name}
              </span>
            </span>
          )}
        </div>
        <select value={selectedProfileId} onChange={(e) => setSelectedProfileId(e.target.value)} className="input mt-3">
          {profiles.length === 0 && <option value="">No AI profiles — add one in Settings</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} {p.is_default ? ' (Default)' : ''} — {p.model_name || 'no model'}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Generate DAR */}
        <div className="card" style={{ borderColor: 'rgb(var(--a-500) / 0.45)' }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border p-2.5 text-accent-600 dark:text-accent-400" style={{ backgroundColor: 'rgb(var(--a-500) / 0.1)', borderColor: 'rgb(var(--a-500) / 0.3)' }}>
              <FileText size={20} />
            </div>
            <div>
              <p className="font-bold">Generate Shift DAR</p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                Daily Activity Report from patrol logs + incidents
              </p>
            </div>
          </div>
          <select value={darShift} onChange={(e) => setDarShift(e.target.value)} className="input mt-3">
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                Shift #{s.id} · {s.site_name || s.date} · {s.date} {s.status === 'completed' ? '✓' : ''}
              </option>
            ))}
          </select>
          <button onClick={generateDar} disabled={busy === 'dar' || shifts.length === 0 || !selectedProfileId} className="btn-primary mt-2 w-full">
            {busy === 'dar' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Generate DAR
          </button>
        </div>

        {/* Generate incident report */}
        <div className="card" style={{ borderColor: 'rgb(var(--a-500) / 0.45)' }}>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border p-2.5 text-accent-600 dark:text-accent-400" style={{ backgroundColor: 'rgb(var(--a-500) / 0.1)', borderColor: 'rgb(var(--a-500) / 0.3)' }}>
              <ShieldAlert size={20} />
            </div>
            <div>
              <p className="font-bold">Generate Incident Report</p>
              <p className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                Formal 5Ws security report (Who, What, Where, When, Why/How)
              </p>
            </div>
          </div>
          <select value={incidentId} onChange={(e) => setIncidentId(e.target.value)} className="input mt-3">
            {incidents.map((i) => (
              <option key={i.id} value={i.id}>
                #{i.id} · {i.incident_type} · {i.location}
              </option>
            ))}
          </select>
          <button onClick={generateIncident} disabled={busy === 'incident' || incidents.length === 0 || !selectedProfileId} className="btn-primary mt-2 w-full">
            {busy === 'incident' ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} Generate Report
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-bold">Report History</h3>
          <button onClick={load} className="rounded-lg p-1.5 hover:opacity-70" style={{ color: 'rgb(var(--faint))' }} title="Refresh">
            <RefreshCw size={16} />
          </button>
        </div>
        {loading && <div className="h-24 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />}
        {!loading && reports.length === 0 && <p className="py-6 text-center text-sm" style={{ color: 'rgb(var(--faint))' }}>No reports yet.</p>}
        {reports.map((r) => (
          <div key={r.id} className="card mb-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold">{r.title}</p>
                <p className="text-xs" style={{ color: 'rgb(var(--faint))' }}>
                  {formatInstant(r.created_at, { year: true })} · {r.model}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  onClick={async () => {
                    await copyText(r.content);
                    toast('Copied to clipboard', 'success');
                  }}
                  className="rounded-lg p-2 hover:opacity-70"
                  style={{ color: 'rgb(var(--muted))' }}
                  title="Copy"
                >
                  <Copy size={16} />
                </button>
                <button onClick={() => setPreview(r)} className="rounded-lg p-2 hover:opacity-70" style={{ color: 'rgb(var(--muted))' }} title="View">
                  <FileText size={16} />
                </button>
                <button onClick={() => removeReport(r.id)} className="rounded-lg p-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}