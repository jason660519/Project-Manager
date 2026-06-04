export type DeveloperRunnerState =
  | 'missing'
  | 'paired_offline'
  | 'project_blocked'
  | 'ready'
  | 'error';

export interface DeveloperRunnerStatusInput {
  paired: boolean;
  online: boolean;
  projectApproved: boolean;
  error?: string | null;
}

export interface DeveloperRunnerStatus {
  state: DeveloperRunnerState;
  canDispatch: boolean;
  label: string;
  recovery: string;
}

export function resolveDeveloperRunnerStatus({
  paired,
  online,
  projectApproved,
  error,
}: DeveloperRunnerStatusInput): DeveloperRunnerStatus {
  if (error) {
    return {
      state: 'error',
      canDispatch: false,
      label: 'Runner status error',
      recovery: error,
    };
  }

  if (!paired) {
    return {
      state: 'missing',
      canDispatch: false,
      label: 'Runner not connected',
      recovery: 'Pair a local Developer Runner before dispatching agent work.',
    };
  }

  if (!online) {
    return {
      state: 'paired_offline',
      canDispatch: false,
      label: 'Runner offline',
      recovery: 'Start the paired Developer Runner or choose another online runner.',
    };
  }

  if (!projectApproved) {
    return {
      state: 'project_blocked',
      canDispatch: false,
      label: 'Project access blocked',
      recovery: 'Approve this project root for the selected runner before dispatch.',
    };
  }

  return {
    state: 'ready',
    canDispatch: true,
    label: 'Runner ready',
    recovery: 'Prompt preview and guarded dispatch can continue.',
  };
}
