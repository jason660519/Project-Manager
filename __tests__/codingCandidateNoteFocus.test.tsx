import { describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { CodingAgentCandidateTable } from '../app/ui/views/Keys/CodingAgentCandidateTable';
import { en } from '../lib/i18n/en';
import type { CodingCandidateRow } from '../lib/keys/codingCandidates';

/** Regression: the Coding Agent Candidate note <input> must keep focus across keystrokes. */
const PROVIDERS = [
  { id: 'openai' as const, label: 'OpenAI', availableModels: ['gpt-x'], defaultModel: 'gpt-x' },
];

function Harness() {
  const [rows, setRows] = useState<CodingCandidateRow[]>([
    { provider: 'openai', model: 'gpt-x', note: '', enabled: true },
  ]);
  return (
    <CodingAgentCandidateTable
      copy={en.keysArena.coding}
      rows={rows}
      providers={PROVIDERS}
      canAdd
      maxRows={20}
      onAddRow={() => {}}
      onRemoveRow={() => {}}
      onUpdateModel={() => {}}
      onToggleEnabled={() => {}}
      // Fresh closure each render + parent state update — the focus-loss trigger.
      onNoteChange={(index, note) =>
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, note } : r)))
      }
      onMoveRow={() => {}}
      onImportModels={() => {}}
    />
  );
}

describe('CodingAgentCandidateTable note focus', () => {
  it('keeps the note input mounted and focused across keystrokes', () => {
    const { container } = render(<Harness />);
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input).not.toBeNull();

    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.change(input, { target: { value: 'f' } });
    fireEvent.change(input, { target: { value: 'fa' } });
    fireEvent.change(input, { target: { value: 'fast' } });

    const after = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(after).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(after.value).toBe('fast');
  });
});
