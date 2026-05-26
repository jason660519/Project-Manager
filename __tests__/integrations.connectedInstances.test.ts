import { describe, expect, it } from 'vitest';
import {
  buildConnectedInstanceRows,
  buildScannedConnectedInstanceRows,
  connectedInstanceSearchText,
  type ConnectedInstanceScanSnapshot,
} from '../lib/integrations/mappers/connected-instances';
import { INTEGRATION_SHEETS, isCapabilitySheet } from '../lib/integrations/types';

function row(id: string) {
  const found = buildConnectedInstanceRows().find((r) => r.sourceId === id);
  if (!found) throw new Error(`Missing connected instance row: ${id}`);
  return found;
}

function payloadKeys(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => [
    key,
    ...payloadKeys(child),
  ]);
}

describe('connected instances integration sheet (F24)', () => {
  it('registers connected-instances as a first-class non-capability sheet', () => {
    expect(INTEGRATION_SHEETS).toContain('connected-instances');
    expect(isCapabilitySheet('connected-instances')).toBe(false);
  });

  it('seeds local Project Manager, Hermes, and OpenClaw runtime rows', () => {
    expect(row('project-manager-local').installPath).toBe('/Volumes/KLEVV-4T-1/Project-Manager');
    expect(row('hermes-local-dashboard').port).toBe('9119');
    expect(row('openclaw-local-dashboard').installPath).toBe('http://127.0.0.1:18790/');
    expect(row('openclaw-local-dashboard').port).toBe('18790');
  });

  it('seeds the living room intranet host and service endpoints', () => {
    expect(row('living-room-server').installPath).toBe('rick@192.168.1.6');
    expect(row('living-room-server').scope).toBe('intranet');
    expect(row('living-room-ollama').port).toBe('11434');
    expect(row('living-room-open-webui').port).toBe('38457');
    expect(row('living-room-comfyui').port).toBe('30000');
  });

  it('keeps connected instance rows searchable by user scenarios', () => {
    const rows = buildConnectedInstanceRows();
    const search = (term: string) =>
      rows.filter((r) => connectedInstanceSearchText(r).includes(term.toLowerCase())).map((r) => r.sourceId);

    expect(search('192.168.1.6')).toEqual(
      expect.arrayContaining([
        'living-room-server',
        'living-room-ollama',
        'living-room-open-webui',
        'living-room-comfyui',
      ]),
    );
    expect(search('OpenClaw')).toContain('openclaw-local-dashboard');
    expect(search('Ollama')).toEqual(expect.arrayContaining(['living-room-server', 'living-room-ollama']));
    expect(search('GPU')).toEqual(expect.arrayContaining(['living-room-server', 'living-room-comfyui']));
  });

  it('distinguishes local loopback risk from intranet risk', () => {
    expect(row('hermes-local-dashboard').payload.risk).toBe('loopback only');
    expect(row('living-room-ollama').payload.risk).toBe('private LAN API endpoint');
  });

  it('does not expose credential-like payload keys', () => {
    const forbidden = /(token|password|apiKey|secret|privateKey)/i;
    for (const r of buildConnectedInstanceRows()) {
      expect(payloadKeys(r.payload).filter((key) => forbidden.test(key))).toEqual([]);
    }
  });

  it('maps passive discovery results without duplicating seeded intranet hosts', () => {
    const snapshot: ConnectedInstanceScanSnapshot = {
      scannedAt: '2026-05-26T00:00:00Z',
      warnings: [],
      devices: [
        {
          id: 'known-living-room',
          ipAddress: '192.168.1.6',
          macAddress: 'aa:bb:cc:dd:ee:ff',
          source: 'arp',
          confidence: 'medium',
          lastSeenAt: '2026-05-26T00:00:00Z',
        },
        {
          id: 'new-device',
          ipAddress: '192.168.1.99',
          macAddress: '11:22:33:44:55:66',
          hostname: 'lab-mini',
          source: 'arp',
          confidence: 'medium',
          lastSeenAt: '2026-05-26T00:00:00Z',
        },
      ],
      containers: [
        {
          id: 'abc123',
          name: 'open-webui',
          image: 'ghcr.io/open-webui/open-webui:latest',
          state: 'running',
          status: 'Up 2 hours',
          ports: ['0.0.0.0:38457->8080/tcp'],
          source: 'docker',
          lastSeenAt: '2026-05-26T00:00:00Z',
        },
      ],
      services: [],
    };

    const seeded = buildConnectedInstanceRows();
    const rows = buildScannedConnectedInstanceRows(snapshot, seeded);

    expect(rows.map((r) => r.installPath)).not.toContain('192.168.1.6');
    expect(rows.find((r) => r.sourceId === 'scan-device-new-device')).toMatchObject({
      category1: 'Network Discovery',
      statusLabel: 'Observed',
      enabled: false,
    });
    expect(rows.find((r) => r.sourceId === 'scan-container-abc123')).toMatchObject({
      category2: 'Docker Container',
      status: 'running',
      port: '0.0.0.0:38457->8080/tcp',
      enabled: false,
    });
  });
});
