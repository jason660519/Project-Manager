import { describe, expect, test } from 'vitest';
import { KEY_PERSONAL_MOBILE_REMOTE_APPROVALS } from '../lib/storage/keys';
import {
  appendMobileRemoteApproval,
  clearMobileRemoteApprovals,
  loadMobileRemoteApprovals,
  MOBILE_REMOTE_APPROVAL_LIMIT,
  updateMobileRemoteApprovalStatus,
} from '../lib/mobileRemote/approvalQueue';

describe('mobile remote approval queue', () => {
  test('stores pending approvals newest-first and updates status', () => {
    clearMobileRemoteApprovals(window.localStorage);

    appendMobileRemoteApproval(
      {
        id: 'approval-1',
        createdAt: '2026-06-04T01:00:00.000Z',
        updatedAt: '2026-06-04T01:00:00.000Z',
        source: 'telegram',
        deviceId: 'telegram:channel:1',
        rawInput: '/run F46',
        intent: { type: 'run_feature', featureId: 'F46', mode: 'dry_run' },
        responsePreview: 'Guarded run request prepared for [F46].',
      },
      window.localStorage,
    );
    appendMobileRemoteApproval(
      {
        id: 'approval-2',
        createdAt: '2026-06-04T01:01:00.000Z',
        updatedAt: '2026-06-04T01:01:00.000Z',
        source: 'telegram',
        deviceId: 'telegram:channel:1',
        rawInput: '/run verify',
        intent: { type: 'run_gate', gate: 'verify_baseline' },
        responsePreview: 'Guarded gate request prepared.',
      },
      window.localStorage,
    );

    expect(loadMobileRemoteApprovals(window.localStorage).map((approval) => approval.id)).toEqual([
      'approval-2',
      'approval-1',
    ]);

    const updated = updateMobileRemoteApprovalStatus(
      'approval-1',
      'rejected',
      window.localStorage,
    );

    expect(updated).toMatchObject({ id: 'approval-1', status: 'rejected' });
    expect(
      loadMobileRemoteApprovals(window.localStorage).find((approval) => approval.id === 'approval-1')
        ?.status,
    ).toBe('rejected');
  });

  test('caps stored approvals', () => {
    clearMobileRemoteApprovals(window.localStorage);

    for (let index = 0; index < MOBILE_REMOTE_APPROVAL_LIMIT + 3; index += 1) {
      appendMobileRemoteApproval(
        {
          id: `approval-${index}`,
          source: 'telegram',
          deviceId: 'telegram:channel:1',
          rawInput: `/run F${index}`,
          intent: { type: 'run_feature', featureId: `F${index}`, mode: 'dry_run' },
          responsePreview: `Guarded run request prepared for [F${index}].`,
        },
        window.localStorage,
      );
    }

    const approvals = loadMobileRemoteApprovals(window.localStorage);
    expect(approvals).toHaveLength(MOBILE_REMOTE_APPROVAL_LIMIT);
    expect(approvals[0]?.id).toBe(`approval-${MOBILE_REMOTE_APPROVAL_LIMIT + 2}`);
    expect(approvals.at(-1)?.id).toBe('approval-3');
  });

  test('survives malformed approval storage', () => {
    window.localStorage.setItem(KEY_PERSONAL_MOBILE_REMOTE_APPROVALS, '{bad json');

    expect(loadMobileRemoteApprovals(window.localStorage)).toEqual([]);
    expect(updateMobileRemoteApprovalStatus('missing', 'approved', window.localStorage)).toBeNull();
  });
});
