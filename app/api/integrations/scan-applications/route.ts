import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

interface InstalledMacApp {
  id: string;
  name: string;
  path: string;
  description: string | null;
}

interface ScanMacosApplicationsResult {
  apps: InstalledMacApp[];
  scannedPaths: string[];
  warnings: string[];
}

function readPlistString(appPath: string, key: string): string | null {
  try {
    const infoPath = path.join(appPath, 'Contents', 'Info');
    const out = execFileSync('defaults', ['read', infoPath, key], {
      encoding: 'utf8',
      timeout: 2000,
    }).trim();
    return out.length > 0 ? out : null;
  } catch {
    return null;
  }
}

function appFromBundle(appPath: string): InstalledMacApp | null {
  try {
    if (!fs.statSync(appPath).isDirectory()) return null;
  } catch {
    return null;
  }
  const bundleId = readPlistString(appPath, 'CFBundleIdentifier');
  const displayName = readPlistString(appPath, 'CFBundleDisplayName');
  const bundleName = readPlistString(appPath, 'CFBundleName');
  const fileStem = path.basename(appPath, '.app');
  const name = displayName ?? bundleName ?? fileStem ?? 'Unknown App';
  const description =
    readPlistString(appPath, 'CFBundleGetInfoString') ??
    readPlistString(appPath, 'NSHumanReadableCopyright');
  return {
    id: bundleId ?? appPath,
    name,
    path: appPath,
    description,
  };
}

function scanDir(dir: string, apps: Map<string, InstalledMacApp>, warnings: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      warnings.push(
        `Permission denied reading ${dir}. Grant Full Disk Access to Project Manager in System Settings → Privacy & Security.`,
      );
      return;
    }
    if (code === 'ENOENT') {
      warnings.push(`Path not found: ${dir}`);
      return;
    }
    warnings.push(`Cannot read ${dir}: ${err instanceof Error ? err.message : String(err)}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.name.endsWith('.app')) continue;
    const fullPath = path.join(dir, entry.name);
    const app = appFromBundle(fullPath);
    if (app) apps.set(app.path, app);
  }
}

function scanMacosApplications(): ScanMacosApplicationsResult {
  const roots = ['/Applications', '/System/Applications'];
  const home = process.env.HOME;
  if (home) roots.push(path.join(home, 'Applications'));

  const apps = new Map<string, InstalledMacApp>();
  const warnings: string[] = [];
  const scannedPaths: string[] = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) {
      warnings.push(`Path not found: ${root}`);
      continue;
    }
    scannedPaths.push(root);
    scanDir(root, apps, warnings);
  }

  const sorted = [...apps.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  );

  return { apps: sorted, scannedPaths, warnings };
}

export async function GET() {
  if (process.platform !== 'darwin') {
    return NextResponse.json(
      { error: 'Application scan is only supported on macOS.' },
      { status: 501 },
    );
  }

  try {
    return NextResponse.json(scanMacosApplications());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
