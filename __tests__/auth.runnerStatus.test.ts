import { describe, expect, it } from 'vitest';
import { resolveDeveloperRunnerStatus } from '../lib/auth/runnerStatus';

describe('Developer Runner status model', () => {
  it('blocks dispatch when no runner is paired', () => {
    expect(
      resolveDeveloperRunnerStatus({
        paired: false,
        online: false,
        projectApproved: false,
      }),
    ).toMatchObject({
      state: 'missing',
      canDispatch: false,
      label: 'Runner not connected',
    });
  });

  it('blocks dispatch when the paired runner is offline', () => {
    expect(
      resolveDeveloperRunnerStatus({
        paired: true,
        online: false,
        projectApproved: true,
      }),
    ).toMatchObject({
      state: 'paired_offline',
      canDispatch: false,
      label: 'Runner offline',
    });
  });

  it('blocks dispatch when the runner has not approved the project root', () => {
    expect(
      resolveDeveloperRunnerStatus({
        paired: true,
        online: true,
        projectApproved: false,
      }),
    ).toMatchObject({
      state: 'project_blocked',
      canDispatch: false,
      label: 'Project access blocked',
    });
  });

  it('allows dispatch only when paired, online, and project-approved', () => {
    expect(
      resolveDeveloperRunnerStatus({
        paired: true,
        online: true,
        projectApproved: true,
      }),
    ).toMatchObject({
      state: 'ready',
      canDispatch: true,
      label: 'Runner ready',
    });
  });

  it('keeps runner errors visible and non-dispatchable', () => {
    expect(
      resolveDeveloperRunnerStatus({
        paired: true,
        online: true,
        projectApproved: true,
        error: 'Runner heartbeat expired.',
      }),
    ).toEqual({
      state: 'error',
      canDispatch: false,
      label: 'Runner status error',
      recovery: 'Runner heartbeat expired.',
    });
  });
});
