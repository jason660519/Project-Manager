import { probesForScope } from './registry';
import type { DiscoveryPlan, DiscoveryPlanValidationResult } from './types';
import { BUILTIN_DISCOVERY_PROBE_IDS } from './types';

const PRIVATE_IPV4 =
  /^(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3})(\/\d{1,2})?$/;

function isPrivateTarget(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PRIVATE_IPV4.test(trimmed);
}

export function validateDiscoveryPlan(plan: DiscoveryPlan): DiscoveryPlanValidationResult {
  const errors: string[] = [];

  if (!plan.probes.length) {
    errors.push('Select at least one probe.');
  }

  for (const probe of plan.probes) {
    if (!BUILTIN_DISCOVERY_PROBE_IDS.includes(probe)) {
      errors.push(`Unknown probe: ${probe}`);
    }
  }

  const allowed = new Set(probesForScope(plan.scope));
  for (const probe of plan.probes) {
    if (!allowed.has(probe)) {
      errors.push(`Probe "${probe}" is not available for scope "${plan.scope.kind}".`);
    }
  }

  if (plan.scope.kind === 'lan' && plan.scope.mode === 'active' && plan.probes.includes('nmap')) {
    const cidrs = (plan.scope.cidrs ?? []).map((c) => c.trim()).filter(Boolean);
    if (cidrs.length === 0) {
      errors.push('Active intranet scan requires at least one private CIDR (e.g. 192.168.1.0/24).');
    }
    for (const cidr of cidrs) {
      if (!isPrivateTarget(cidr)) {
        errors.push(`Target is not a private IPv4 range: ${cidr}`);
      }
    }
  }

  if (plan.scope.kind === 'host') {
    const address = plan.scope.address.trim();
    if (!address) {
      errors.push('Enter a host IP or hostname for single-host discovery.');
    } else if (plan.probes.includes('nmap') && !isPrivateTarget(address) && !/^[a-z0-9.-]+$/i.test(address)) {
      errors.push('Host target must be a private IP or simple hostname.');
    }
  }

  if (plan.scope.kind === 'lan' && plan.scope.mode === 'passive' && plan.probes.includes('nmap')) {
    errors.push('nmap requires Active LAN or Single host scope.');
  }

  return { ok: errors.length === 0, errors };
}
