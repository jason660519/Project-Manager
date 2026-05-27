import { describe, expect, it } from 'vitest';
import { discoveryPresetById } from '../lib/integrations/discovery/presets';
import { validateDiscoveryPlan } from '../lib/integrations/discovery/validate';

describe('discovery plan validation (F33)', () => {
  it('passive-lan preset is valid', () => {
    const preset = discoveryPresetById('passive-lan');
    expect(preset).toBeDefined();
    const result = validateDiscoveryPlan(preset!.plan);
    expect(result.ok).toBe(true);
    expect(preset!.plan.probes).toEqual(expect.arrayContaining(['arp', 'bonjour', 'docker-local']));
  });

  it('rejects active LAN with nmap but no CIDRs', () => {
    const result = validateDiscoveryPlan({
      scope: { kind: 'lan', mode: 'active', cidrs: [] },
      probes: ['nmap'],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes('CIDR'))).toBe(true);
  });

  it('rejects nmap on passive LAN', () => {
    const result = validateDiscoveryPlan({
      scope: { kind: 'lan', mode: 'passive' },
      probes: ['nmap'],
    });
    expect(result.ok).toBe(false);
  });

  it('requires host address for host scope with nmap', () => {
    const result = validateDiscoveryPlan({
      scope: { kind: 'host', address: '' },
      probes: ['nmap'],
    });
    expect(result.ok).toBe(false);
  });

  it('rejects empty probe list', () => {
    const result = validateDiscoveryPlan({
      scope: { kind: 'local' },
      probes: [],
    });
    expect(result.ok).toBe(false);
  });
});
