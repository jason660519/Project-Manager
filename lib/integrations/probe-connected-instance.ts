import { readFile } from '../bridge';
import type { IntegrationRow } from './types';

export interface ConnectedInstanceProbeResult {
  ok: boolean;
  detail: string;
}

const PROBE_TIMEOUT_MS = 6_000;

function payloadString(row: IntegrationRow, key: string): string {
  const value = row.payload[key];
  return typeof value === 'string' ? value : '';
}

function normalizeHttpUrl(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('//')) return `http:${trimmed}`;
  return `http://${trimmed}`;
}

function normalizeProbeUrl(address: string): string | null {
  const trimmed = address.trim();
  if (!trimmed) return null;
  if (/^wss:\/\//i.test(trimmed)) return trimmed.replace(/^wss:/i, 'https:');
  if (/^ws:\/\//i.test(trimmed)) return trimmed.replace(/^ws:/i, 'http:');
  return normalizeHttpUrl(trimmed);
}

async function probeHttpReachability(address: string): Promise<ConnectedInstanceProbeResult> {
  const url = normalizeProbeUrl(address);
  if (!url) {
    return { ok: false, detail: 'No address configured' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });
    if (res.ok) {
      return { ok: true, detail: `HTTP ${res.status}` };
    }
    return { ok: false, detail: `HTTP ${res.status}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/abort/i.test(message)) {
      return { ok: false, detail: 'Timed out' };
    }
    try {
      await fetch(url, { method: 'HEAD', mode: 'no-cors', signal: controller.signal });
      return { ok: true, detail: 'Reachable (network OK)' };
    } catch {
      return { ok: false, detail: message || 'Unreachable' };
    }
  } finally {
    clearTimeout(timer);
  }
}

async function probeFilesystemPath(path: string): Promise<ConnectedInstanceProbeResult> {
  const trimmed = path.trim();
  if (!trimmed) {
    return { ok: false, detail: 'No path configured' };
  }
  const candidates = [
    trimmed,
    `${trimmed.replace(/\/+$/, '')}/package.json`,
    `${trimmed.replace(/\/+$/, '')}/README.md`,
  ];
  let lastError = 'Path not readable';
  for (const candidate of candidates) {
    try {
      await readFile(candidate);
      return { ok: true, detail: candidate === trimmed ? 'Path readable' : `Found ${candidate.split('/').pop()}` };
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  return { ok: false, detail: lastError };
}

/**
 * Best-effort reachability probe for a connected-instance inventory row.
 * Does not store credentials or mutate instance configuration.
 */
export async function probeConnectedInstanceAvailability(
  row: IntegrationRow,
): Promise<ConnectedInstanceProbeResult> {
  const address = row.installPath.trim();
  const accessType = payloadString(row, 'accessType');
  const approvalState = payloadString(row, 'approvalState');

  if (!address) {
    return { ok: false, detail: 'No address configured' };
  }

  if (address.startsWith('docker://')) {
    return { ok: true, detail: 'Docker metadata observed in latest discovery' };
  }

  if (approvalState === 'pending' && !/^(https?:|wss?:)/i.test(address)) {
    return { ok: false, detail: 'Observed only — review before active probing' };
  }

  switch (accessType) {
    case 'filesystem':
      return probeFilesystemPath(address);
    case 'http':
    case 'api':
    case 'websocket':
      return probeHttpReachability(address);
    case 'ssh':
      return {
        ok: false,
        detail: 'SSH host — open a terminal session to verify',
      };
    case 'vpn':
      return {
        ok: false,
        detail: 'VPN tunnel — verify outside Project Manager',
      };
    default:
      return probeHttpReachability(address);
  }
}
