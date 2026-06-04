import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const rendererHtml = readFileSync('public/vendor/mermaid/index.html', 'utf8');
const fixturesHtml = readFileSync('public/vendor/mermaid/fixtures.html', 'utf8');

describe('Mermaid vendor renderer assets', () => {
  it('uses local vendored Mermaid assets instead of CDN scripts', () => {
    expect(rendererHtml).toContain('<script src="./mermaid.min.js"></script>');
    expect(rendererHtml).not.toMatch(/https?:\/\//);
    expect(fixturesHtml).not.toMatch(/https?:\/\//);
  });

  it('keeps the sandbox renderer on conservative security settings', () => {
    expect(rendererHtml).toContain("securityLevel: 'strict'");
    expect(rendererHtml).toContain('htmlLabels: false');
  });

  it('tracks representative diagram families for browser smoke coverage', () => {
    expect(fixturesHtml).toContain("id: 'flowchart'");
    expect(fixturesHtml).toContain("id: 'sequence'");
    expect(fixturesHtml).toContain("id: 'gantt'");
    expect(fixturesHtml).toContain("id: 'swimlane'");
    expect(fixturesHtml).toContain("id: 'state'");
    expect(fixturesHtml).toContain("id: 'class'");
    expect(fixturesHtml).toContain("id: 'architecture'");
  });
});
