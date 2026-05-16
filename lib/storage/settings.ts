import { skillDefaultDir } from '../bridge';
import { KEY_SHARED_SKILLS_DIR } from './keys';

/**
 * Resolve the user's chosen skills directory, falling back to `~/.claude/skills`
 * via the Rust bridge when the user hasn't set one yet. Returns an empty string
 * outside Tauri when no localStorage value exists.
 */
export async function getSkillsDir(): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(KEY_SHARED_SKILLS_DIR);
      if (raw) return raw;
    } catch {
      /* localStorage disabled */
    }
  }
  try {
    return await skillDefaultDir();
  } catch {
    return '';
  }
}

export function setSkillsDir(path: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (path) {
      window.localStorage.setItem(KEY_SHARED_SKILLS_DIR, path);
    } else {
      window.localStorage.removeItem(KEY_SHARED_SKILLS_DIR);
    }
  } catch {
    /* ignore */
  }
}
