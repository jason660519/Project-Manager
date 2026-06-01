import { describe, expect, it } from 'vitest';
import React, { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { VlmArenaMatrixTable } from '../app/ui/views/Keys/VlmArenaMatrixTable';
import { en } from '../lib/i18n/en';
import type { VlmImageToImageRow } from '../app/ui/views/Keys/VlmImageToImageEvaluation';

/** Regression: the VLM Arena prompt <textarea> must keep focus across keystrokes. */
const PROVIDERS = [
  { id: 'openai' as const, label: 'OpenAI', availableModels: ['gpt-x'] },
];

function makeRow(prompt: string): VlmImageToImageRow {
  return {
    id: 'row-1',
    no: 1,
    shouldTest: true,
    provider: 'openai',
    model: 'gpt-x',
    style: 'modern',
    outputMode: '2d',
    prompt,
    runStatus: 'idle',
    resultText: '',
    resultImageUrl: '',
    resultImage2dUrl: '',
    resultImage3dUrl: '',
    message: '',
    runStartedAtMs: null,
    e2eMs: null,
    httpStatus: null,
    lastRunAt: null,
  };
}

function Harness() {
  const [rows, setRows] = useState<VlmImageToImageRow[]>([makeRow('')]);
  return (
    <VlmArenaMatrixTable
      copy={en.keysArena.vlm}
      providers={PROVIDERS}
      rows={rows}
      isRunning={false}
      imageDataUrl={null}
      canRunAll={false}
      historyByResultKey={{}}
      onClearAll={() => {}}
      onAddModel={() => {}}
      onAddTopModels={() => {}}
      onImportModels={() => {}}
      onMoveModel={() => {}}
      onRunSelectedRows={() => {}}
      onRunSingleRow={() => {}}
      onRemoveModel={() => {}}
      onUpdateModel={() => {}}
      onToggleEnabled={() => {}}
      onStyleChange={() => {}}
      onOutputModeChange={() => {}}
      // Fresh closure each render + parent state update — the focus-loss trigger.
      onPromptChange={(index, prompt) =>
        setRows((prev) => prev.map((r, i) => (i === index ? { ...r, prompt } : r)))
      }
      onOpenDetail={() => {}}
    />
  );
}

describe('VlmArenaMatrixTable prompt focus', () => {
  it('keeps the prompt textarea mounted and focused across keystrokes', () => {
    const { container } = render(<Harness />);
    const ta = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(ta).not.toBeNull();

    ta.focus();
    expect(document.activeElement).toBe(ta);

    fireEvent.change(ta, { target: { value: 'm' } });
    fireEvent.change(ta, { target: { value: 'mod' } });
    fireEvent.change(ta, { target: { value: 'modern room' } });

    const after = container.querySelector('textarea') as HTMLTextAreaElement;
    expect(after).toBe(ta);
    expect(document.activeElement).toBe(ta);
    expect(after.value).toBe('modern room');
  });
});
