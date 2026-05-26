// Editor dark-theme color tokens — single source of truth.
// Consumed by tailwind.config.ts (Tailwind class generation) and
// TerminalRegistry / BrowserRegistry (inline styles & xterm.js theme).
// The standards:check rg scan excludes lib/tokens/** intentionally.

export const EDITOR_BG = '#1e1e1e';
export const EDITOR_PANEL = '#1b1b1b';
export const EDITOR_BAR = '#202020';
export const EDITOR_TAB = '#232323';
export const EDITOR_SIDEBAR = '#1f2326';
export const EDITOR_SIDEBAR_R = '#202326';
export const EDITOR_ADDR = '#151515';

export const XTERM_THEME = {
  background: '#1e1e1e',
  foreground: '#d4d4d4',
  cursor: '#d4d4d4',
  selectionBackground: '#264f78',
} as const;

export const CANVAS_WHITE = '#ffffff';
export const CANVAS_BLACK = '#000000';
