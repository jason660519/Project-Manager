'use client';

import { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  MessageCircle,
  Plus,
  Radio,
  Trash2,
  Zap,
} from 'lucide-react';
import type {
  ChannelCatalog,
  ChannelConfig,
  ChannelPlatform,
  ChannelWebhookMode,
  CommandMapping,
} from '../../../lib/types/channels';
import {
  deleteChannelSecrets,
  getChannelSecret,
  loadChannelCatalog,
  loadChannelSecrets,
  saveChannelCatalog,
  setChannelSecret,
} from '../../../lib/storage/channels';

// ── Platform metadata ─────────────────────────────────────────────────────────

interface PlatformMeta {
  label: string;
  color: string;
  badgeCls: string;
  supportsPolling: boolean;
}

const PLATFORM_META: Record<ChannelPlatform, PlatformMeta> = {
  telegram: {
    label: 'Telegram',
    color: 'text-sky-300',
    badgeCls: 'border-sky-200/30 text-sky-300/90',
    supportsPolling: true,
  },
  whatsapp: {
    label: 'WhatsApp',
    color: 'text-emerald-300',
    badgeCls: 'border-emerald-200/30 text-emerald-300/90',
    supportsPolling: false,
  },
  line: {
    label: 'LINE',
    color: 'text-green-300',
    badgeCls: 'border-green-200/30 text-green-300/90',
    supportsPolling: false,
  },
  wechat: {
    label: 'WeChat Work',
    color: 'text-lime-300',
    badgeCls: 'border-lime-200/30 text-lime-300/90',
    supportsPolling: false,
  },
};

// ── Credential field schemas ──────────────────────────────────────────────────

interface CredField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  hint?: string;
  readonly?: boolean;
}

const PLATFORM_CREDS: Record<ChannelPlatform, CredField[]> = {
  telegram: [
    {
      key: 'botToken',
      label: 'Bot Token',
      placeholder: '7123456789:AAEwb...',
      secret: true,
      hint: 'Get from @BotFather on Telegram',
    },
    {
      key: 'allowedChatIds',
      label: 'Allowed Chat IDs',
      placeholder: '123456789, 987654321',
      secret: false,
      hint: 'Comma-separated user/group IDs. Leave empty to allow all (not recommended).',
    },
  ],
  whatsapp: [
    {
      key: 'phoneNumberId',
      label: 'Phone Number ID',
      placeholder: '123456789012345',
      secret: false,
      hint: 'From Meta Developer Console → WhatsApp → API Setup',
    },
    {
      key: 'accessToken',
      label: 'Access Token',
      placeholder: 'EAABm...',
      secret: true,
      hint: 'Permanent token from Meta Developer Console',
    },
    {
      key: 'webhookVerifyToken',
      label: 'Webhook Verify Token',
      placeholder: 'my-verify-token',
      secret: true,
      hint: 'Any string you choose — used by Meta to verify your webhook endpoint',
    },
    {
      key: 'relayUrl',
      label: 'Relay Server URL',
      placeholder: 'https://your-worker.workers.dev/whatsapp',
      secret: false,
      hint: 'URL of your Cloudflare Worker / proxy that forwards webhooks to DevPilot',
    },
  ],
  line: [
    {
      key: 'channelAccessToken',
      label: 'Channel Access Token',
      placeholder: 'XXXXXX...',
      secret: true,
      hint: 'Long-lived token from LINE Developers Console → Messaging API',
    },
    {
      key: 'channelSecret',
      label: 'Channel Secret',
      placeholder: 'abc123...',
      secret: true,
    },
    {
      key: 'relayUrl',
      label: 'Relay Server URL',
      placeholder: 'https://your-worker.workers.dev/line',
      secret: false,
      hint: 'Copy this URL into LINE Console → Messaging API → Webhook URL',
    },
  ],
  wechat: [
    {
      key: 'corpId',
      label: 'Corp ID',
      placeholder: 'ww1234567890abcdef',
      secret: false,
    },
    {
      key: 'agentId',
      label: 'Agent ID',
      placeholder: '1000001',
      secret: false,
    },
    {
      key: 'agentSecret',
      label: 'Agent Secret',
      placeholder: 'XXXX...',
      secret: true,
    },
    {
      key: 'token',
      label: 'Token',
      placeholder: 'MyToken',
      secret: true,
      hint: 'Set in WeChat Work callback configuration',
    },
    {
      key: 'encodingAesKey',
      label: 'Encoding AES Key',
      placeholder: '43 characters',
      secret: true,
    },
  ],
};

