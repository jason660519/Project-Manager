import { describe, expect, it } from 'vitest';
import { DISCOVERY_PROBE_REGISTRY, probesForScope } from '../lib/integrations/discovery/registry';

describe('discovery probe registry (F33)', () => {
  it('declares scope kinds for each built-in probe', () => {
    for (const probe of DISCOVERY_PROBE_REGISTRY) {
      expect(probe.scopeKinds.length).toBeGreaterThan(0);
    }
  });

  it('returns passive LAN probes without nmap', () => {
    const ids = probesForScope({ kind: 'lan', mode: 'passive' });
    expect(ids).toEqual(expect.arrayContaining(['arp', 'bonjour', 'docker-local']));
    expect(ids).not.toContain('nmap');
  });

  it('returns active LAN probes including nmap', () => {
    const ids = probesForScope({ kind: 'lan', mode: 'active', cidrs: [] });
    expect(ids).toContain('nmap');
  });

  it('includes nmap for host scope', () => {
    const ids = probesForScope({ kind: 'host', address: '192.168.1.10' });
    expect(ids).toContain('nmap');
  });
});
