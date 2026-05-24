import { describe, expect, it } from 'vitest';
import { isUsable, transition } from '../lib/capabilities/state-machine';
import type { CandidateState, CandidateTestResult } from '../lib/types';

const PASS_RESULT: CandidateTestResult = { ok: true, durationMs: 100, message: 'ok' };
const FAIL_RESULT: CandidateTestResult = { ok: false, durationMs: 100, message: 'no PASS marker' };

describe('capability candidate state machine (F23 Step 1)', () => {
  // T-08
  it('moves not_tested → testing on start_test', () => {
    const out = transition({ state: 'not_tested' }, { type: 'start_test' });
    expect(out.state).toBe('testing');
  });

  // T-09
  it('moves testing → passed on pass_and_enable and stamps lastTestedAt + result', () => {
    const out = transition(
      { state: 'testing' },
      { type: 'pass_and_enable', result: PASS_RESULT },
      '2026-05-24T12:00:00.000Z',
    );
    expect(out.state).toBe('passed');
    expect(out.lastTestResult).toEqual(PASS_RESULT);
    expect(out.lastTestedAt).toBe('2026-05-24T12:00:00.000Z');
  });

  // T-10
  it('moves testing → passed_disabled on pass_and_disable', () => {
    const out = transition(
      { state: 'testing' },
      { type: 'pass_and_disable', result: PASS_RESULT },
    );
    expect(out.state).toBe('passed_disabled');
    expect(out.lastTestResult).toEqual(PASS_RESULT);
  });

  // T-11
  it('moves testing → failed and carries failure reason', () => {
    const out = transition({ state: 'testing' }, { type: 'fail', result: FAIL_RESULT });
    expect(out.state).toBe('failed');
    expect(out.lastTestResult?.message).toBe('no PASS marker');
  });

  // T-12
  it('moves failed → testing on retry and preserves previous result until a new one lands', () => {
    const before = {
      state: 'failed' as CandidateState,
      lastTestResult: FAIL_RESULT,
      lastTestedAt: '2026-05-23T00:00:00.000Z',
    };
    const out = transition(before, { type: 'start_test' });
    expect(out.state).toBe('testing');
    expect(out.lastTestResult).toEqual(FAIL_RESULT);
    expect(out.lastTestedAt).toBe('2026-05-23T00:00:00.000Z');
  });

  // T-13
  it('toggles passed → passed_disabled without rerunning the test', () => {
    const before = {
      state: 'passed' as CandidateState,
      lastTestResult: PASS_RESULT,
      lastTestedAt: '2026-05-23T00:00:00.000Z',
    };
    const out = transition(before, { type: 'toggle_off' });
    expect(out.state).toBe('passed_disabled');
    expect(out.lastTestResult).toEqual(PASS_RESULT);
    expect(out.lastTestedAt).toBe('2026-05-23T00:00:00.000Z');
  });

  // T-14
  it('toggles passed_disabled → passed without rerunning the test', () => {
    const out = transition(
      { state: 'passed_disabled', lastTestResult: PASS_RESULT },
      { type: 'toggle_on' },
    );
    expect(out.state).toBe('passed');
  });

  // T-15
  it('throws on invalid transitions', () => {
    expect(() =>
      transition({ state: 'not_tested' }, { type: 'pass_and_enable', result: PASS_RESULT }),
    ).toThrow(/invalid transition/i);
    expect(() =>
      transition({ state: 'testing' }, { type: 'toggle_on' }),
    ).toThrow(/invalid transition/i);
    expect(() =>
      transition({ state: 'passed' }, { type: 'pass_and_enable', result: PASS_RESULT }),
    ).toThrow(/invalid transition/i);
  });

  it('isUsable returns true only for passed', () => {
    expect(isUsable('passed')).toBe(true);
    expect(isUsable('passed_disabled')).toBe(false);
    expect(isUsable('not_tested')).toBe(false);
    expect(isUsable('testing')).toBe(false);
    expect(isUsable('failed')).toBe(false);
  });
});
