import { useEffect, useState } from 'react';
import { Save, Loader2, User, BadgeCheck } from 'lucide-react';

export default function OfficerProfile({ settings, onSave }) {
  const [form, setForm] = useState({ officer_name: '', badge_no: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({ officer_name: settings.officer_name || '', badge_no: settings.badge_no || '' });
  }, [settings.officer_name, settings.badge_no]);

  async function save() {
    setSaving(true);
    const ok = await onSave({ officer_name: form.officer_name, badge_no: form.badge_no });
    setSaving(false);
    if (ok) setForm(form);
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center gap-2">
        <User size={18} className="text-accent-600 dark:text-accent-400" />
        <h3 className="font-bold">Officer Profile</h3>
      </div>
      <div className="space-y-3">
        <div>
          <label className="label">Officer Name</label>
          <div className="relative">
            <User size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--faint))' }} />
            <input value={form.officer_name} onChange={(e) => setForm({ ...form, officer_name: e.target.value })} className="input pl-9" placeholder="e.g. Marcus Reed" />
          </div>
        </div>
        <div>
          <label className="label">Badge / ID Number</label>
          <div className="relative">
            <BadgeCheck size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'rgb(var(--faint))' }} />
            <input value={form.badge_no} onChange={(e) => setForm({ ...form, badge_no: e.target.value })} className="input pl-9" placeholder="e.g. NR-2041" />
          </div>
        </div>
        <button onClick={save} disabled={saving} className="btn-primary w-full">
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Save Profile
        </button>
      </div>
    </div>
  );
}