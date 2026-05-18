/**
 * Minimal dotenv-compatible parser.
 *
 * Supports the common subset that matters for credential extraction:
 *   - KEY=value
 *   - KEY="value with spaces"
 *   - KEY='value with $unexpanded vars'
 *   - export KEY=value
 *   - Comments (# at line start, or after an unquoted value)
 *   - Blank lines, CRLF / LF
 *
 * Does NOT implement variable interpolation (${OTHER}) or multi-line values —
 * neither is useful for API-key import and both invite parser ambiguity.
 */

export interface ParsedEnvEntry {
  key: string;
  value: string;
  /** 1-based line number in the source. */
  line: number;
}

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function parseEnvText(text: string): ParsedEnvEntry[] {
  const entries: ParsedEnvEntry[] = [];
  const lines = text.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Strip optional `export ` prefix
    const withoutExport = trimmed.startsWith('export ')
      ? trimmed.slice('export '.length).trimStart()
      : trimmed;

    const eq = withoutExport.indexOf('=');
    if (eq <= 0) continue;

    const key = withoutExport.slice(0, eq).trim();
    if (!KEY_RE.test(key)) continue;

    let value = withoutExport.slice(eq + 1).trim();

    // Quoted value — preserve interior verbatim; strip the wrapping quotes.
    // Inline comments are ignored inside quotes.
    if ((value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)) {
      value = value.slice(1, -1);
    } else {
      // Unquoted: trailing inline comment is whitespace + # ...
      const hashIdx = value.indexOf(' #');
      if (hashIdx !== -1) value = value.slice(0, hashIdx).trimEnd();
    }

    if (value.length === 0) continue;
    entries.push({ key, value, line: i + 1 });
  }

  return entries;
}
