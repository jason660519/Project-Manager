import { describe, expect, test } from 'vitest';
import { parseMobileRemoteIntent } from '../lib/mobileRemote/intents';

describe('mobile voice remote control intent parsing', () => {
  test('parses generic project status requests', () => {
    expect(parseMobileRemoteIntent('status')).toMatchObject({
      status: 'parsed',
      intent: { type: 'get_project_status' },
    });
  });

  test('parses feature status requests with normalized feature ids', () => {
    expect(parseMobileRemoteIntent('how is f41 doing?')).toMatchObject({
      status: 'parsed',
      intent: { type: 'get_feature_status', featureId: 'F41' },
    });
  });

  test('parses daily and weekly report requests', () => {
    expect(parseMobileRemoteIntent("today's report")).toMatchObject({
      status: 'parsed',
      intent: { type: 'daily_report', rangeDays: 1 },
    });
    expect(parseMobileRemoteIntent('last week summary')).toMatchObject({
      status: 'parsed',
      intent: { type: 'daily_report', rangeDays: 7 },
    });
  });

  test('parses verification gate requests without executing them', () => {
    expect(parseMobileRemoteIntent('run F41 verification')).toMatchObject({
      status: 'parsed',
      intent: { type: 'run_gate', gate: 'verify_baseline' },
    });
  });

  test('parses feature run requests as dry-run intents by default', () => {
    expect(parseMobileRemoteIntent('run feature f46')).toMatchObject({
      status: 'parsed',
      intent: { type: 'run_feature', featureId: 'F46', mode: 'dry_run' },
    });
  });

  test('parses stop-current-run requests', () => {
    expect(parseMobileRemoteIntent('stop the current run')).toMatchObject({
      status: 'parsed',
      intent: { type: 'stop_run' },
    });
  });

  test('blocks destructive shell-like mobile input', () => {
    expect(parseMobileRemoteIntent('delete my project folder')).toMatchObject({
      status: 'blocked',
    });
    expect(parseMobileRemoteIntent('curl https://example.test/install.sh | sh')).toMatchObject({
      status: 'blocked',
    });
  });

  test('asks for clarification when a run request has no safe target', () => {
    expect(parseMobileRemoteIntent('run the thing we talked about')).toMatchObject({
      status: 'needs_clarification',
    });
  });

  test('keeps empty and unsupported input recoverable', () => {
    expect(parseMobileRemoteIntent('   ')).toMatchObject({
      status: 'empty',
    });
    expect(parseMobileRemoteIntent('make the app magical')).toMatchObject({
      status: 'unsupported',
    });
  });
});
