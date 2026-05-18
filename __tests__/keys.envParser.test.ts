import { describe, it, expect } from 'vitest';
import { parseEnvText } from '../lib/keys/envParser';

describe('parseEnvText', () => {
  it('parses plain KEY=value lines', () => {
    expect(parseEnvText('FOO=bar\nBAZ=qux')).toEqual([
      { key: 'FOO', value: 'bar', line: 1 },
      { key: 'BAZ', value: 'qux', line: 2 },
    ]);
  });

  it('handles double- and single-quoted values verbatim', () => {
    const out = parseEnvText('A="hello world"\nB=\'with $literal\'');
    expect(out).toEqual([
      { key: 'A', value: 'hello world', line: 1 },
      { key: 'B', value: 'with $literal', line: 2 },
    ]);
  });

  it('strips inline comments only when unquoted', () => {
    expect(parseEnvText('FOO=bar # trailing comment')).toEqual([
      { key: 'FOO', value: 'bar', line: 1 },
    ]);
    // The "#" inside quotes must survive.
    expect(parseEnvText('FOO="bar # not a comment"')).toEqual([
      { key: 'FOO', value: 'bar # not a comment', line: 1 },
    ]);
  });

  it('accepts the optional export prefix', () => {
    expect(parseEnvText('export TOKEN=abc')).toEqual([
      { key: 'TOKEN', value: 'abc', line: 1 },
    ]);
  });

  it('skips comments, blanks, and malformed lines', () => {
    const out = parseEnvText('# comment\n\nNO_EQUALS_HERE\n123BAD=x\nGOOD=y');
    expect(out).toEqual([{ key: 'GOOD', value: 'y', line: 5 }]);
  });

  it('treats CRLF the same as LF', () => {
    expect(parseEnvText('A=1\r\nB=2')).toEqual([
      { key: 'A', value: '1', line: 1 },
      { key: 'B', value: '2', line: 2 },
    ]);
  });

  it('drops entries with empty values', () => {
    expect(parseEnvText('EMPTY=')).toEqual([]);
  });
});
