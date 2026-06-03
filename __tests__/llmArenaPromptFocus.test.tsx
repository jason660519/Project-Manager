import { describe, expect, it, vi } from 'vitest';
import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { LlmArenaMatrixTable } from '../app/ui/views/Keys/LlmArenaMatrixTable';
import { en } from '../lib/i18n/en';
import { isUuid } from '../lib/aiSdks/uuid';
import type { ArenaModelSpec, ArenaResult } from '../app/ui/views/Keys/useArenaChat';

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
  it('renders a UUID col-id identity column before the human sequence column', () => {
    const { container, getByText } = render(<Harness />);

    const headers = Array.from(container.querySelectorAll('thead th')).map((th) => th.textContent ?? '');
    expect(headers[0]).toContain('UUID');
    expect(headers[1]).toContain('No');
    expect(getByText('UUID')).toBeInTheDocument();

    const firstCell = container.querySelector('tbody td');
    expect(firstCell).not.toBeNull();
    expect(isUuid((firstCell?.textContent ?? '').trim())).toBe(true);
  });

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

  it('filters rows by activity state from the second-column dropdown', () => {
    const selectedModels: ArenaModelSpec[] = [
      { provider: 'openai', model: 'gpt-active' },
      { provider: 'openai', model: 'gpt-inactive' },
    ];
    const activeResult: ArenaResult = {
      provider: 'openai',
      model: 'gpt-active',
      content: 'completed output',
      latencyMs: 42,
      timestamp: Date.now(),
    };

    const { container, getByLabelText } = render(
      <LlmArenaMatrixTable
        copy={en.keysArena.llm}
        commonCopy={en.keysArena.common}
        selectedModels={selectedModels}
        providers={[{ id: 'openai', label: 'OpenAI', availableModels: ['gpt-active', 'gpt-inactive'] }]}
        results={{ 'openai-gpt-active': activeResult }}
        isRunning={false}
        runningIndexes={new Set()}
        userPrompt="prompt"
        evaluationByIndex={{}}
        noteByIndex={{}}
        promptOverrideByIndex={{}}
        historyByResultKey={{}}
        onClearAll={() => {}}
        onAddModel={() => {}}
        onImportModels={() => {}}
        onMoveModel={() => {}}
        onRunSelectedRows={() => {}}
        onRunSingleRow={() => {}}
        onRemoveModel={() => {}}
        onUpdateModel={() => {}}
        onEvaluationChange={() => {}}
        onNoteChange={() => {}}
        onRowPromptChange={() => {}}
        onOpenDetail={() => {}}
      />,
    );

    const rows = () => container.querySelectorAll('tbody tr');
    expect(rows()).toHaveLength(2);

    fireEvent.change(getByLabelText('Activity filter'), { target: { value: 'activity' } });
    expect(rows()).toHaveLength(1);

    fireEvent.change(getByLabelText('Activity filter'), { target: { value: 'inactivity' } });
    expect(rows()).toHaveLength(1);

    fireEvent.change(getByLabelText('Activity filter'), { target: { value: 'all' } });
    expect(rows()).toHaveLength(2);
  });
});
