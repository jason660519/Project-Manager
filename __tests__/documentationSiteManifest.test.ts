import { describe, expect, it } from 'vitest';
import { DOCUMENTATION_SITE_INTERNAL_MANIFEST } from '../lib/generated/documentation-site-internal';
import { DOCUMENTATION_SITE_PUBLIC_MANIFEST } from '../lib/generated/documentation-site-public';

describe('documentation site manifest', () => {
  it('generates independent folder routes from docs folders', () => {
    const routes = new Set(DOCUMENTATION_SITE_INTERNAL_MANIFEST.routes);

    expect(routes.has('')).toBe(true);
    expect(routes.has('product')).toBe(true);
    expect(routes.has('engineering')).toBe(true);
    expect(routes.has('architecture')).toBe(true);
  });

  it('indexes markdown documents with public routes and repo-relative source paths', () => {
    const productPrd = DOCUMENTATION_SITE_INTERNAL_MANIFEST.docs.find(
      (doc) => doc.sourcePath === 'docs/product/project-manager-prd.md',
    );

    expect(productPrd).toBeDefined();
    expect(productPrd?.route).toBe('/documentation/product/project-manager-prd');
    expect(productPrd?.sourcePath.startsWith('/')).toBe(false);
    expect(productPrd?.content.length).toBeGreaterThan(500);
  });

  it('classifies product strategy as internal and engineering docs as internal', () => {
    const productDocs = DOCUMENTATION_SITE_INTERNAL_MANIFEST.docs.filter((doc) => doc.folderSlug === 'product');
    const engineeringDocs = DOCUMENTATION_SITE_INTERNAL_MANIFEST.docs.filter((doc) => doc.folderSlug === 'engineering');

    expect(productDocs.length).toBeGreaterThan(0);
    expect(engineeringDocs.length).toBeGreaterThan(0);
    expect(productDocs.every((doc) => doc.classification === 'internal')).toBe(true);
    expect(engineeringDocs.every((doc) => doc.classification === 'internal')).toBe(true);
  });

  it('classifies guides folder as public', () => {
    const guidesDocs = DOCUMENTATION_SITE_INTERNAL_MANIFEST.docs.filter((doc) => doc.folderSlug.startsWith('guides'));
    expect(guidesDocs.length).toBeGreaterThan(0);
    expect(guidesDocs.every((doc) => doc.classification === 'public')).toBe(true);
  });

  it('includes sync preview counts that match the generated payload', () => {
    expect(DOCUMENTATION_SITE_INTERNAL_MANIFEST.sync.totalDocuments).toBe(DOCUMENTATION_SITE_INTERNAL_MANIFEST.docs.length);
    expect(DOCUMENTATION_SITE_INTERNAL_MANIFEST.sync.totalFolders).toBe(DOCUMENTATION_SITE_INTERNAL_MANIFEST.folders.length);
    expect(DOCUMENTATION_SITE_INTERNAL_MANIFEST.sync.publicDocuments).toBe(
      DOCUMENTATION_SITE_INTERNAL_MANIFEST.docs.filter((doc) => doc.classification === 'public').length,
    );
  });

  it('keeps internal operating documents out of the public manifest', () => {
    expect(DOCUMENTATION_SITE_PUBLIC_MANIFEST.docs.every((doc) => doc.publish)).toBe(true);
    expect(DOCUMENTATION_SITE_PUBLIC_MANIFEST.docs.every((doc) => doc.classification === 'public')).toBe(true);
    expect(
      DOCUMENTATION_SITE_PUBLIC_MANIFEST.docs.some((doc) => doc.sourcePath.startsWith('docs/engineering/')),
    ).toBe(false);
  });
});