const ALL_PLATFORM_TEMPLATES: Array<{ platform: ChannelPlatform; defaultLabel: string }> = [
  { platform: 'telegram', defaultLabel: 'Telegram Bot' },
  { platform: 'whatsapp', defaultLabel: 'WhatsApp' },
  { platform: 'line',     defaultLabel: 'LINE' },
  { platform: 'wechat',  defaultLabel: 'WeChat Work' },
];

// ── Shared UI helpers ─────────────────────────────────────────────────────────

const inputCls =
  'w-full border border-stone-200/20 bg-[#03100f] px-3 py-2 text-sm text-stone-100 outline-none focus:ring-2 focus:ring-emerald-300/35 placeholder:text-stone-600';

function uid(): string {
  return typeof crypto !== 'undefined'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function SectionHeader({
  icon: Icon,
  title,
  count,
  color = 'text-stone-300',
}: {
  icon: React.ComponentType<{ size: number; className?: string }>;
  title: string;
  count: number;
  color?: string;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-stone-200/12 px-4 py-3">
      <Icon size={15} className={color} />
      <h2 className="text-sm font-medium uppercase tracking-[0.16em] text-stone-100">{title}</h2>
      <span className="ml-1 font-mono text-xs text-stone-500">{count}</span>
    </div>
  );
}

function FormField({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-[11px] uppercase tracking-[0.14em] text-stone-500">{label}</label>
      {children}
      {hint && <p className="text-[11px] leading-4 text-stone-600">{hint}</p>}
    </div>
  );
}

function SaveCancelRow({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  return (
    <div className="flex justify-end gap-2 pt-1">
      <button onClick={onCancel} className="px-3 py-1.5 text-xs text-stone-400 hover:text-stone-100">
        Cancel
      </button>
      <button
        onClick={onSave}
        className="bg-stone-100 px-3 py-1.5 text-xs font-medium text-[#071d1a] hover:bg-amber-100"
      >
        Save
      </button>
    </div>
  );
}

function PlatformBadge({ platform }: { platform: ChannelPlatform }) {
  const meta = PLATFORM_META[platform];
  return (
    <span className={`border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${meta.badgeCls}`}>
      {meta.label}
    </span>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute right-2 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-200"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
    </button>
  );
}

// ── Channel form state ────────────────────────────────────────────────────────

interface ChannelFormState {
  platform: ChannelPlatform;
  label: string;
  enabled: boolean;
  webhookMode: ChannelWebhookMode;
  credentials: Record<string, string>;
  secrets: Record<string, string>;
  showSecrets: Record<string, boolean>;
}

function blankForm(
  platform: ChannelPlatform,
  defaultLabel: string,
  channel?: ChannelConfig,
): ChannelFormState {
  const secretFields = PLATFORM_CREDS[platform].filter((f) => f.secret).map((f) => f.key);
  const existingSecrets = channel
    ? loadChannelSecrets(channel, secretFields)
    : Object.fromEntries(secretFields.map((k) => [k, '']));

  return {
    platform,
    label: channel?.label ?? defaultLabel,
    enabled: channel?.enabled ?? true,
    webhookMode: channel?.webhookMode ?? (PLATFORM_META[platform].supportsPolling ? 'polling' : 'webhook'),
    credentials: { ...(channel?.credentials ?? {}) },
    secrets: existingSecrets,
    showSecrets: Object.fromEntries(secretFields.map((k) => [k, false])),
  };
}

// ── Channel inline form ───────────────────────────────────────────────────────

function ChannelForm({
  form,
  onChange,
  onSave,
  onCancel,
}: {
  form: ChannelFormState;
  onChange: (f: ChannelFormState) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const meta = PLATFORM_META[form.platform];
  const fields = PLATFORM_CREDS[form.platform];

  const setField = (key: string, value: string) => {
    const field = fields.find((f) => f.key === key);
    if (!field) return;
    if (field.secret) {
      onChange({ ...form, secrets: { ...form.secrets, [key]: value } });
    } else {
      onChange({ ...form, credentials: { ...form.credentials, [key]: value } });
    }
  };

  const toggleShow = (key: string) =>
    onChange({ ...form, showSecrets: { ...form.showSecrets, [key]: !form.showSecrets[key] } });

  return (
    <div className="space-y-4 bg-[#061512]/60 p-4">
      {/* Top row: label + mode */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Channel Label">
          <input
            value={form.label}
            onChange={(e) => onChange({ ...form, label: e.target.value })}
            placeholder={meta.label}
            className={inputCls}
          />
        </FormField>

        {meta.supportsPolling && (
          <FormField label="Mode" hint="Polling doesn't require a public server — ideal for getting started quickly.">
            <div className="flex gap-2">
              {(['polling', 'webhook'] as ChannelWebhookMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => onChange({ ...form, webhookMode: m })}
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

      {/* Platform credential fields */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const value = f.secret ? (form.secrets[f.key] ?? '') : (form.credentials[f.key] ?? '');
          const shown = form.showSecrets[f.key] ?? false;

          return (
            <FormField key={f.key} label={f.label} hint={f.hint}>
              <div className="relative">
                <input
                  type={f.secret && !shown ? 'password' : 'text'}
                  value={value}
                  onChange={(e) => setField(f.key, e.target.value)}
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
            </FormField>
          );
        })}
      </div>

      <SaveCancelRow onSave={onSave} onCancel={onCancel} />
    </div>
  );
}

// ── Channels section ──────────────────────────────────────────────────────────

function ChannelsSection({
  channels,
  onChange,
}: {
  channels: ChannelConfig[];
  onChange: (c: ChannelConfig[]) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForms, setEditForms] = useState<Record<string, ChannelFormState>>({});
  const [addForm, setAddForm] = useState<ChannelFormState | null>(null);

  const startEdit = (ch: ChannelConfig) => {
    setEditForms((prev) => ({ ...prev, [ch.id]: blankForm(ch.platform, ch.label, ch) }));
    setEditingId(ch.id);
    setAddForm(null);
  };

  const saveEdit = (id: string) => {
    const f = editForms[id];
    if (!f) return;
    // Persist secrets separately
    for (const field of PLATFORM_CREDS[f.platform]) {
      if (field.secret) {
        setChannelSecret(id, field.key, f.secrets[field.key] ?? '');
      }
    }
    onChange(
      channels.map((ch) =>
        ch.id !== id
          ? ch
          : { ...ch, label: f.label, enabled: f.enabled, webhookMode: f.webhookMode, credentials: f.credentials },
      ),
    );
    setEditingId(null);
  };

  const openAdd = (platform: ChannelPlatform, defaultLabel: string) => {
    setAddForm(blankForm(platform, defaultLabel));
    setEditingId(null);
  };

  const saveAdd = () => {
    if (!addForm) return;
    const id = uid();
    // Persist secrets separately
    for (const field of PLATFORM_CREDS[addForm.platform]) {
      if (field.secret) {
        setChannelSecret(id, field.key, addForm.secrets[field.key] ?? '');
      }
    }
    onChange([
      ...channels,
      {
        id,
        platform: addForm.platform,
        label: addForm.label || PLATFORM_META[addForm.platform].label,
        enabled: addForm.enabled,
        webhookMode: addForm.webhookMode,
        credentials: addForm.credentials,
      },
    ]);
    setAddForm(null);
  };

  const deleteChannel = (id: string) => {
    const ch = channels.find((c) => c.id === id);
    if (ch) {
      deleteChannelSecrets(id, PLATFORM_CREDS[ch.platform].filter((f) => f.secret).map((f) => f.key));
    }
    onChange(channels.filter((c) => c.id !== id));
  };

  const toggleEnabled = (id: string) => {
    onChange(channels.map((ch) => (ch.id === id ? { ...ch, enabled: !ch.enabled } : ch)));
  };

  return (
    <section className="border border-stone-200/18 bg-[#071d1a]/72">
      <SectionHeader icon={Radio} title="Channels" count={channels.length} color="text-emerald-300" />

      <div className="divide-y divide-stone-200/8">
        {channels.length === 0 && (
          <p className="px-4 py-5 text-xs text-stone-500">
            No channels configured. Add one below to receive messages from your phone.
          </p>
        )}

        {channels.map((ch) =>
          editingId === ch.id ? (
            <ChannelForm
              key={ch.id}
              form={editForms[ch.id]}
              onChange={(f) => setEditForms((prev) => ({ ...prev, [ch.id]: f }))}
              onSave={() => saveEdit(ch.id)}
              onCancel={() => setEditingId(null)}
            />
          ) : (
            <div key={ch.id} className="flex items-center gap-4 px-4 py-3">
              {/* Enable toggle */}
              <button
                onClick={() => toggleEnabled(ch.id)}
                title={ch.enabled ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                  ch.enabled ? 'bg-emerald-600' : 'bg-stone-600'
                }`}
              >
                <span
                  className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    ch.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                  }`}
                />
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-stone-100">{ch.label}</span>
                  <PlatformBadge platform={ch.platform} />
                  <span className="border border-stone-200/15 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-stone-400">
                    {ch.webhookMode}
                  </span>
                  {!ch.enabled && (
                    <span className="border border-stone-200/10 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-stone-600">
                      disabled
                    </span>
                  )}
                </div>
                {/* Show non-empty non-secret credential preview */}
                {Object.entries(ch.credentials)
                  .filter(([, v]) => v)
                  .slice(0, 1)
                  .map(([k, v]) => (
                    <p key={k} className="mt-0.5 truncate font-mono text-[11px] text-stone-500">
                      {k}: {v}
                    </p>
                  ))}
              </div>

              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => startEdit(ch)}
                  className="border border-stone-200/18 px-2 py-1 text-xs text-stone-400 hover:border-stone-200/35 hover:text-stone-100"
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteChannel(ch.id)}
                  className="border border-stone-200/18 px-2 py-1 text-xs text-stone-500 hover:border-red-500/30 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ),
        )}
      </div>

      {/* Add form or quick-add buttons */}
      {addForm ? (
        <div className="border-t border-stone-200/12">
          <ChannelForm form={addForm} onChange={setAddForm} onSave={saveAdd} onCancel={() => setAddForm(null)} />
        </div>
      ) : (
        <div className="border-t border-stone-200/12 p-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-stone-500">Add channel</p>
          <div className="flex flex-wrap gap-2">
            {ALL_PLATFORM_TEMPLATES.map(({ platform, defaultLabel }) => (
              <button
                key={platform}
                onClick={() => openAdd(platform, defaultLabel)}
                className={`border border-stone-200/18 px-3 py-1.5 text-xs hover:border-emerald-300/30 ${PLATFORM_META[platform].color}`}
              >
                + {PLATFORM_META[platform].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

// ── Command mappings section ──────────────────────────────────────────────────

const ACTION_LABELS: Record<string, string> = {
  get_status:   'Get all feature statuses',
  run_feature:  'Trigger feature agent run',
  daily_report: 'Send daily progress report',
  help:         'List available commands',
  custom:       'Custom action',
};

function CommandMappingsSection({
  mappings,
  onChange,
}: {
  mappings: CommandMapping[];
  onChange: (m: CommandMapping[]) => void;
}) {
  const toggle = (id: string) =>
    onChange(mappings.map((m) => (m.id === id ? { ...m, enabled: !m.enabled } : m)));

  return (
    <section className="border border-stone-200/18 bg-[#071d1a]/72">
      <SectionHeader icon={Zap} title="Command Mappings" count={mappings.filter((m) => m.enabled).length} color="text-amber-300" />

      <div className="divide-y divide-stone-200/8">
        {mappings.map((m) => (
          <div key={m.id} className="flex items-center gap-4 px-4 py-3">
            <button
              onClick={() => toggle(m.id)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
                m.enabled ? 'bg-emerald-600' : 'bg-stone-600'
              }`}
            >
              <span
                className={`absolute left-0 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  m.enabled ? 'translate-x-[18px]' : 'translate-x-0.5'
                }`}
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <span className="font-mono text-sm font-medium text-stone-100">{m.trigger}</span>
                <span className="text-[11px] text-stone-400">{ACTION_LABELS[m.action] ?? m.action}</span>
              </div>
              {m.description && (
                <p className="mt-0.5 text-[11px] text-stone-600">{m.description}</p>
              )}
            </div>

            <span
              className={`shrink-0 border px-1.5 py-0.5 text-[10px] uppercase tracking-[0.1em] ${
                m.enabled
                  ? 'border-emerald-200/25 text-emerald-300/80'
                  : 'border-stone-200/15 text-stone-600'
              }`}
            >
              {m.enabled ? 'active' : 'off'}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-stone-200/12 p-4">
        <p className="text-[11px] leading-4 text-stone-500">
          Send any of the triggers above from any connected channel. Commands reach DevPilot via
          the polling loop (Telegram) or your relay server (WhatsApp / LINE / WeChat).
        </p>
      </div>
    </section>
  );
}

// ── Setup guide section ───────────────────────────────────────────────────────

function SetupGuideSection() {
  return (
    <section className="border border-stone-200/18 bg-[#071d1a]/72">
      <SectionHeader icon={MessageCircle} title="Getting Started" count={0} color="text-stone-400" />
      <div className="space-y-4 p-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-300">
            Recommended: Telegram (no relay server needed)
          </p>
          <ol className="space-y-1 text-[11px] leading-5 text-stone-400">
            <li>1. Message <span className="font-mono text-stone-200">@BotFather</span> on Telegram → <span className="font-mono text-stone-200">/newbot</span></li>
            <li>2. Copy the Bot Token into a new Telegram channel above</li>
            <li>3. Set Mode to <span className="font-mono text-stone-200">polling</span> — DevPilot will fetch messages automatically</li>
            <li>4. Send <span className="font-mono text-stone-200">/help</span> from Telegram to verify the connection</li>
          </ol>
        </div>
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-300">
            WhatsApp / LINE / WeChat (relay server required)
          </p>
          <ol className="space-y-1 text-[11px] leading-5 text-stone-400">
            <li>1. Deploy a Cloudflare Worker to receive platform webhooks</li>
            <li>2. Worker forwards messages to DevPilot via WebSocket / SSE</li>
            <li>3. Enter the platform credentials and your relay URL above</li>
          </ol>
        </div>
      </div>
    </section>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function ChannelsView() {
  const [catalog, setCatalog] = useState<ChannelCatalog>({ channels: [], commandMappings: [] });

  useEffect(() => {
    setCatalog(loadChannelCatalog());
  }, []);

  const updateCatalog = (next: ChannelCatalog) => {
    setCatalog(next);
    saveChannelCatalog(next);
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold uppercase tracking-[0.18em] text-stone-50">Channels</h1>
        <p className="mt-1 text-xs text-stone-400">
          Configure messaging channels so you can monitor and control DevPilot from your phone.
          Changes are saved immediately.
        </p>
      </div>

      <ChannelsSection
        channels={catalog.channels}
        onChange={(channels) => updateCatalog({ ...catalog, channels })}
      />

      <CommandMappingsSection
        mappings={catalog.commandMappings}
        onChange={(commandMappings) => updateCatalog({ ...catalog, commandMappings })}
      />

      <SetupGuideSection />
    </div>
  );
}
