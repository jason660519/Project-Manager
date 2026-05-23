import type { ChannelConfig, ChannelPlatform, ChannelWebhookMode } from '../../../../../lib/types/channels';
import { loadChannelSecrets } from '../../../../../lib/storage/channels';

export interface PlatformMeta {
  label: string;
  color: string;
  badgeCls: string;
  supportsPolling: boolean;
}

export const PLATFORM_META: Record<ChannelPlatform, PlatformMeta> = {
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

export interface CredField {
  key: string;
  label: string;
  placeholder: string;
  secret: boolean;
  hint?: string;
  readonly?: boolean;
}

export const PLATFORM_CREDS: Record<ChannelPlatform, CredField[]> = {
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
      hint: 'URL of your Cloudflare Worker / proxy that forwards webhooks to Project Manager',
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

export const ALL_PLATFORM_TEMPLATES: Array<{ platform: ChannelPlatform; defaultLabel: string }> = [
  { platform: 'telegram', defaultLabel: 'Telegram Bot' },
  { platform: 'whatsapp', defaultLabel: 'WhatsApp' },
  { platform: 'line', defaultLabel: 'LINE' },
  { platform: 'wechat', defaultLabel: 'WeChat Work' },
];

export interface ChannelFormState {
  platform: ChannelPlatform;
  label: string;
  enabled: boolean;
  webhookMode: ChannelWebhookMode;
  credentials: Record<string, string>;
  secrets: Record<string, string>;
  showSecrets: Record<string, boolean>;
}

export function blankChannelForm(
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
