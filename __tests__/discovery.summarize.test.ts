import { describe, expect, it } from 'vitest';
import { summarizeDiscoverySnapshot } from '../lib/integrations/discovery/summarize';
import { buildConnectedInstanceRows } from '../lib/integrations/mappers/connected-instances';
import type { ConnectedInstanceScanSnapshot } from '../lib/integrations/mappers/connected-instances';

const emptySnapshot: ConnectedInstanceScanSnapshot = {
  scannedAt: '2026-05-27T00:00:00Z',
  warnings: [],
  devices: [],
  containers: [],
  services: [],
};

describe('summarizeDiscoverySnapshot (F33)', () => {
  it('lists existing seeded instances and new table rows separately', () => {
    const seeded = buildConnectedInstanceRows(null);
    const snapshot: ConnectedInstanceScanSnapshot = {
      ...emptySnapshot,
      devices: [
        {
          id: 'd1',
          ipAddress: '192.168.1.99',
          source: 'nmap',
          confidence: 'high',
          lastSeenAt: '2026-05-27T00:00:00Z',
        },
        {
          id: 'd-known',
          ipAddress: '192.168.1.6',
          source: 'nmap',
          confidence: 'high',
          lastSeenAt: '2026-05-27T00:00:00Z',
        },
      ],
    };
    const summary = summarizeDiscoverySnapshot(snapshot, 978, seeded);
    expect(summary.existingInstanceCount).toBeGreaterThan(0);
    expect(summary.newInstanceCount).toBe(1);
    expect(summary.newInstances[0]?.detail).toContain('192.168.1.99');
    expect(summary.skippedAsExistingCount).toBeGreaterThanOrEqual(1);
    expect(summary.skippedAsExisting.some((l) => l.detail.includes('192.168.1.6'))).toBe(true);
  });
});
