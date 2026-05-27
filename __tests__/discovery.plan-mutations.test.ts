import { describe, expect, it } from 'vitest';
import { discoveryPresetById } from '../lib/integrations/discovery/presets';
import { applyLanMode, applyProbeToggle } from '../lib/integrations/discovery/plan-mutations';
import { probesForScope } from '../lib/integrations/discovery/registry';
import { validateDiscoveryPlan } from '../lib/integrations/discovery/validate';

describe('discovery plan mutations (F33 UX)', () => {
  it('excludes nmap from compatible probes on passive LAN', () => {
    const ids = probesForScope({ kind: 'lan', mode: 'passive' });
    expect(ids).toContain('arp');
    expect(ids).not.toContain('nmap');
  });

  it('includes nmap on active LAN', () => {
    const ids = probesForScope({ kind: 'lan', mode: 'active', cidrs: [] });
    expect(ids).toContain('nmap');
  });

  it('checking nmap on passive LAN switches to active mode', () => {
    const passive = discoveryPresetById('passive-lan')!.plan;
    const next = applyProbeToggle(passive, 'nmap', true);
    expect(next.scope).toEqual({ kind: 'lan', mode: 'active', cidrs: [] });
    expect(next.probes).toContain('nmap');
  });

  it('passive LAN + nmap is valid after auto-switch only when CIDR provided', () => {
    const passive = discoveryPresetById('passive-lan')!.plan;
    const withNmap = applyProbeToggle(passive, 'nmap', true);
    expect(validateDiscoveryPlan(withNmap).ok).toBe(false);
    const withCidr = {
      ...withNmap,
      scope: { kind: 'lan' as const, mode: 'active' as const, cidrs: ['192.168.1.0/24'] },
    };
    expect(validateDiscoveryPlan(withCidr).ok).toBe(true);
  });

  it('switching LAN to passive removes nmap probe', () => {
    const active = discoveryPresetById('active-intranet')!.plan;
    const passive = applyLanMode(active, 'passive');
    expect(passive.probes).not.toContain('nmap');
    expect(passive.scope).toMatchObject({ kind: 'lan', mode: 'passive' });
  });
});
