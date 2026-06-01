import { describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { LlmArenaMatrixTable } from '../app/ui/views/Keys/LlmArenaMatrixTable';
import { en } from '../lib/i18n/en';
import type { ArenaModelSpec } from '../app/ui/views/Keys/useArenaChat';

/**
 * Regression: the LLM Arena test-prompt <textarea> must keep focus across
 * keystrokes. Root cause was the `columns` memo depending on per-row state +
 * handlers, so each keystroke rebuilt the column defs; TanStack's flexRender
 * renders cells via React.createElement, so a new cell-fn identity remounted
 * the textarea and dropped focus after a single character.
 *
 * This test reproduces the trigger (parent re-renders with a fresh
 * onRowPromptChange identity each render) and asserts the textarea DOM node is
 * preserved (not remounted) and retains focus.
 */

const PROVIDERS = [
  { id: 'openai' as const, label: 'OpenAI', availableModels: ['gpt-x'], defaultModel: 'gpt-x' },
];
const SELECTED: ArenaModelSpec[] = [{ provider: 'openai', model: 'gpt-x' }];

function Harness() {
  // Parent-owned prompt state — typing updates it, re-rendering the table with a
  // brand-new onRowPromptChange identity each render (the real-world condition).
  const [promptOverrideByIndex, setPromptOverrideByIndex] = useState<Record<number, string>>({});

  return (
    <LlmArenaMatrixTable
      copy={en.keysArena.llm}
      commonCopy={en.keysArena.common}
      selectedModels={SELECTED}
      providers={PROVIDERS}
      results={{}}
      isRunning={false}
      runningIndexes={new Set()}
      userPrompt=""
      enabledByIndex={{}}
      evaluationByIndex={{}}
      noteByIndex={{}}
      promptOverrideByIndex={promptOverrideByIndex}
      historyByResultKey={{}}
      onClearAll={() => {}}
      onAddModel={() => {}}
      onImportModels={() => {}}
      onMoveModel={() => {}}
      onRunSelectedRows={() => {}}
      onRunSingleRow={() => {}}
      onRemoveModel={() => {}}
      onUpdateModel={() => {}}
      onToggleEnabled={() => {}}
      onEvaluationChange={() => {}}
      onNoteChange={() => {}}
      // Fresh closure each render — this identity change is what used to rebuild columns.
      onRowPromptChange={(index, value) =>
        setPromptOverrideByIndex((prev) => ({ ...prev, [index]: value }))
      }
      onOpenDetail={() => {}}
    />
  );
}

describe('LlmArenaMatrixTable prompt focus', () => {
  it('keeps the test-prompt textarea mounted and focused across keystrokes', () => {
    const { container } = render(<Harness />);

    const first = container.querySelector('textarea');
    expect(first).not.toBeNull();
    const textarea = first as HTMLTextAreaElement;

    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    // Simulate three sequential keystrokes, each triggering a parent re-render.
    fireEvent.change(textarea, { target: { value: 'a' } });
    fireEvent.change(textarea, { target: { value: 'ab' } });
    fireEvent.change(textarea, { target: { value: 'abc' } });

    const after = container.querySelector('textarea') as HTMLTextAreaElement;
    // Same DOM node ⇒ not remounted; focus preserved ⇒ user can keep typing.
    expect(after).toBe(textarea);
    expect(document.activeElement).toBe(textarea);
    expect(after.value).toBe('abc');
  });
});
