import {
  AgentAdapterConfig,
  ExecutionContext,
  ExecutionResult,
  RuntimeAdapter,
} from '../types';

export class AgentAdapter implements RuntimeAdapter {
  id: string;
  name: string;
  type: 'agent' = 'agent';
  private command: string;
  private argsTemplate: string[];

  constructor(config: AgentAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.command = config.command;
    this.argsTemplate = config.argsTemplate;
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { feature, prompt, projectRoot } = context;

    if (!prompt) {
      return { success: false, message: '未提供 Prompt，無法啟動 Agent' };
    }

    const args = this.argsTemplate.map((arg) =>
      arg
        .replaceAll('{prompt}', prompt)
        .replaceAll('{featureId}', feature.id)
        .replaceAll('{root}', projectRoot),
    );

    return {
      success: true,
      message: `${this.name} 任務已派遣 (ID: ${feature.id})`,
      command: this.command,
      args,
      dryRun: true,
      logs: `Dry run: ${this.command} ${args.map((arg) => JSON.stringify(arg)).join(' ')}`,
      externalUrl: `dev-pilot://tasks/${feature.id}`,
    };
  }
}
