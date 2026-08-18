export function formatInstant(iso, opts = {}) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: opts.year ? 'numeric' : undefined,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDuration(start, end) {
  if (!start || !end) return '—';
  const mins = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  return `${h}h ${mins % 60}m`;
}

export function formatClock(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d)) return '—';
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
}

export function toLocalInputValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function nowLocalInputValue() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const STATUS_META = {
  all_clear: { label: 'All Clear / Normal', classes: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  minor_issues: { label: 'Minor Issues', classes: 'bg-amber-100 text-amber-700 border-amber-200' },
  requires_action: { label: 'Requires Action', classes: 'bg-rose-100 text-rose-700 border-rose-200' },
};

export const INCIDENT_TYPES = [
  'Guest Disturbance',
  'Noise Complaint',
  'Medical Emergency',
  'Fire / Smoke',
  'Water Leak',
  'Theft / Lost Property',
  'Suspicious Person',
  'Property Damage',
  'Safety Hazard',
  'Unauthorized Access',
  'Parking Issue',
  'Other',
];

export const CHECKPOINTS = ['Fire Exits', 'Pool Area', 'Parking Lot', 'Hallway Noise'];

export function defaultPatrolNames(n) {
  const names = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) names.push('Start of Shift');
    else if (i === n - 1) names.push('End of Shift');
    else if (n === 3) names.push('Mid-Shift');
    else names.push(`Patrol ${i + 1}`);
  }
  return names;
}

export function isImage(url) {
  return /\.(jpe?g|png|gif|webp|bmp|heic)$/i.test(url.split('?')[0]);
}

export function copyText(text) {
  if (navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(text);
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  document.body.appendChild(ta);
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
  return Promise.resolve();
}
