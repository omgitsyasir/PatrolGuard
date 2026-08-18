import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Plus,
  MapPin,
  Clock,
  Camera,
  ImagePlus,
  X,
  Loader2,
  Mic,
  ChevronRight,
  Trash2,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from './Toast.jsx';
import Modal from './Modal.jsx';
import AudioRecorder from './AudioRecorder.jsx';
import { formatInstant, INCIDENT_TYPES, nowLocalInputValue, isImage } from '../lib/format.js';

export default function Incidents() {
  const toast = useToast();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    incident_type: INCIDENT_TYPES[0],
    occurred_at: nowLocalInputValue(),
    location: '',
    details: '',
  });
  const [photoFiles, setPhotoFiles] = useState([]);
  const [voiceBlob, setVoiceBlob] = useState(null);
  const [uploading, setUploading] = useState(false);
  const photoInputRef = useRef(null);

  const load = useCallback(async () => {
    try {
      setIncidents(await api.get('/api/incidents'));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  function resetForm() {
    setForm({
      incident_type: INCIDENT_TYPES[0],
      occurred_at: nowLocalInputValue(),
      location: '',
      details: '',
    });
    setPhotoFiles([]);
    setVoiceBlob(null);
  }

  function openForm() {
    resetForm();
    setShowForm(true);
  }

  function addPhotos(e) {
    const files = Array.from(e.target.files || []);
    setPhotoFiles((p) => [...p, ...files].slice(0, 10));
    e.target.value = '';
  }

  async function submit() {
    if (!form.location.trim()) return toast('Location is required', 'error');
    if (!form.occurred_at) return toast('Timestamp is required', 'error');

    setSaving(true);
    setUploading(true);
    try {
      const media = [];
      if (voiceBlob) {
        const name = `voice-${Date.now()}.webm`;
        media.push(...(await api.uploadFiles([new File([voiceBlob], name, { type: 'audio/webm' })])));
      }
      if (photoFiles.length) {
        media.push(...(await api.uploadFiles(photoFiles)));
      }
      setUploading(false);

      await api.post('/api/incidents', {
        incident_type: form.incident_type,
        occurred_at: new Date(form.occurred_at).toISOString(),
        location: form.location,
        details: form.details,
        media,
      });
      toast('Incident logged', 'success');
      setShowForm(false);
      resetForm();
      load();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
      setUploading(false);
    }
  }

  async function removeIncident(id) {
    if (!confirm('Delete this incident?')) return;
    try {
      await api.del(`/api/incidents/${id}`);
      toast('Incident deleted', 'success');
      setSelected(null);
      load();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  return (
    <div className="space-y-3">
      <button onClick={openForm} className="btn-primary w-full py-3">
        <Plus size={18} /> New Incident
      </button>

      {loading && <div className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />}

      {!loading && incidents.length === 0 && (
        <div className="card py-10 text-center text-sm" style={{ color: 'rgb(var(--faint))' }}>
          <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'rgb(var(--faint))' }} />
          No incidents logged yet.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {incidents.map((inc) => (
          <button key={inc.id} onClick={() => setSelected(inc)} className="card w-full text-left transition hover:border-[rgb(var(--a-500))]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-rose-50 p-1.5 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400">
                  <AlertTriangle size={16} />
                </span>
                <p className="truncate font-bold">{inc.incident_type}</p>
              </div>
              <ChevronRight size={18} style={{ color: 'rgb(var(--faint))' }} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs" style={{ color: 'rgb(var(--muted))' }}>
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {inc.location}
              </span>
              <span className="inline-flex items-center gap-1">
                <Clock size={12} /> {formatInstant(inc.occurred_at)}
              </span>
              {inc.media.length > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Camera size={12} /> {inc.media.length} media
                </span>
              )}
            </div>
            {inc.details && <p className="mt-2 line-clamp-2 text-sm" style={{ color: 'rgb(var(--ink-2))' }}>{inc.details}</p>}
          </button>
        ))}
      </div>

      {/* New incident modal */}
      <Modal open={showForm} onClose={() => !saving && setShowForm(false)} title="New Incident" wide>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Incident Type</label>
              <select value={form.incident_type} onChange={(e) => setForm({ ...form, incident_type: e.target.value })} className="input">
                {INCIDENT_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Exact Timestamp</label>
              <input type="datetime-local" value={form.occurred_at} onChange={(e) => setForm({ ...form, occurred_at: e.target.value })} className="input" />
            </div>
          </div>

          <div>
            <label className="label">Location</label>
            <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} className="input" placeholder="Room 312, 4th Floor, North Lot…" />
          </div>

          <div>
            <label className="label">Details</label>
            <textarea value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} rows={3} className="input" placeholder="Describe what happened…" />
          </div>

          {/* Photos */}
          <div>
            <label className="label">Photo Attachments</label>
            <input ref={photoInputRef} type="file" accept="image/*" multiple hidden onChange={addPhotos} />
            {photoFiles.length === 0 ? (
              <button type="button" onClick={() => photoInputRef.current?.click()} className="btn-outline w-full border-dashed py-4">
                <ImagePlus size={18} /> Add photos
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {photoFiles.map((f, i) => (
                  <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border" style={{ borderColor: 'rgb(var(--line))' }}>
                    <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => setPhotoFiles((p) => p.filter((_, j) => j !== i))} className="absolute right-1 top-1 rounded-full bg-slate-900/70 p-1 text-white">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" onClick={() => photoInputRef.current?.click()} className="btn-outline h-20 w-20 border-dashed">
                  <ImagePlus size={18} />
                </button>
              </div>
            )}
          </div>

          {/* Voice memo */}
          <div>
            <label className="label">
              <Mic size={12} className="mr-1 inline" /> Voice Memo
            </label>
            <AudioRecorder onRecording={setVoiceBlob} />
          </div>

          <div className="flex gap-2">
            <button onClick={() => !saving && setShowForm(false)} className="btn-outline flex-1">
              Cancel
            </button>
            <button onClick={submit} disabled={saving || uploading} className="btn-primary flex-1">
              {saving ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> {uploading ? 'Uploading…' : 'Saving…'}
                </>
              ) : (
                'Log Incident'
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title="Incident Details" wide>
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl p-3" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
              <div className="flex items-center justify-between">
                <p className="font-bold">{selected.incident_type}</p>
                <span className="chip" style={{ backgroundColor: 'rgb(244 63 94 / 0.1)', borderColor: 'rgb(244 63 94 / 0.3)', color: 'rgb(244 63 94)' }}>
                  #{selected.id}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-sm" style={{ color: 'rgb(var(--ink-2))' }}>
                <p className="flex items-center gap-2">
                  <Clock size={14} style={{ color: 'rgb(var(--faint))' }} /> {formatInstant(selected.occurred_at, { year: true })}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={14} style={{ color: 'rgb(var(--faint))' }} /> {selected.location}
                </p>
              </div>
            </div>

            {selected.details && <p className="text-sm" style={{ color: 'rgb(var(--ink-2))' }}>{selected.details}</p>}

            {selected.media.length > 0 && (
              <div>
                <p className="label">Attachments ({selected.media.length})</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {selected.media.map((m) =>
                    isImage(m) ? (
                      <img key={m} src={m} className="h-32 w-full rounded-xl border object-cover" style={{ borderColor: 'rgb(var(--line))' }} alt="" />
                    ) : (
                      <audio key={m} src={m} controls className="col-span-2 h-10 w-full rounded-xl" />
                    )
                  )}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <button onClick={() => removeIncident(selected.id)} className="btn-outline flex-1 text-rose-600">
                <Trash2 size={16} /> Delete
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}