import { useState } from 'react';
import { Pencil, Loader2, Check, X } from 'lucide-react';
import { formatClock, toLocalInputValue, localInputToIso } from '../lib/format.js';

export default function EditableTimestamp({ value, onSave, emptyLabel = '—', align = 'left' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  if (editing) {
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <input
          type="datetime-local"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          className="input !min-w-0 !px-2 !py-1 font-mono text-xs"
          autoFocus
        />
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            const iso = localInputToIso(draft);
            if (!iso) return setEditing(false);
            setSaving(true);
            try {
              await onSave(iso);
              setEditing(false);
            } catch {
              // Parent handler surfaces the error via toast.
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-lg p-1 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/10"
          title="Save time"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-lg p-1 hover:opacity-70"
          style={{ color: 'rgb(var(--faint))' }}
          title="Cancel"
        >
          <X size={13} />
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(toLocalInputValue(value));
        setEditing(true);
      }}
      className="group inline-flex items-center gap-1 font-mono hover:opacity-80"
      title="Click to edit date/time"
    >
      {value ? formatClock(value) : emptyLabel}
      <Pencil size={10} className="opacity-0 transition group-hover:opacity-60" />
    </button>
  );
}
