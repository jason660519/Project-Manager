'use client';

import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import type {
  CliPlugin,
  EditorPlugin,
  McpPlugin,
  ProviderPlugin,
} from '../../../../../lib/types/plugins';
import { useI18n } from '../../../../../lib/i18n';

export const inputCls =
  'w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

export function ProviderConfigForm({
  entry,
  initialApiKey,
  onSave,
  onCancel,
}: {
  entry: ProviderPlugin;
  initialApiKey: string;
  onSave: (p: ProviderPlugin, key: string) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    baseUrl: entry.baseUrl,
    defaultModel: entry.defaultModel,
    models: entry.models.join('\n'),
    apiKey: initialApiKey,
    showKey: false,
  });
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3 border-t border-stone-200/12 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.baseUrl}</label>
          <input value={form.baseUrl} onChange={set('baseUrl')} className={inputCls} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.defaultModel}</label>
          <input value={form.defaultModel} onChange={set('defaultModel')} className={inputCls} />
        </div>
        <div className="col-span-2 space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.apiKey}</label>
          <div className="relative">
            <input
              type={form.showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={set('apiKey')}
              placeholder="sk-ant-..."
              className={`${inputCls} pr-9`}
            />
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, showKey: !f.showKey }))}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
            >
              {form.showKey ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          </div>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.models}</label>
          <textarea rows={3} value={form.models} onChange={set('models')} className={`${inputCls} font-mono text-xs`} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">{t.plugins.cancel}</button>
        <button
          type="button"
          onClick={() =>
            onSave(
              {
                ...entry,
                baseUrl: form.baseUrl,
                defaultModel: form.defaultModel,
                models: form.models.split('\n').map((s) => s.trim()).filter(Boolean),
              },
              form.apiKey,
            )
          }
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
        >
          {t.plugins.save}
        </button>
      </div>
    </div>
  );
}

export function CliConfigForm({
  entry,
  providers,
  onSave,
  onCancel,
}: {
  entry: CliPlugin;
  providers: ProviderPlugin[];
  onSave: (a: CliPlugin) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    command: entry.command,
    argsTemplate: entry.argsTemplate.join('\n'),
    providerId: entry.providerId ?? '',
  });
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-3 border-t border-stone-200/12 pt-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.command}</label>
          <input value={form.command} onChange={set('command')} className={`${inputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.provider}</label>
          <select value={form.providerId} onChange={set('providerId')} className={inputCls}>
            <option value="">{t.plugins.form.none}</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.argsTemplate}</label>
          <textarea rows={3} value={form.argsTemplate} onChange={set('argsTemplate')} className={`${inputCls} font-mono text-xs`} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">{t.plugins.cancel}</button>
        <button
          type="button"
          onClick={() =>
            onSave({
              ...entry,
              command: form.command,
              argsTemplate: form.argsTemplate.split('\n').map((s) => s.trim()).filter(Boolean),
              providerId: form.providerId || undefined,
            })
          }
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
        >
          {t.plugins.save}
        </button>
      </div>
    </div>
  );
}

export function EditorConfigForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: EditorPlugin;
  onSave: (editor: EditorPlugin) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [command, setCommand] = useState(entry.command);
  return (
    <div className="space-y-3 border-t border-stone-200/12 pt-4">
      <div className="space-y-1">
        <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.command}</label>
        <input value={command} onChange={(e) => setCommand(e.target.value)} className={`${inputCls} font-mono`} />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">{t.plugins.cancel}</button>
        <button
          type="button"
          onClick={() => onSave({ ...entry, command })}
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
        >
          {t.plugins.save}
        </button>
      </div>
    </div>
  );
}

export function McpConfigForm({
  entry,
  onSave,
  onCancel,
}: {
  entry: McpPlugin;
  onSave: (m: McpPlugin) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({
    command: entry.command ?? '',
    args: (entry.args ?? []).join('\n'),
    env: Object.entries(entry.env ?? {})
      .map(([k, v]) => `${k}=${v}`)
      .join('\n'),
  });
  const set =
    (k: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSave = () => {
    const envMap: Record<string, string> = {};
    form.env.split('\n').forEach((line) => {
      const idx = line.indexOf('=');
      if (idx <= 0) return;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).trim();
      if (k) envMap[k] = v;
    });
    onSave({
      ...entry,
      transport: 'stdio',
      command: form.command,
      args: form.args.split('\n').map((s) => s.trim()).filter(Boolean),
      env: Object.keys(envMap).length > 0 ? envMap : undefined,
    });
  };

  return (
    <div className="space-y-3 border-t border-stone-200/12 pt-4">
      <div className="space-y-3">
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.command}</label>
          <input value={form.command} onChange={set('command')} placeholder="npx" className={`${inputCls} font-mono`} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.args}</label>
          <textarea rows={3} value={form.args} onChange={set('args')} className={`${inputCls} font-mono text-xs`} />
        </div>
        <div className="space-y-1">
          <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{t.plugins.form.env}</label>
          <textarea rows={2} value={form.env} onChange={set('env')} className={`${inputCls} font-mono text-xs`} />
        </div>
        <p className="text-[11px] text-stone-500">{t.plugins.form.transportFixed}</p>
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">{t.plugins.cancel}</button>
        <button type="button" onClick={handleSave} className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100">
          {t.plugins.save}
        </button>
      </div>
    </div>
  );
}
