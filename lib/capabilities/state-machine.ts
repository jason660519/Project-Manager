import type { CandidateState, CandidateTestResult } from '../types';

/**
 * Pure state machine for capability candidates (schema v7, F23).
 *
 * Lifecycle:
 *   not_tested → testing → { passed | passed_disabled | failed }
 *   passed ↔ passed_disabled                       (toggle without retesting)
 *   passed | passed_disabled | failed → testing    (rerun via start_test)
 *
 * Throws on invalid transitions so callers never land in an unexpected state.
 */

export type CandidateEvent =
  | { type: 'start_test' }
  | { type: 'pass_and_enable'; result: CandidateTestResult }
  | { type: 'pass_and_disable'; result: CandidateTestResult }
  | { type: 'fail'; result: CandidateTestResult }
  | { type: 'toggle_on' }
  | { type: 'toggle_off' };

export interface CandidateSnapshot {
  state: CandidateState;
  lastTestedAt?: string;
  lastTestResult?: CandidateTestResult;
}

const VALID_TRANSITIONS: Record<CandidateState, ReadonlySet<CandidateEvent['type']>> = {
  not_tested:      new Set(['start_test']),
  testing:         new Set(['pass_and_enable', 'pass_and_disable', 'fail']),
  passed:          new Set(['start_test', 'toggle_off']),
  passed_disabled: new Set(['start_test', 'toggle_on']),
  failed:          new Set(['start_test']),
};

/** True when the candidate may be assigned to an engineer role. */
export function isUsable(state: CandidateState): boolean {
  return state === 'passed';
}

export function transition(
  current: CandidateSnapshot,
  event: CandidateEvent,
  now: string = new Date().toISOString(),
): CandidateSnapshot {
  const allowed = VALID_TRANSITIONS[current.state];
  if (!allowed.has(event.type)) {
    throw new Error(
      `Invalid transition: "${current.state}" cannot accept event "${event.type}"`,
    );
  }
  switch (event.type) {
    case 'start_test':
      // Preserve previous result until a new one lands.
      return { ...current, state: 'testing' };
    case 'pass_and_enable':
      return { state: 'passed',          lastTestedAt: now, lastTestResult: event.result };
    case 'pass_and_disable':
      return { state: 'passed_disabled', lastTestedAt: now, lastTestResult: event.result };
    case 'fail':
      return { state: 'failed',          lastTestedAt: now, lastTestResult: event.result };
    case 'toggle_on':
      return { ...current, state: 'passed' };
    case 'toggle_off':
      return { ...current, state: 'passed_disabled' };
  }
}
