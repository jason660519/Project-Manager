import { KEY_PERSONAL_MOBILE_REMOTE_AUDIT } from '../storage/keys';
import type { MobileRemoteIntent, MobileRemoteParseStatus } from './intents';

export type MobileRemoteAuditChannel = 'telegram' | 'mobile_app';
export type MobileRemotePolicyDecision =
  | 'allowed'
  | 'guarded'
  | 'blocked'
  | 'dry_run_only'
  | 'parse_failed';
export type MobileRemoteResultState =
  | 'accepted'
  | 'needs_confirmation'
  | 'running'
  | 'completed'
  | 'failed'
  | 'blocked'
  | 'cancelled';

export interface MobileRemoteAuditEvent {
  id: string;
  deviceId: string;
  receivedAt: string;
  channel: MobileRemoteAuditChannel;
  rawInputKind: 'text' | 'voice_transcript';
  rawInput: string;
  correctedInput?: string;
  parseStatus: MobileRemoteParseStatus;
  intent?: MobileRemoteIntent;
  policyDecision: MobileRemotePolicyDecision;
  resultState: MobileRemoteResultState;
  responsePreview?: string;
  errorMessage?: string;
}

export const MOBILE_REMOTE_AUDIT_LIMIT = 200;

function nowIso(): string {
  return new Date().toISOString();
}

function makeAuditId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `mobile-remote-${random}`;
}

function readAuditStorage(storage: Storage): MobileRemoteAuditEvent[] {
  try {
    const raw = storage.getItem(KEY_PERSONAL_MOBILE_REMOTE_AUDIT);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MobileRemoteAuditEvent[]) : [];
  } catch {
    return [];
  }
}

function writeAuditStorage(storage: Storage, events: MobileRemoteAuditEvent[]): void {
  try {
    storage.setItem(KEY_PERSONAL_MOBILE_REMOTE_AUDIT, JSON.stringify(events));
  } catch {
    /* disabled storage or quota */
  }
}

export function loadMobileRemoteAuditEvents(
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): MobileRemoteAuditEvent[] {
  if (!storage) return [];
  return readAuditStorage(storage);
}

export function appendMobileRemoteAuditEvent(
  input: Omit<MobileRemoteAuditEvent, 'id' | 'receivedAt'> &
    Partial<Pick<MobileRemoteAuditEvent, 'id' | 'receivedAt'>>,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): MobileRemoteAuditEvent {
  const event: MobileRemoteAuditEvent = {
    ...input,
    id: input.id ?? makeAuditId(),
    receivedAt: input.receivedAt ?? nowIso(),
  };

  if (!storage) return event;

  const next = [event, ...readAuditStorage(storage)].slice(0, MOBILE_REMOTE_AUDIT_LIMIT);
  writeAuditStorage(storage, next);
  return event;
}

export function clearMobileRemoteAuditEvents(
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY_PERSONAL_MOBILE_REMOTE_AUDIT);
  } catch {
    /* disabled storage */
  }
}

export function policyDecisionFromParse(input: {
  parseStatus: MobileRemoteParseStatus;
  intent?: MobileRemoteIntent;
}): MobileRemotePolicyDecision {
  if (input.parseStatus === 'blocked') return 'blocked';
  if (input.parseStatus !== 'parsed') return 'parse_failed';
  if (input.intent?.type === 'run_feature' || input.intent?.type === 'run_gate') {
    return 'guarded';
  }
  return 'allowed';
}

export function resultStateFromPolicy(decision: MobileRemotePolicyDecision): MobileRemoteResultState {
  switch (decision) {
    case 'allowed':
      return 'completed';
    case 'guarded':
      return 'needs_confirmation';
    case 'blocked':
    case 'parse_failed':
    case 'dry_run_only':
      return 'blocked';
    default:
      return 'blocked';
  }
}
