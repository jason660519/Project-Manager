import { describe, expect, it, vi, afterEach } from 'vitest';
import { buildConnectedInstanceRows } from '../lib/integrations/mappers/connected-instances';
import { probeConnectedInstanceAvailability } from '../lib/integrations/probe-connected-instance';

vi.mock('../lib/bridge', () => ({
  readFile: vi.fn(),
}));

import { readFile } from '../lib/bridge';

function row(id: string) {
  const found = buildConnectedInstanceRows().find((r) => r.sourceId === id);
  if (!found) throw new Error(`Missing connected instance row: ${id}`);
  return found;
}

describe('probeConnectedInstanceAvailability', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports missing address', async () => {
    const r = row('project-manager-local');
    const result = await probeConnectedInstanceAvailability({ ...r, installPath: '' });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/no address/i);
  });

  it('reads filesystem paths via the bridge', async () => {
    vi.mocked(readFile).mockResolvedValueOnce('ok');
    const result = await probeConnectedInstanceAvailability(row('project-manager-local'));
    expect(result.ok).toBe(true);
    expect(readFile).toHaveBeenCalled();
  });

  it('does not probe ssh rows as HTTP', async () => {
    const result = await probeConnectedInstanceAvailability(row('living-room-server'));
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/ssh/i);
  });

  it('does not actively probe pending observed LAN devices', async () => {
    const base = row('project-manager-local');
    const result = await probeConnectedInstanceAvailability({
      ...base,
      installPath: 'lab-mini (192.168.1.99)',
      payload: { ...base.payload, accessType: 'api', approvalState: 'pending' },
    });
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/observed only/i);
  });
});
