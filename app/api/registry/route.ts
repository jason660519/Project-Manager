/**
 * POST /api/registry  — returns all entries, or appends { configPath }
 * DELETE /api/registry — removes { configPath }
 *
 * Dev-only: this route is not included in the static Tauri export.
 * Its purpose is to let the web dev server reflect projects added via the
 * desktop app (which writes the same registry.json via Rust).
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const REGISTRY_PATH = path.join(os.homedir(), '.project-manager', 'registry.json');

interface RegistryEntry {
  configPath: string;
}

async function readRegistry(): Promise<RegistryEntry[]> {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content) as RegistryEntry[];
  } catch {
    return [];
  }
}

async function writeRegistry(entries: RegistryEntry[]): Promise<void> {
  await fs.mkdir(path.dirname(REGISTRY_PATH), { recursive: true });
  await fs.writeFile(REGISTRY_PATH, JSON.stringify(entries, null, 2));
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || body.action === 'list') {
    const entries = await readRegistry();
    return NextResponse.json(entries);
  }

  if (!body || typeof body.configPath !== 'string') {
    return NextResponse.json({ error: 'Missing configPath' }, { status: 400 });
  }
  const entries = await readRegistry();
  if (!entries.some((e) => e.configPath === body.configPath)) {
    entries.push({ configPath: body.configPath });
    await writeRegistry(entries);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.configPath !== 'string') {
    return NextResponse.json({ error: 'Missing configPath' }, { status: 400 });
  }
  const entries = await readRegistry();
  await writeRegistry(entries.filter((e) => e.configPath !== body.configPath));
  return NextResponse.json({ ok: true });
}
