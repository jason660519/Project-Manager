export * from './types';
export * from './presets';
export * from './registry';
export * from './validate';
export * from './plan-mutations';
export * from './summarize';

import { defaultDiscoveryPlan } from './presets';
import { DISCOVERY_LAST_PLAN_STORAGE_KEY, type DiscoveryPlan } from './types';

export function loadLastDiscoveryPlan(): DiscoveryPlan {
  if (typeof window === 'undefined') return defaultDiscoveryPlan();
  try {
    const raw = window.localStorage.getItem(DISCOVERY_LAST_PLAN_STORAGE_KEY);
    if (!raw) return defaultDiscoveryPlan();
    const parsed = JSON.parse(raw) as DiscoveryPlan;
    if (!parsed?.scope || !Array.isArray(parsed.probes)) return defaultDiscoveryPlan();
    return parsed;
  } catch {
    return defaultDiscoveryPlan();
  }
}

export function saveLastDiscoveryPlan(plan: DiscoveryPlan): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISCOVERY_LAST_PLAN_STORAGE_KEY, JSON.stringify(plan));
  } catch {
    // localStorage may be unavailable; non-fatal
  }
}
