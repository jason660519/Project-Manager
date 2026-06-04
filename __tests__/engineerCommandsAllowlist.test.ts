import { describe, expect, it } from 'vitest';
import { partitionEngineerCommands } from '../app/ui/views/Engineers/shared';

describe('partitionEngineerCommands', () => {
  const exposed = ['git', 'npm', 'cargo', 'gh'];

  it('returns empty partitions for no selection', () => {
    expect(partitionEngineerCommands([], exposed)).toEqual({ active: [], stale: [] });
    expect(partitionEngineerCommands(undefined, exposed)).toEqual({ active: [], stale: [] });
  });

  it('splits selected commands into active (exposed) and stale (not exposed)', () => {
    const { active, stale } = partitionEngineerCommands(['npm', 'rm', 'git'], exposed);
    expect(active).toEqual(['git', 'npm']); // sorted, exposed-only
    expect(stale).toEqual(['rm']); // selected but not globally exposed
  });

  it('treats everything as stale when nothing is exposed', () => {
    const { active, stale } = partitionEngineerCommands(['git', 'npm'], []);
    expect(active).toEqual([]);
    expect(stale).toEqual(['git', 'npm']);
  });

  it('normalizes whitespace and de-duplicates', () => {
    const { active, stale } = partitionEngineerCommands(
      [' git ', 'git', '', '   ', 'npm', 'npm'],
      exposed,
    );
    expect(active).toEqual(['git', 'npm']);
    expect(stale).toEqual([]);
  });

  it('sorts each partition stably', () => {
    const { active } = partitionEngineerCommands(
      ['npm', 'gh', 'cargo', 'git'],
      exposed,
    );
    expect(active).toEqual(['cargo', 'gh', 'git', 'npm']);
  });
});
