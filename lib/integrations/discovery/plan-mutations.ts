import type { BuiltinDiscoveryProbeId, DiscoveryPlan, LanDiscoveryMode } from './types';

/** Enable/disable a probe and adjust scope when probes require active LAN (nmap). */
export function applyProbeToggle(
  plan: DiscoveryPlan,
  probeId: BuiltinDiscoveryProbeId,
  enable: boolean,
): DiscoveryPlan {
  const has = plan.probes.includes(probeId);
  if (enable === has) return plan;

  const probes = enable ? [...plan.probes, probeId] : plan.probes.filter((p) => p !== probeId);
  let scope = plan.scope;
  let presetId = plan.presetId;

  if (enable && probeId === 'nmap') {
    if (scope.kind === 'local') {
      scope = { kind: 'lan', mode: 'active', cidrs: [] };
      presetId = undefined;
    } else if (scope.kind === 'lan' && scope.mode === 'passive') {
      scope = { kind: 'lan', mode: 'active', cidrs: [] };
      presetId = undefined;
    }
  }

  return { ...plan, probes, scope, presetId };
}

/** Switch LAN to passive and drop nmap (incompatible). */
export function applyLanMode(plan: DiscoveryPlan, mode: LanDiscoveryMode): DiscoveryPlan {
  if (plan.scope.kind !== 'lan') return plan;
  const probes =
    mode === 'passive' ? plan.probes.filter((p) => p !== 'nmap') : plan.probes;
  const prevCidrs = plan.scope.cidrs;
  return {
    ...plan,
    scope: {
      kind: 'lan',
      mode,
      cidrs: mode === 'active' ? prevCidrs ?? [] : undefined,
    },
    probes,
    presetId: mode === 'passive' && plan.presetId === 'active-intranet' ? undefined : plan.presetId,
  };
}
