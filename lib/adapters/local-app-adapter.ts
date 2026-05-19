import {
  AgentAppAdapterConfig,
  ExecutionContext,
  ExecutionResult,
  RuntimeAdapter,
} from '../types';

export class LocalAppAdapter implements RuntimeAdapter {
  id: string;
  name: string;
  type: 'app' = 'app';
  targetKind: 'agent-app' = 'agent-app';
  private command: string;
  private argsTemplate: string[];

  constructor(config: AgentAppAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.command = config.command;
    this.argsTemplate = config.argsTemplate;
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { feature, prompt, projectRoot } = context;
    const args = this.argsTemplate.map((arg) =>
      arg
        .replaceAll('{prompt}', prompt ?? '')
        .replaceAll('{featureId}', feature.id)
        .replaceAll('{root}', projectRoot),
    );

    return {
      success: true,
      message: `${this.name} opened for task ${feature.id}`,
      command: this.command,
      args,
      dryRun: true,
      logs: `Dry run: ${this.command} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
    };
  }
}
