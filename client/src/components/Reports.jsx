import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2, Copy, Check, Trash2, ShieldAlert, RefreshCw, BrainCircuit, Send, Eye } from 'lucide-react';
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

// Review/edit the exact prompt before it is sent to the LLM.
function PromptModal({ preview, busy, onSend, onClose }) {
  const [system, setSystem] = useState(preview.system);
  const [user, setUser] = useState(preview.user);
  const [showContext, setShowContext] = useState(false);

  return (
    <Modal open onClose={onClose} title={preview.kind === 'dar' ? 'Review DAR prompt' : 'Review incident prompt'} wide>
      <p className="mb-3 text-sm" style={{ color: 'rgb(var(--muted))' }}>
        This is the exact prompt that will be sent to the AI model. Edit either field before sending.
      </p>

      <label className="label">System prompt</label>
      <textarea value={system} onChange={(e) => setSystem(e.target.value)} rows={6} className="input font-mono text-xs" />

      <label className="label mt-3">User prompt</label>
      <textarea value={user} onChange={(e) => setUser(e.target.value)} rows={10} className="input font-mono text-xs" />

      <button
        type="button"
        onClick={() => setShowContext((v) => !v)}
        className="mt-3 flex items-center gap-1 text-xs font-semibold"
        style={{ color: 'rgb(var(--a-700))' }}
      >
        <Eye size={14} /> {showContext ? 'Hide' : 'Show'} raw shift data being sent
      </button>
      {showContext && (
        <pre
          className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl p-3 font-mono text-[11px] leading-relaxed"
          style={{ backgroundColor: 'rgb(var(--header))', color: 'rgb(var(--header-text))' }}
        >
          {preview.context}
        </pre>
      )}

      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="btn-outline flex-1" disabled={busy}>
          Cancel
        </button>
        <button onClick={() => onSend({ system, user })} disabled={busy} className="btn-primary flex-1">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Send to AI
        </button>
      </div>
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
  const selectedProfile = profiles.find((p) => String(p.id) === String(selectedProfileId));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const [prompt, setPrompt] = useState(null);

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

  async function prepareDar() {
    if (!darShift) return toast('Select a shift first', 'error');
    if (!selectedProfileId) return toast('Select an AI profile first', 'error');
    setBusy('dar');
    try {
      const p = await api.previewReport('dar', { shift_id: Number(darShift) });
      setPrompt({ ...p, kind: 'dar' });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function prepareIncident() {
    if (!incidentId) return toast('Select an incident first', 'error');
    if (!selectedProfileId) return toast('Select an AI profile first', 'error');
    setBusy('incident');
    try {
      const p = await api.previewReport('incident', { incident_id: Number(incidentId) });
      setPrompt({ ...p, kind: 'incident' });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function sendPrompt(overrides) {
    const p = prompt;
    setBusy(p.kind);
    try {
      const body = {
        llm_profile_id: Number(selectedProfileId),
        system: overrides.system,
        user: overrides.user,
      };
      if (p.kind === 'dar') body.shift_id = p.shift_id;
      else body.incident_id = p.incident_id;

      const report = await api.post(`/api/reports/${p.kind}`, body);
      setPrompt(null);
      setPreview(report);
      setReports((r) => [report, ...r]);
      toast(p.kind === 'dar' ? 'DAR generated' : 'Incident report generated', 'success');
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
          <button onClick={prepareDar} disabled={busy === 'dar' || shifts.length === 0 || !selectedProfileId} className="btn-primary mt-2 w-full">
            {busy === 'dar' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Review & Generate DAR
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
          <button onClick={prepareIncident} disabled={busy === 'incident' || incidents.length === 0 || !selectedProfileId} className="btn-primary mt-2 w-full">
            {busy === 'incident' ? <Loader2 size={16} className="animate-spin" /> : <ShieldAlert size={16} />} Review & Generate Report
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

      {prompt && <PromptModal preview={prompt} busy={busy === 'dar' || busy === 'incident'} onSend={sendPrompt} onClose={() => setPrompt(null)} />}
      {preview && <ReportPreview report={preview} onClose={() => setPreview(null)} />}
    </div>
  );
}