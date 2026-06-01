import { describe, expect, it } from 'vitest';
import { isUuid, modelRowId, rowIdFromNaturalKey, uuidv5 } from '../lib/aiSdks/uuid';

describe('uuidv5', () => {
  it('matches the canonical RFC test vector (proves SHA-1 correctness)', () => {
    // uuidv5("www.example.com", DNS namespace) is a well-known fixed value.
    const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
    expect(uuidv5('www.example.com', DNS)).toBe('2ed6657d-e927-568b-95e1-2665a8aea6a2');
  });

  it('is deterministic and well-formed', () => {
    const a = modelRowId('anthropic', 'claude-opus-4-7');
    const b = modelRowId('anthropic', 'claude-opus-4-7');
    expect(a).toBe(b);
    expect(isUuid(a)).toBe(true);
    expect(a[14]).toBe('5'); // version nibble
  });

  it('differs per natural key and equals rowIdFromNaturalKey', () => {
    expect(modelRowId('anthropic', 'claude-opus-4-7')).not.toBe(modelRowId('openai', 'gpt-4o'));
    expect(modelRowId('openai', 'gpt-4o')).toBe(rowIdFromNaturalKey('openai:gpt-4o'));
  });

  it('isUuid rejects natural keys', () => {
    expect(isUuid('anthropic:claude-opus-4-7')).toBe(false);
  });
});
