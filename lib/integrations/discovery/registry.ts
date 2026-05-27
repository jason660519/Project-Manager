import type { BuiltinDiscoveryProbeId, DiscoveryScope, DiscoveryScopeKind } from './types';

export interface DiscoveryProbeDefinition {
  id: BuiltinDiscoveryProbeId;
  label: string;
  description: string;
  scopeKinds: readonly DiscoveryScopeKind[];
  risk: 'passive' | 'active';
}

export const DISCOVERY_PROBE_REGISTRY: readonly DiscoveryProbeDefinition[] = [
  {
    id: 'arp',
    label: 'ARP cache',
    description: 'Private IPs recently seen on local interfaces.',
    scopeKinds: ['lan'],
    risk: 'passive',
  },
  {
    id: 'bonjour',
    label: 'Bonjour / mDNS',
    description: 'Browse _http._tcp, _ssh._tcp, and related local services.',
    scopeKinds: ['local', 'lan'],
    risk: 'passive',
  },
  {
    id: 'docker-local',
    label: 'Docker (local)',
    description: 'Containers from the local Docker engine.',
    scopeKinds: ['local', 'lan'],
    risk: 'passive',
  },
  {
    id: 'nmap',
    label: 'nmap host scan',
    description:
      'Active -sn discovery on private targets. macOS: auto-installs via Homebrew when missing; dev setup: npm run discovery:install-nmap',
    scopeKinds: ['lan', 'host'],
    risk: 'active',
  },
];

export function probesForScope(scope: DiscoveryScope): BuiltinDiscoveryProbeId[] {
  return DISCOVERY_PROBE_REGISTRY.filter((p) => {
    if (!p.scopeKinds.includes(scope.kind)) return false;
    if (p.id === 'arp') return scope.kind === 'lan';
    if (p.id === 'nmap') {
      if (scope.kind === 'host') return true;
      if (scope.kind === 'lan' && scope.mode === 'active') return true;
      return false;
    }
    return true;
  }).map((p) => p.id);
}

export function probeDefinition(id: BuiltinDiscoveryProbeId): DiscoveryProbeDefinition | undefined {
  return DISCOVERY_PROBE_REGISTRY.find((p) => p.id === id);
}
