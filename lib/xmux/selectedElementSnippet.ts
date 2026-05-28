export interface XmuxSelectedElementSnippetPayload {
  positionTag?: string;
  elementTag?: string;
  selector?: string;
  cssPath?: string;
  url?: string;
  domTree?: unknown;
  element?: unknown;
  ancestry?: unknown;
  outerHTML?: string;
  [key: string]: unknown;
}

export const XMUX_SELECTED_ELEMENT_MIME = 'application/x-project-manager-xmux-selected-element';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isXmuxSelectedElementPayload(
  payload: unknown,
): payload is XmuxSelectedElementSnippetPayload {
  if (!isRecord(payload)) return false;
  if (payload.cancelled === true) return false;
  return (
    nonEmptyString(payload.selector) ||
    nonEmptyString(payload.cssPath) ||
    nonEmptyString(payload.outerHTML) ||
    nonEmptyString(payload.elementTag) ||
    isRecord(payload.domTree) ||
    isRecord(payload.element)
  );
}

function deriveElementTag(payload: XmuxSelectedElementSnippetPayload): string {
  if (nonEmptyString(payload.elementTag)) return payload.elementTag;
  if (isRecord(payload.domTree) && nonEmptyString(payload.domTree.tag)) return payload.domTree.tag;
  if (isRecord(payload.element) && nonEmptyString(payload.element.tag)) return payload.element.tag;
  return 'element';
}

export function formatXmuxSelectedElementSnippet(payload: XmuxSelectedElementSnippetPayload): string {
  const positionTag = payload.positionTag ?? 'selected';
  const elementTag = deriveElementTag(payload);
  const selector =
    typeof payload.selector === 'string'
      ? payload.selector
      : typeof payload.cssPath === 'string'
        ? payload.cssPath
        : '';
  const summary = {
    positionTag: payload.positionTag,
    elementTag: payload.elementTag,
    selector: selector || undefined,
    url: payload.url,
    element: payload.element,
    domTree: payload.domTree,
    ancestry: payload.ancestry,
    outerHTML: payload.outerHTML,
  };
  const header = `[xmux element: ${positionTag} · ${elementTag}]`;
  const lines = selector ? [header, `selector: ${selector}`] : [header];
  lines.push(JSON.stringify(summary, null, 2));
  return lines.join('\n');
}

/** Append selected-element context after the current input text (never before or in the middle). */
export function appendXmuxSnippetToInput(current: string, snippet: string): string {
  if (current.trim().length === 0) return snippet;
  const separator = current.endsWith('\n') ? '' : '\n\n';
  return `${current}${separator}${snippet}`;
}

export function getXmuxDraggedSnippet(dataTransfer: DataTransfer): string {
  const custom = dataTransfer.getData(XMUX_SELECTED_ELEMENT_MIME);
  if (custom.trim()) return custom;
  const plain = dataTransfer.getData('text/plain');
  if (plain.includes('[xmux element:')) return plain;
  return '';
}

export function setXmuxSnippetDragData(
  dataTransfer: DataTransfer,
  snippet: string,
  payload?: XmuxSelectedElementSnippetPayload,
): void {
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(XMUX_SELECTED_ELEMENT_MIME, snippet);
  dataTransfer.setData('text/plain', snippet);
  dataTransfer.setData(
    'text/html',
    `<pre>${snippet
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')}</pre>`,
  );
  if (payload) {
    dataTransfer.setData('application/json', JSON.stringify(payload, null, 2));
  }
}
