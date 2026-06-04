import { describe, expect, it } from 'vitest';

import {
  buildRescanFailure,
  formatRescanFailureLine,
  formatRescanFailureNotice,
} from '../lib/aiSdks/rescanErrors';

describe('aiSdks rescan error formatting', () => {
  it('classifies API key failures with actionable copy', () => {
    const failure = buildRescanFailure('anthropic', 'Anthropic 401: invalid_api_key');
    expect(failure.category).toBe('auth');
    expect(formatRescanFailureLine(failure, 'Anthropic')).toMatch(/API key rejected/);
  });

  it('classifies network failures', () => {
    const failure = buildRescanFailure('gemini', 'Network error: fetch failed');
    expect(failure.category).toBe('unreachable');
    expect(failure.summary.hint).toMatch(/network/i);
  });

  it('classifies quota and billing failures', () => {
    const failure = buildRescanFailure('openai', 'OpenAI 402: insufficient_quota');
    expect(failure.category).toBe('quota');
  });

  it('classifies service unavailable responses', () => {
    const failure = buildRescanFailure('gemini', 'Gemini 503: model overloaded');
    expect(failure.category).toBe('service_unavailable');
  });

  it('classifies parse errors from provider payloads', () => {
    const failure = buildRescanFailure('openai', 'Parse error: expected value at line 1');
    expect(failure.category).toBe('parse');
  });

  it('classifies permission errors separately from auth', () => {
    const failure = buildRescanFailure('gemini', 'Gemini 403: Permission denied for models.list');
    expect(failure.category).toBe('permission');
  });

  it('aggregates multiple provider failures for the notice banner', () => {
    const failures = [
      buildRescanFailure('anthropic', '401 invalid_api_key'),
      buildRescanFailure('gemini', 'Network error: timed out'),
    ];
    const notice = formatRescanFailureNotice(
      failures,
      new Map([
        ['anthropic', 'Anthropic'],
        ['gemini', 'Gemini (Google AI)'],
      ]),
    );
    expect(notice).toContain('Anthropic:');
    expect(notice).toContain('Gemini (Google AI):');
    expect(notice).toContain('\n');
  });
});
