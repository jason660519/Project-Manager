/** Built-in discovery probes executed by the Tauri orchestrator (P0). */

export const BUILTIN_DISCOVERY_PROBE_IDS = [
  'arp',
  'bonjour',
  'docker-local',
  'nmap',
] as const;

export type BuiltinDiscoveryProbeId = (typeof BUILTIN_DISCOVERY_PROBE_IDS)[number];

export type DiscoveryScopeKind = 'local' | 'lan' | 'host';

export type LanDiscoveryMode = 'passive' | 'active';

export type DiscoveryScope =
  | { kind: 'local' }
  | { kind: 'lan'; mode: LanDiscoveryMode; cidrs?: string[] }
  | { kind: 'host'; address: string };

export interface DiscoveryPlan {
  /** Optional preset id for UI round-trip (e.g. passive-lan). */
  presetId?: string;
  scope: DiscoveryScope;
  probes: BuiltinDiscoveryProbeId[];
}

export interface DiscoveryPlanValidationResult {
  ok: boolean;
  errors: string[];
}

export const DISCOVERY_LAST_PLAN_STORAGE_KEY = 'pm-discovery-last-plan-v1';
