import { useState } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, Check, Clock } from 'lucide-react';
import { useToast } from './Toast.jsx';
import EditableTimestamp from './EditableTimestamp.jsx';

// Editable, reorderable checkpoint checklist with per-item check-in timestamps.
export default function CheckpointList({ items = [], onChange }) {
  const toast = useToast();
  const [addName, setAddName] = useState('');
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  function persist(next) {
    setAddName('');
    onChange(next);
  }

  function toggle(i) {
    const c = items[i];
    persist(items.map((x, j) => (j === i ? { ...x, ok: !x.ok, checked_at: !x.ok ? new Date().toISOString() : null } : x)));
  }

  function move(i, dir) {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    persist(next);
  }

  function remove(i) {
    persist(items.filter((_, j) => j !== i));
  }

  function commitRename(i) {
    const name = renameValue.trim();
    if (name && name !== items[i].name) {
      persist(items.map((x, j) => (j === i ? { ...x, name } : x)));
    }
    setRenaming(null);
  }

  function add() {
    const name = addName.trim();
    if (!name) return toast('Checkpoint name is required', 'error');
    persist([...items, { name, ok: false, checked_at: null }]);
  }

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="rounded-xl border border-dashed p-3 text-xs" style={{ borderColor: 'rgb(var(--line-strong))', color: 'rgb(var(--faint))' }}>
          No checkpoints yet. Add one below.
        </p>
      )}

      {items.map((c, i) => (
        <div
          key={`${c.name}-${i}`}
          className="rounded-xl border px-2.5 py-2"
          style={{
            borderColor: c.ok ? 'rgb(16 185 129 / 0.45)' : 'rgb(var(--line))',
            backgroundColor: c.ok ? 'rgb(16 185 129 / 0.08)' : 'rgb(var(--surface-2))',
          }}
        >
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <button
              type="button"
              onClick={() => toggle(i)}
              className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border transition ${
                c.ok ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-[rgb(var(--line-strong))]'
              }`}
              title={c.ok ? 'Mark not checked' : 'Mark checked'}
            >
              {c.ok && <Check size={14} />}
            </button>

            {renaming === i ? (
              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => commitRename(i)}
                onKeyDown={(e) => e.key === 'Enter' && commitRename(i)}
                className="input !min-w-0 flex-1 !px-2 !py-1 text-xs"
                autoFocus
              />
            ) : (
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{c.name}</span>
            )}

            <div className="flex shrink-0 items-center gap-0.5">
              <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="rounded p-1 hover:opacity-70 disabled:opacity-30" style={{ color: 'rgb(var(--muted))' }} title="Move up">
                <ArrowUp size={13} />
              </button>
              <button type="button" onClick={() => move(i, 1)} disabled={i === items.length - 1} className="rounded p-1 hover:opacity-70 disabled:opacity-30" style={{ color: 'rgb(var(--muted))' }} title="Move down">
                <ArrowDown size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenaming(i);
                  setRenameValue(c.name);
                }}
                className="rounded p-1 hover:opacity-70"
                style={{ color: 'rgb(var(--muted))' }}
                title="Rename checkpoint"
              >
                <Pencil size={13} />
              </button>
              <button type="button" onClick={() => remove(i)} className="rounded p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Delete checkpoint">
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          <div className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: 'rgb(var(--faint))' }}>
            <Clock size={11} />
            <span className="mr-1">Checked in:</span>
            <EditableTimestamp
              value={c.checked_at}
              onSave={(iso) => persist(items.map((x, j) => (j === i ? { ...x, checked_at: iso } : x)))}
              emptyLabel="not checked"
            />
          </div>
        </div>
      ))}

      {/* Inline add */}
      <div className="flex items-center gap-2">
        <input
          value={addName}
          onChange={(e) => setAddName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          className="input !min-w-0 flex-1 !px-2 !py-1.5 text-xs"
          placeholder="Add checkpoint…"
        />
        <button type="button" onClick={add} className="btn-primary shrink-0 px-3 py-1.5 text-xs">
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}