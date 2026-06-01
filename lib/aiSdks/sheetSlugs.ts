/**
 * URL slugs for the /ai-sdks provider sheets. One sheet per LLM provider,
 * sourced from the canonical provider registry so the list stays in sync with
 * the Keys view. Kept in a server-safe module (no `'use client'`) so that the
 * server component `app/ai-sdks/[sheet]/page.tsx` can spread the list inside
 * `generateStaticParams`. Mirrors `lib/keys/sheetSlugs.ts`.
 *
 * Provider ids are already slug-safe (`anthropic`, `ollama-local`, …) so the
 * slug *is* the provider id — no slug↔id mapping table needed.
 */

import { getLlmProviderIds, type LlmProviderId } from '../keys/llmProviders';

export type AiSdksSheetSlug = LlmProviderId;

export const AI_SDKS_SHEET_SLUGS: readonly AiSdksSheetSlug[] = getLlmProviderIds();

export const DEFAULT_AI_SDKS_SHEET_SLUG: AiSdksSheetSlug = 'anthropic';

/** localStorage key for the per-user sheet display order (canonical ids only). */
export const AI_SDKS_SHEET_ORDER_STORAGE_KEY = 'projectManager.aiSdks.sheetOrder';

export function isAiSdksSheetSlug(value: string | undefined | null): value is AiSdksSheetSlug {
  return typeof value === 'string' && (AI_SDKS_SHEET_SLUGS as readonly string[]).includes(value);
}
