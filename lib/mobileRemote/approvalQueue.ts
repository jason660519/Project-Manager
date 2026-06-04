import { KEY_PERSONAL_MOBILE_REMOTE_APPROVALS } from '../storage/keys';
import type { MobileRemoteIntent } from './intents';

export type MobileRemoteApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface MobileRemoteApprovalRequest {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: MobileRemoteApprovalStatus;
  source: 'telegram' | 'mobile_app';
  deviceId: string;
  rawInput: string;
  intent: Extract<MobileRemoteIntent, { type: 'run_feature' | 'run_gate' }>;
  responsePreview: string;
}

export const MOBILE_REMOTE_APPROVAL_LIMIT = 100;

function nowIso(): string {
  return new Date().toISOString();
}

function makeApprovalId(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);
  return `mobile-approval-${random}`;
}

function readApprovalStorage(storage: Storage): MobileRemoteApprovalRequest[] {
  try {
    const raw = storage.getItem(KEY_PERSONAL_MOBILE_REMOTE_APPROVALS);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as MobileRemoteApprovalRequest[]) : [];
  } catch {
    return [];
  }
}

function writeApprovalStorage(storage: Storage, approvals: MobileRemoteApprovalRequest[]): void {
  try {
    storage.setItem(KEY_PERSONAL_MOBILE_REMOTE_APPROVALS, JSON.stringify(approvals));
  } catch {
    /* disabled storage or quota */
  }
}

export function loadMobileRemoteApprovals(
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): MobileRemoteApprovalRequest[] {
  if (!storage) return [];
  return readApprovalStorage(storage);
}

export function appendMobileRemoteApproval(
  input: Omit<MobileRemoteApprovalRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'> &
    Partial<Pick<MobileRemoteApprovalRequest, 'id' | 'createdAt' | 'updatedAt' | 'status'>>,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): MobileRemoteApprovalRequest {
  const timestamp = nowIso();
  const approval: MobileRemoteApprovalRequest = {
    ...input,
    id: input.id ?? makeApprovalId(),
    createdAt: input.createdAt ?? timestamp,
    updatedAt: input.updatedAt ?? input.createdAt ?? timestamp,
    status: input.status ?? 'pending',
  };

  if (!storage) return approval;

  const next = [approval, ...readApprovalStorage(storage)].slice(0, MOBILE_REMOTE_APPROVAL_LIMIT);
  writeApprovalStorage(storage, next);
  return approval;
}

export function updateMobileRemoteApprovalStatus(
  id: string,
  status: MobileRemoteApprovalStatus,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): MobileRemoteApprovalRequest | null {
  if (!storage) return null;
  const approvals = readApprovalStorage(storage);
  let updated: MobileRemoteApprovalRequest | null = null;
  const next = approvals.map((approval) => {
    if (approval.id !== id) return approval;
    updated = {
      ...approval,
      status,
      updatedAt: nowIso(),
    };
    return updated;
  });
  if (updated) writeApprovalStorage(storage, next);
  return updated;
}

export function clearMobileRemoteApprovals(
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  if (!storage) return;
  try {
    storage.removeItem(KEY_PERSONAL_MOBILE_REMOTE_APPROVALS);
  } catch {
    /* disabled storage */
  }
}
