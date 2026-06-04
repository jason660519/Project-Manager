import { describe, expect, test } from 'vitest';
import { KEY_PERSONAL_MOBILE_REMOTE_AUDIT } from '../lib/storage/keys';
import {
  appendMobileRemoteAuditEvent,
  clearMobileRemoteAuditEvents,
  loadMobileRemoteAuditEvents,
  MOBILE_REMOTE_AUDIT_LIMIT,
  policyDecisionFromParse,
  resultStateFromPolicy,
} from '../lib/mobileRemote/audit';

describe('mobile remote audit storage', () => {
  test('appends newest-first audit entries and clears them', () => {
    clearMobileRemoteAuditEvents(window.localStorage);

    appendMobileRemoteAuditEvent(
      {
        id: 'audit-1',
        receivedAt: '2026-06-04T01:00:00.000Z',
        deviceId: 'telegram:channel:1',
        channel: 'telegram',
        rawInputKind: 'text',
        rawInput: '/status',
        parseStatus: 'parsed',
        intent: { type: 'get_project_status' },
        policyDecision: 'allowed',
        resultState: 'completed',
      },
      window.localStorage,
    );
    appendMobileRemoteAuditEvent(
      {
        id: 'audit-2',
        receivedAt: '2026-06-04T01:01:00.000Z',
        deviceId: 'telegram:channel:1',
        channel: 'telegram',
        rawInputKind: 'text',
        rawInput: '/run F46',
        parseStatus: 'parsed',
        intent: { type: 'run_feature', featureId: 'F46', mode: 'dry_run' },
        policyDecision: 'guarded',
        resultState: 'needs_confirmation',
      },
      window.localStorage,
    );

    expect(loadMobileRemoteAuditEvents(window.localStorage).map((event) => event.id)).toEqual([
      'audit-2',
      'audit-1',
    ]);

    clearMobileRemoteAuditEvents(window.localStorage);
    expect(loadMobileRemoteAuditEvents(window.localStorage)).toEqual([]);
  });

  test('caps the audit ring buffer', () => {
    clearMobileRemoteAuditEvents(window.localStorage);

    for (let index = 0; index < MOBILE_REMOTE_AUDIT_LIMIT + 5; index += 1) {
      appendMobileRemoteAuditEvent(
        {
          id: `audit-${index}`,
          receivedAt: `2026-06-04T01:${String(index % 60).padStart(2, '0')}:00.000Z`,
          deviceId: 'telegram:channel:1',
          channel: 'telegram',
          rawInputKind: 'text',
          rawInput: '/status',
          parseStatus: 'parsed',
          intent: { type: 'get_project_status' },
          policyDecision: 'allowed',
          resultState: 'completed',
        },
        window.localStorage,
      );
    }

    const events = loadMobileRemoteAuditEvents(window.localStorage);
    expect(events).toHaveLength(MOBILE_REMOTE_AUDIT_LIMIT);
    expect(events[0]?.id).toBe(`audit-${MOBILE_REMOTE_AUDIT_LIMIT + 4}`);
    expect(events.at(-1)?.id).toBe('audit-5');
  });

  test('maps parse status to conservative policy/result states', () => {
    expect(
      policyDecisionFromParse({
        parseStatus: 'parsed',
        intent: { type: 'get_project_status' },
      }),
    ).toBe('allowed');
    expect(
      policyDecisionFromParse({
        parseStatus: 'parsed',
        intent: { type: 'run_feature', featureId: 'F46', mode: 'dry_run' },
      }),
    ).toBe('guarded');
    expect(policyDecisionFromParse({ parseStatus: 'blocked' })).toBe('blocked');
    expect(policyDecisionFromParse({ parseStatus: 'unsupported' })).toBe('parse_failed');

    expect(resultStateFromPolicy('allowed')).toBe('completed');
    expect(resultStateFromPolicy('guarded')).toBe('needs_confirmation');
    expect(resultStateFromPolicy('blocked')).toBe('blocked');
  });

  test('survives malformed stored audit JSON', () => {
    window.localStorage.setItem(KEY_PERSONAL_MOBILE_REMOTE_AUDIT, '{bad json');

    expect(loadMobileRemoteAuditEvents(window.localStorage)).toEqual([]);
  });
});
