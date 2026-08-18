import { useCallback, useEffect, useState } from 'react';
import { BrainCircuit, Plus, Pencil, Trash2, Star, StarOff, Plug, Loader2, CheckCircle2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../Toast.jsx';
import Modal from '../Modal.jsx';

const MASK = '••••••••';

const emptyForm = () => ({
  name: '',
  endpoint: '',
  api_key: '',
  model_name: '',
  temperature: 0.4,
  is_default: false,
});

export default function LlmProfilesManager() {
  const toast = useToast();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState(null);

  const load = useCallback(async () => {
    try {
      setProfiles(await api.llm.list());
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(p) {
    setEditing(p);
    setForm({
      name: p.name,
      endpoint: p.endpoint,
      api_key: p.api_key || '',
      model_name: p.model_name,
      temperature: p.temperature,
      is_default: Boolean(p.is_default),
    });
    setOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast('Profile name is required', 'error');
    setSaving(true);
    try {
      if (editing) {
        await api.llm.update(editing.id, form);
        toast('Profile updated', 'success');
      } else {
        await api.llm.create(form);
        toast('Profile added', 'success');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(p) {
    try {
      await api.llm.setDefault(p.id);
      toast(`"${p.name}" is now the default`, 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function test(p) {
    setTestingId(p.id);
    try {
      const r = await api.llm.test(p.id);
      toast(`Connected — model: ${r.model}`, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setTestingId(null);
    }
  }

  async function remove(p) {
    if (!confirm(`Delete LLM profile "${p.name}"?`)) return;
    try {
      await api.llm.remove(p.id);
      toast('Profile deleted', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BrainCircuit size={18} className="text-accent-600 dark:text-accent-400" />
          <h3 className="font-bold">AI Profiles</h3>
        </div>
        <button onClick={openAdd} className="btn-primary px-3 py-2">
          <Plus size={15} /> Add Profile
        </button>
      </div>

      {loading && <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}

      {!loading && profiles.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: 'rgb(var(--line-strong))', color: 'rgb(var(--muted))' }}>
          No AI profiles yet. Add one (OpenRouter, local Ollama, LM Studio…) to enable report generation.
        </p>
      )}

      <div className="space-y-2">
        {profiles.map((p) => (
          <div key={p.id} className="flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'rgb(var(--line))' }}>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-bold">{p.name}</p>
                {Boolean(p.is_default) && (
                  <span className="chip" style={{ backgroundColor: 'rgb(var(--a-500) / 0.12)', borderColor: 'rgb(var(--a-500) / 0.35)', color: 'rgb(var(--a-700))' }}>
                    <Star size={11} /> Default
                  </span>
                )}
              </div>
              <p className="truncate text-xs" style={{ color: 'rgb(var(--muted))' }}>
                {p.model_name || 'No model'} · {p.endpoint || 'No endpoint'}
                {typeof p.temperature === 'number' ? ` · temp ${p.temperature}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1">
              <button onClick={() => setDefault(p)} className="btn-outline px-2.5 py-1.5 text-xs" disabled={Boolean(p.is_default)} title="Set as default">
                {Boolean(p.is_default) ? <StarOff size={14} /> : <Star size={14} />} Default
              </button>
              <button onClick={() => test(p)} className="btn-outline px-2.5 py-1.5 text-xs" disabled={testingId === p.id}>
                {testingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <Plug size={14} />} Test
              </button>
              <button onClick={() => openEdit(p)} className="btn-outline px-2.5 py-1.5 text-xs">
                <Pencil size={14} /> Edit
              </button>
              <button onClick={() => remove(p)} className="rounded-xl border px-2.5 py-1.5 text-xs font-semibold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" style={{ borderColor: 'rgb(var(--line))' }}>
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit AI Profile' : 'Add AI Profile'} wide>
        <div className="space-y-4">
          <div>
            <label className="label">Profile Label</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Local Ollama - Qwen 14B" />
          </div>
          <div>
            <label className="label">API Endpoint</label>
            <input value={form.endpoint} onChange={(e) => setForm({ ...form, endpoint: e.target.value })} className="input" placeholder="https://openrouter.ai/api/v1 or http://localhost:11434/v1" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">API Key</label>
              <input
                type="password"
                value={form.api_key}
                onChange={(e) => setForm({ ...form, api_key: e.target.value })}
                className="input"
                placeholder={editing && form.api_key === MASK ? 'Unchanged' : 'sk-… (blank for local LLM)'}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="label">Model Name</label>
              <input value={form.model_name} onChange={(e) => setForm({ ...form, model_name: e.target.value })} className="input" placeholder="deepseek/deepseek-chat or qwen2.5:14b" />
            </div>
          </div>
          <div>
            <label className="label">Temperature ({form.temperature})</label>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.1"
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: Number(e.target.value) })}
              className="w-full accent-[rgb(var(--a-600))]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
              className="h-4 w-4 rounded accent-[rgb(var(--a-600))]"
            />
            Set as active / default profile
            {form.is_default && <CheckCircle2 size={15} className="text-accent-600 dark:text-accent-400" />}
          </label>

          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-outline flex-1">
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {editing ? 'Save Changes' : 'Add Profile'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}