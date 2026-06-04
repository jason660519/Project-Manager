'use client';

import { useEffect, useState } from 'react';
import type { CommandAction, CommandMapping } from '../../../../../lib/types/channels';

const inputCls =
  'w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

export const COMMAND_ACTION_OPTIONS: { value: CommandAction; label: string; description: string }[] = [
  { value: 'help', label: 'help', description: 'List every enabled command' },
  { value: 'get_status', label: 'get_status', description: 'Project / feature status summary' },
  { value: 'daily_report', label: 'daily_report', description: 'Last-7-days feature updates' },
  { value: 'run_feature', label: 'run_feature', description: 'Request a guarded feature run' },
  { value: 'custom', label: 'custom', description: 'No built-in handler yet — placeholder' },
];

function actionLabel(action: CommandAction): string {
  return COMMAND_ACTION_OPTIONS.find((o) => o.value === action)?.label ?? action;
}

function normaliseTrigger(raw: string): string {
  return raw.trim().toLowerCase();
}

export interface CommandMappingEditFormProps {
  mapping: CommandMapping;
  /** True when the mapping is one of the seeded defaults (help/status/report/run). */
  isDefault: boolean;
  /** Every other mapping's trigger, for uniqueness validation. Excludes the row being edited. */
  otherTriggers: string[];
  onSave: (patch: {
    trigger: string;
    description: string;
    action: CommandAction;
    enabled: boolean;
  }) => void;
}

export function CommandMappingEditForm({
  mapping,
  isDefault,
  otherTriggers,
  onSave,
}: CommandMappingEditFormProps) {
  const [trigger, setTrigger] = useState(mapping.trigger);
  const [description, setDescription] = useState(mapping.description);
  const [action, setAction] = useState<CommandAction>(mapping.action);
  const [enabled, setEnabled] = useState(mapping.enabled);
  const [error, setError] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    setTrigger(mapping.trigger);
    setDescription(mapping.description);
    setAction(mapping.action);
    setEnabled(mapping.enabled);
    setError(null);
    setSavedFlash(false);
  }, [mapping.id, mapping.trigger, mapping.description, mapping.action, mapping.enabled]);

  const handleSave = () => {
    const t = trigger.trim();
    if (!t.startsWith('/')) {
      setError('Trigger must start with /');
      return;
    }
    if (t.length < 2) {
      setError('Trigger must be at least one character after the slash');
      return;
    }
    if (/\s/.test(t)) {
      setError('Trigger cannot contain whitespace');
      return;
    }
    const conflict = otherTriggers.some((other) => normaliseTrigger(other) === normaliseTrigger(t));
    if (conflict) {
      setError(`Trigger "${t}" is already in use`);
      return;
    }
    setError(null);
    onSave({
      trigger: t,
      description: description.trim(),
      action,
      enabled,
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  return (
    <div className="space-y-3 bg-[rgb(var(--pm-rail))]/60 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Trigger</label>
          <input
            value={trigger}
            onChange={(e) => setTrigger(e.target.value)}
            placeholder="/example"
            className={inputCls}
          />
          <p className="text-[11px] leading-4 text-stone-600">
            Must start with <span className="font-mono">/</span>, no whitespace.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Action</label>
          {isDefault ? (
            <div className="border border-stone-200/15 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-300 font-mono">
              {actionLabel(action)}
            </div>
          ) : (
            <select
              value={action}
              onChange={(e) => setAction(e.target.value as CommandAction)}
              className={inputCls}
            >
              {COMMAND_ACTION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.description}
                </option>
              ))}
            </select>
          )}
          {isDefault && (
            <p className="text-[11px] leading-4 text-stone-600">
              Default mapping; action is locked.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Shown in /help replies"
          className={inputCls}
        />
      </div>

      <label className="flex items-center gap-2 text-xs text-stone-300">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Enabled (matched against inbound messages)
      </label>

      {error && (
        <p className="border border-red-500/30 bg-red-950/30 px-2 py-1 text-[11px] text-red-300">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2 pt-1">
        {savedFlash && (
          <span className="self-center text-[11px] text-emerald-300/80">Saved.</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
        >
          Save mapping
        </button>
      </div>
    </div>
  );
}
