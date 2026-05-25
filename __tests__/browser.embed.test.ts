import { describe, expect, it } from 'vitest';

// Mirror BrowserContent embed heuristics (iframe-only sites).
function isLikelyEmbeddable(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname;
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.endsWith('.local')
    ) {
      return true;
    }
    if (u.port === '43187') return true;
    return false;
  } catch {
    return true;
  }
}

describe('browser embed policy', () => {
  it('allows localhost dev dashboard', () => {
    expect(isLikelyEmbeddable('http://localhost:43187/project-progress-dashboard')).toBe(
      true,
    );
  });

  it('blocks google, youtube, and github in iframe preview', () => {
    expect(isLikelyEmbeddable('https://google.com')).toBe(false);
    expect(isLikelyEmbeddable('https://www.youtube.com')).toBe(false);
    expect(isLikelyEmbeddable('https://github.com/jason660519/Project-Manager')).toBe(
      false,
    );
  });
});
