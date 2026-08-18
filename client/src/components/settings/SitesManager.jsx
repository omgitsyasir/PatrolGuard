import { useCallback, useEffect, useState } from 'react';
import { Building2, MapPin, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../Toast.jsx';
import Modal from '../Modal.jsx';
import { defaultPatrolNames } from '../../lib/format.js';

const emptyForm = () => ({ company_name: '', site_name: '', patrol_count: 3, patrol_names: defaultPatrolNames(3) });

export default function SitesManager() {
  const toast = useToast();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setSites(await api.sites.list());
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

  function openEdit(site) {
    setEditing(site);
    setForm({
      company_name: site.company_name,
      site_name: site.site_name,
      patrol_count: site.patrol_count,
      patrol_names: [...site.patrol_names],
    });
    setOpen(true);
  }

  function setCount(n) {
    const count = Math.min(8, Math.max(2, Number(n) || 3));
    setForm((f) => {
      const names = [];
      const defaults = defaultPatrolNames(count);
      for (let i = 0; i < count; i++) names.push(f.patrol_names[i] || defaults[i]);
      return { ...f, patrol_count: count, patrol_names: names };
    });
  }

  function setPatrolName(i, value) {
    setForm((f) => {
      const names = [...f.patrol_names];
      names[i] = value;
      return { ...f, patrol_names: names };
    });
  }

  async function save() {
    if (!form.site_name.trim()) return toast('Site name is required', 'error');
    setSaving(true);
    try {
      if (editing) {
        await api.sites.update(editing.id, form);
        toast('Site updated', 'success');
      } else {
        await api.sites.create(form);
        toast('Site added', 'success');
      }
      setOpen(false);
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove(site) {
    if (!confirm(`Delete site "${site.site_name}"? Past shifts will keep their site name.`)) return;
    try {
      await api.sites.remove(site.id);
      toast('Site deleted', 'success');
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Building2 size={18} className="text-accent-600 dark:text-accent-400" />
          <h3 className="font-bold">Sites &amp; Locations</h3>
        </div>
        <button onClick={openAdd} className="btn-primary px-3 py-2">
          <Plus size={15} /> Add Site
        </button>
      </div>

      {loading && <div className="h-20 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}

      {!loading && sites.length === 0 && (
        <p className="rounded-xl border border-dashed p-4 text-sm" style={{ borderColor: 'rgb(var(--line-strong))', color: 'rgb(var(--muted))' }}>
          No sites yet. Add your first property to start tracking shifts.
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {sites.map((s) => (
          <div key={s.id} className="rounded-xl border p-3" style={{ borderColor: 'rgb(var(--line))' }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{s.site_name}</p>
                <p className="text-xs" style={{ color: 'rgb(var(--muted))' }}>
                  <MapPin size={12} className="mr-0.5 inline" />
                  {s.company_name || 'Company not set'}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => openEdit(s)} className="rounded-lg p-1.5 hover:opacity-70" style={{ color: 'rgb(var(--muted))' }}>
                  <Pencil size={15} />
                </button>
                <button onClick={() => remove(s)} className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs" style={{ color: 'rgb(var(--muted))' }}>
              {s.patrol_count} patrols per shift
            </p>
            <div className="mt-2 flex flex-wrap gap-1">
              {s.patrol_names.map((n, i) => (
                <span key={i} className="chip" style={{ backgroundColor: 'rgb(var(--a-500) / 0.1)', borderColor: 'rgb(var(--a-500) / 0.3)', color: 'rgb(var(--a-700))' }}>
                  {n}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'Edit Site' : 'Add Site'} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Company Name</label>
              <input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} className="input" placeholder="e.g. NightHawk Security" />
            </div>
            <div>
              <label className="label">Site / Property Name</label>
              <input value={form.site_name} onChange={(e) => setForm({ ...form, site_name: e.target.value })} className="input" placeholder="e.g. Grand Meridian Hotel" />
            </div>
          </div>

          <div>
            <label className="label">Patrols per Shift ({form.patrol_count})</label>
            <input type="range" min="2" max="8" value={form.patrol_count} onChange={(e) => setCount(e.target.value)} className="w-full accent-[rgb(var(--a-600))]" />
            <div className="flex justify-between text-[11px]" style={{ color: 'rgb(var(--faint))' }}>
              <span>2</span>
              <span>8</span>
            </div>
          </div>

          <div>
            <label className="label">Patrol Names</label>
            <div className="space-y-2">
              {form.patrol_names.map((n, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-semibold" style={{ color: 'rgb(var(--faint))' }}>
                    {i + 1}.
                  </span>
                  <input
                    value={n}
                    onChange={(e) => setPatrolName(i, e.target.value)}
                    className="input"
                    placeholder={`Patrol ${i + 1}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setOpen(false)} className="btn-outline flex-1">
              Cancel
            </button>
            <button onClick={save} disabled={saving} className="btn-primary flex-1">
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {editing ? 'Save Changes' : 'Add Site'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}