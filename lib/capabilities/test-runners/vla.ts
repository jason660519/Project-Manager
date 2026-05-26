/**
 * VLA (vision) test runner — F23 Phase 1 sub-step 4.
 *
 * Generates a test image client-side via Canvas (200×80 white background with
 * "PASS" text rendered in black), sends it to the candidate model via
 * `callAnthropic`, and checks the response contains "PASS" (case-insensitive).
 *
 * Anthropic only in Phase 1. Other providers fall through to a "not yet
 * supported" failure that the runner UI surfaces with a clear message.
 */
import type { CandidateTestResult, CapabilityCandidate } from '../../types';
import { callAnthropic } from '../../bridge';
import { loadProviderKey } from '../../keys/loadProviderKey';
import { CANVAS_WHITE, CANVAS_BLACK } from '../../tokens/editor-colors';

const PROMPT = 'Read the text in this image and reply with only the word that appears. No explanation.';

function makeTestImageBase64(): string {
  if (typeof document === 'undefined') {
    throw new Error('VLA test runner requires a browser DOM (document is undefined).');
  }
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to obtain 2D canvas context.');
  ctx.fillStyle = CANVAS_WHITE;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = CANVAS_BLACK;
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PASS', canvas.width / 2, canvas.height / 2);
  const dataUrl = canvas.toDataURL('image/png');
  const comma = dataUrl.indexOf(',');
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export async function runVlaTest(candidate: CapabilityCandidate): Promise<CandidateTestResult> {
  const start = performance.now();
  try {
    if (candidate.providerId !== 'anthropic') {
      return {
        ok: false,
        durationMs: Math.round(performance.now() - start),
        message: `Provider "${candidate.providerId ?? '(unknown)'}" not yet supported by the VLA test runner. Phase 1 ships Anthropic only.`,
      };
    }
    const apiKey = await loadProviderKey('anthropic');
    if (!apiKey.trim()) {
      return {
        ok: false,
        durationMs: Math.round(performance.now() - start),
        message: 'No Anthropic API key saved. Add one in the Keys page first.',
      };
    }
    const imageBase64 = makeTestImageBase64();
    const response = await callAnthropic({
      apiKey,
      model: candidate.modelId ?? 'claude-sonnet-4-6',
      maxTokens: 64,
      messages: [
        {
          role: 'user',
          // Multimodal content array — Rust call_anthropic passes this through verbatim.
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/png', data: imageBase64 } },
            { type: 'text', text: PROMPT },
          ] as unknown,
        },
      ],
    });
    const text = (response.content ?? '').toUpperCase();
    const passMarker = text.includes('PASS');
    const truncated = response.content.trim().slice(0, 120);
    return {
      ok: passMarker,
      durationMs: Math.round(performance.now() - start),
      message: passMarker
        ? `Model identified the test marker. Response: "${truncated}"`
        : `Response did not contain expected "PASS" marker. Got: "${truncated}"`,
    };
  } catch (error) {
    return {
      ok: false,
      durationMs: Math.round(performance.now() - start),
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
