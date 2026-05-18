/**
 * POST /api/scan-project
 *
 * Accepts a local project path, scans its structure, calls OpenAI to
 * generate a `.project-manager/config.json` dashboard config (ADR-008),
 * and returns the result.
 *
 * Request body:
 *   { "path": "/absolute/path/to/project" }
 *
 * Response:
 *   { "success": true, "config": {...}, "context": {...} }
 *   or
 *   { "success": false, "error": "..." }
 */

import { NextRequest, NextResponse } from 'next/server';
import { buildScanPrompt, parseScanResponse } from '../../../lib/scanner/shared';
import { buildProjectContext } from '../../../lib/scanner/server';
import type { ScanResult } from '../../../lib/scanner/shared';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    if (!body || typeof body.path !== 'string' || !body.path.trim()) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "path" in request body' },
        { status: 400 },
      );
    }

    const projectPath = body.path.trim();

    // 1) Build project context from filesystem
    const context = await buildProjectContext(projectPath);
    const prompt = buildScanPrompt(context);

    // 2) Call AI — try OpenAI first, fallback to Anthropic
    const openaiKey = process.env.OPENAI_API_KEY;
    const anthropicKey = process.env.ANTHROPIC_API_KEY;

    if (!openaiKey && !anthropicKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'No AI API key configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env',
        },
        { status: 500 },
      );
    }

    let rawResponse: string;

    if (openaiKey) {
      rawResponse = await callOpenAI(openaiKey, prompt);
    } else {
      rawResponse = await callAnthropic(anthropicKey!, prompt);
    }

    // 3) Parse the AI response
    const config = parseScanResponse(rawResponse);

    const result: ScanResult = {
      success: true,
      config,
      context,
      rawResponse,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('[scan-project] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// ── AI API calls ─────────────────────────────────────────────────────────────

async function callOpenAI(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4096,
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content: 'You are a project structure analyst. Return only valid JSON, no markdown fences.',
        },
        { role: 'user', content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}

async function callAnthropic(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Anthropic API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.content?.[0]?.text ?? '';
}
