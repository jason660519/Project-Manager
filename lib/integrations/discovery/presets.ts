import type { DiscoveryPlan } from './types';

export interface DiscoveryPreset {
  id: string;
  label: string;
  description: string;
  plan: DiscoveryPlan;
}

export const BUILTIN_DISCOVERY_PRESETS: readonly DiscoveryPreset[] = [
  {
    id: 'passive-lan',
    label: 'Passive LAN',
    description: 'ARP cache, Bonjour/mDNS, and local Docker (low risk).',
    plan: {
      presetId: 'passive-lan',
      scope: { kind: 'lan', mode: 'passive' },
      probes: ['arp', 'bonjour', 'docker-local'],
    },
  },
  {
    id: 'active-intranet',
    label: 'Active intranet',
    description: 'Passive probes plus nmap host discovery on private CIDRs you specify.',
    plan: {
      presetId: 'active-intranet',
      scope: { kind: 'lan', mode: 'active', cidrs: [] },
      probes: ['arp', 'bonjour', 'docker-local', 'nmap'],
    },
  },
  {
    id: 'local-only',
    label: 'This Mac only',
    description: 'Local Docker and Bonjour services on loopback/LAN broadcast.',
    plan: {
      presetId: 'local-only',
      scope: { kind: 'local' },
      probes: ['bonjour', 'docker-local'],
    },
  },
  {
    id: 'host-target',
    label: 'Single host',
    description: 'Ping-style host discovery on one private IP or hostname.',
    plan: {
      presetId: 'host-target',
      scope: { kind: 'host', address: '' },
      probes: ['nmap'],
    },
  },
] as const;

export const DEFAULT_DISCOVERY_PRESET_ID = 'passive-lan';

export function discoveryPresetById(id: string): DiscoveryPreset | undefined {
  return BUILTIN_DISCOVERY_PRESETS.find((p) => p.id === id);
}

export function defaultDiscoveryPlan(): DiscoveryPlan {
  const preset = discoveryPresetById(DEFAULT_DISCOVERY_PRESET_ID);
  return preset ? structuredClone(preset.plan) : BUILTIN_DISCOVERY_PRESETS[0].plan;
}
