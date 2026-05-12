export type ChannelPlatform = 'telegram' | 'whatsapp' | 'line' | 'wechat';

export type ChannelWebhookMode = 'polling' | 'webhook';

export type CommandAction =
  | 'get_status'
  | 'run_feature'
  | 'daily_report'
  | 'help'
  | 'custom';

export interface CommandMapping {
  id: string;
  trigger: string;
  action: CommandAction;
  description: string;
  enabled: boolean;
}

export interface ChannelConfig {
  id: string;
  platform: ChannelPlatform;
  label: string;
  enabled: boolean;
  webhookMode: ChannelWebhookMode;
  /** Non-sensitive credential fields (phone number IDs, relay URLs, allowed chat IDs, etc.) */
  credentials: Record<string, string>;
}

export interface ChannelCatalog {
  channels: ChannelConfig[];
  commandMappings: CommandMapping[];
}
