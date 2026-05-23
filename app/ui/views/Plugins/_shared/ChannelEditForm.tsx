'use client';

import { useEffect, useState } from 'react';
import { Check, Eye, EyeOff, Loader2, X } from 'lucide-react';
import type { ChannelConfig, ChannelWebhookMode } from '../../../../../lib/types/channels';
import {
  type ChannelFormState,
  PLATFORM_CREDS,
  PLATFORM_META,
  blankChannelForm,
} from './channel-platform';

type TestState =
  | { phase: 'idle' }
  | { phase: 'testing' }
  | { phase: 'ok'; username: string }
  | { phase: 'err'; message: string };

const inputCls =
  'w-full border border-stone-200/20 bg-[rgb(var(--pm-input))] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] leading-4 text-stone-600">{hint}</p>}
    </div>
  );
}

export interface ChannelEditFormProps {
  channel: ChannelConfig;
  onSave: (
    patch: { label: string; enabled: boolean; webhookMode: ChannelWebhookMode; credentials: Record<string, string> },
    secrets: Record<string, string>,
  ) => void;
  /**
   * Validate the Telegram bot token. Throw with a user-readable message on
   * failure. Only invoked for Telegram channels; other platforms ignore it.
   */
  onTestTelegramToken?: (botToken: string) => Promise<{ username?: string }>;
}

export function ChannelEditForm({ channel, onSave, onTestTelegramToken }: ChannelEditFormProps) {
  const [form, setForm] = useState<ChannelFormState>(() =>
    blankChannelForm(channel.platform, channel.label, channel),
  );
  const [savedFlash, setSavedFlash] = useState(false);
  const [testState, setTestState] = useState<TestState>({ phase: 'idle' });

  // Reload when switching to a different channel
  useEffect(() => {
    setForm(blankChannelForm(channel.platform, channel.label, channel));
    setSavedFlash(false);
    setTestState({ phase: 'idle' });
  }, [channel.id, channel.platform, channel.label]);

  const meta = PLATFORM_META[form.platform];
  const fields = PLATFORM_CREDS[form.platform];

  const setField = (key: string, value: string) => {
    const field = fields.find((f) => f.key === key);
    if (!field) return;
    if (field.secret) {
      setForm((prev) => ({ ...prev, secrets: { ...prev.secrets, [key]: value } }));
    } else {
      setForm((prev) => ({ ...prev, credentials: { ...prev.credentials, [key]: value } }));
    }
  };

  const toggleShow = (key: string) =>
    setForm((prev) => ({ ...prev, showSecrets: { ...prev.showSecrets, [key]: !prev.showSecrets[key] } }));

  const handleSave = () => {
    onSave(
      {
        label: form.label || meta.label,
        enabled: form.enabled,
        webhookMode: form.webhookMode,
        credentials: form.credentials,
      },
      form.secrets,
    );
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const handleTestToken = async () => {
    if (!onTestTelegramToken) return;
    const token = (form.secrets.botToken ?? '').trim();
    if (!token) {
      setTestState({ phase: 'err', message: 'Bot Token is empty' });
      return;
    }
    setTestState({ phase: 'testing' });
    try {
      const info = await onTestTelegramToken(token);
      setTestState({ phase: 'ok', username: info.username ?? '(no username)' });
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      const message = /Unauthorized/i.test(raw) ? 'Invalid token' : raw;
      setTestState({ phase: 'err', message });
    }
  };

  return (
    <div className="space-y-4 bg-[rgb(var(--pm-rail))]/60 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Channel Label">
          <input
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            placeholder={meta.label}
            className={inputCls}
          />
        </FormField>

        {meta.supportsPolling && (
          <FormField
            label="Mode"
            hint="Polling doesn't require a public server — ideal for getting started quickly."
          >
            <div className="flex gap-2">
              {(['polling', 'webhook'] as ChannelWebhookMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setForm({ ...form, webhookMode: m })}
                  className={[
                    'flex-1 border py-2 text-xs uppercase tracking-[0.12em] transition-colors',
                    form.webhookMode === m
                      ? 'border-stone-100/60 bg-emerald-950/50 text-stone-50'
                      : 'border-stone-200/15 text-stone-400 hover:text-stone-100',
                  ].join(' ')}
                >
                  {m}
                </button>
              ))}
            </div>
          </FormField>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const value = f.secret ? (form.secrets[f.key] ?? '') : (form.credentials[f.key] ?? '');
          const shown = form.showSecrets[f.key] ?? false;
          const isTelegramBotToken =
            form.platform === 'telegram' && f.key === 'botToken' && !!onTestTelegramToken;

          return (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              <div className="relative">
                <input
                  type={f.secret && !shown ? 'password' : 'text'}
                  value={value}
                  onChange={(e) => {
                    setField(f.key, e.target.value);
                    if (isTelegramBotToken) setTestState({ phase: 'idle' });
                  }}
                  placeholder={f.placeholder}
                  className={`${inputCls} ${f.secret ? 'pr-9' : ''}`}
                />
                {f.secret && (
                  <button
                    type="button"
                    onClick={() => toggleShow(f.key)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
                  >
                    {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                )}
              </div>
              {isTelegramBotToken && (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleTestToken()}
                    disabled={testState.phase === 'testing'}
                    className="flex items-center gap-1 border border-stone-200/20 px-2 py-1 text-[11px] text-stone-300 hover:border-emerald-300/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {testState.phase === 'testing' && <Loader2 size={11} className="animate-spin" />}
                    Test connection
                  </button>
                  {testState.phase === 'ok' && (
                    <span className="flex items-center gap-1 border border-emerald-400/40 bg-emerald-950/30 px-2 py-1 text-[11px] text-emerald-300">
                      <Check size={11} /> @{testState.username}
                    </span>
                  )}
                  {testState.phase === 'err' && (
                    <span className="flex items-center gap-1 border border-amber-400/40 bg-amber-950/30 px-2 py-1 text-[11px] text-amber-200">
                      <X size={11} /> {testState.message}
                    </span>
                  )}
                </div>
              )}
            </FormField>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {savedFlash && (
          <span className="self-center text-[11px] text-emerald-300/80">Saved.</span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[rgb(var(--pm-panel))] hover:bg-amber-100"
        >
          Save channel
        </button>
      </div>
    </div>
  );
}
