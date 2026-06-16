import { describe, expect, it } from 'vitest';
import {
  createProjectWorkflowRun,
  getProjectWorkflowTemplateById,
} from '../lib/project-workflows';
import {
  listProjectWorkflowRuns,
  projectWorkflowRunPath,
  serializeProjectWorkflowRun,
  type ProjectWorkflowRunStoreAdapter,
} from '../lib/project-workflows/projectWorkflowRunStore';

describe('project workflow run store', () => {
  it('loads sidecars through the adapter list/read contract used by browser dev and Tauri', async () => {
    const template = getProjectWorkflowTemplateById('software-engineering-loop')!;
    const run = createProjectWorkflowRun(template, {
      projectId: 'project-manager',
      workItemId: 'F54',
      now: '2026-06-16T07:30:00.000Z',
    });
    const path = projectWorkflowRunPath('/repo/Project-Manager', run.id);
    const files = new Map([[path, serializeProjectWorkflowRun(run)]]);
    const adapter: ProjectWorkflowRunStoreAdapter = {
      readFile: async (targetPath) => {
        const content = files.get(targetPath);
        if (!content) throw new Error(`Missing file: ${targetPath}`);
        return content;
      },
      writeFile: async (targetPath, content) => {
        files.set(targetPath, content);
      },
      listProjectFiles: async () => [
        {
          name: `${run.id}.json`,
          path,
          isDir: false,
          children: [],
        },
      ],
    };

    await expect(listProjectWorkflowRuns('/repo/Project-Manager', adapter)).resolves.toEqual([run]);
  });
});
