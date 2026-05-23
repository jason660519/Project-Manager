/**
 * POST /api/registry  — returns all entries, or appends { configPath }
 * DELETE /api/registry — removes { configPath }
 *
 * Dev-only: this route is not included in the static Tauri export.
 * Its purpose is to let the web dev server reflect projects added via the
 * desktop app (which writes the same registry.json via Rust).
 *
 * The `list` action inlines each entry's on-disk config so the web preview
 * can show real features. Without this the web build would only see a
 * scaffold (features: []) for every imported project — checkboxes in the
 * Projects tab would do nothing for the phase tabs.
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const REGISTRY_PATH = path.join(os.homedir(), '.project-manager', 'registry.json');

interface RegistryEntry {
  configPath: string;
}

interface RegistryListEntry extends RegistryEntry {
  config?: unknown;
}

async function readRegistry(): Promise<RegistryEntry[]> {
  try {
    const content = await fs.readFile(REGISTRY_PATH, 'utf-8');
    return JSON.parse(content) as RegistryEntry[];
  } catch {
    return [];
  }
}

async function readDiskConfig(configPath: string): Promise<unknown | null> {
  try {
    const raw = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
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
    const enriched: RegistryListEntry[] = await Promise.all(
      entries.map(async (entry) => {
        const config = await readDiskConfig(entry.configPath);
        return config !== null
          ? { configPath: entry.configPath, config }
          : { configPath: entry.configPath };
      }),
    );
    return NextResponse.json(enriched);
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
