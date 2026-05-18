import path from 'node:path';
import {
  ExecutionContext,
  ExecutionResult,
  IDEAdapterConfig,
  RuntimeAdapter,
} from '../types';

export class LocalIDEAdapter implements RuntimeAdapter {
  id: string;
  name: string;
  type: 'ide' = 'ide';
  private command: string;

  constructor(config: IDEAdapterConfig) {
    this.id = config.id;
    this.name = config.name;
    this.command = config.command;
  }

  async execute(context: ExecutionContext): Promise<ExecutionResult> {
    const { feature, projectRoot } = context;
    const filePath = feature.paths.implementation || feature.paths.tdd || feature.paths.spec || '.';

    const normalizedRoot = path.resolve(projectRoot);
    const fullPath = path.resolve(normalizedRoot, filePath);

    if (!fullPath.startsWith(`${normalizedRoot}${path.sep}`) && fullPath !== normalizedRoot) {
      return { success: false, message: '路徑超出專案根目錄，已拒絕執行' };
    }

    return {
      success: true,
      message: `已嘗試在 ${this.name} 中開啟 ${filePath}`,
      command: this.command,
      args: [fullPath],
      dryRun: true,
      logs: `Dry run: ${this.command} ${JSON.stringify(fullPath)}`,
    };
  }
}
