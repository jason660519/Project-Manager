import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

/** Returns script names declared in `package.json` for the given project root. */
export function listNpmScriptNames(projectRoot: string): Set<string> | null {
  if (!projectRoot?.trim()) return null;
  try {
    const pkgPath = join(projectRoot, 'package.json');
    if (!existsSync(pkgPath)) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as { scripts?: Record<string, string> };
    if (!pkg.scripts || typeof pkg.scripts !== 'object') return new Set();
    return new Set(Object.keys(pkg.scripts));
  } catch {
    return null;
  }
}

/** OD-01: `npm run <script>` must reference a script defined in project `package.json`. */
export function validateNpmRunScript(projectRoot: string, scriptName: string): boolean {
  const scripts = listNpmScriptNames(projectRoot);
  if (!scripts) return false;
  return scripts.has(scriptName);
}
