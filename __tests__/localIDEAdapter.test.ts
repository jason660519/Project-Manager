import { describe, expect, it } from 'vitest';
import { LocalIDEAdapter } from '../lib/adapters/local-ide-adapter';
import type { ExecutionContext, Feature } from '../lib/types';

function featureWithImplementation(path: string): Feature {
  return {
    id: 'F99',
    name: 'Path Test',
    category: 'Frontend/UI',
    status: 'in_progress',
    progress: 10,
    phase: 'development',
    paths: { implementation: path },
  };
}

function context(path: string): ExecutionContext {
  return {
    feature: featureWithImplementation(path),
    projectRoot: '/Users/example/project',
  };
}

describe('LocalIDEAdapter', () => {
  const adapter = new LocalIDEAdapter({
    id: 'Cursor',
    name: 'Cursor',
    type: 'ide',
    command: 'cursor',
  });

  it('resolves relative implementation paths under the project root', async () => {
    const result = await adapter.execute(context('app/ui/MainClient.tsx'));

    expect(result).toMatchObject({
      success: true,
      args: ['/Users/example/project/app/ui/MainClient.tsx'],
    });
  });

  it('rejects traversal outside the project root', async () => {
    const result = await adapter.execute(context('../secrets.env'));

    expect(result).toMatchObject({
      success: false,
      message: '路徑超出專案根目錄，已拒絕執行',
    });
  });
});
