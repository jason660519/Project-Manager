import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DocumentationView } from '../app/ui/views/DocumentationView';
import { DOCUMENTATION_SITE_INTERNAL_MANIFEST } from '../lib/generated/documentation-site-internal';

describe('DocumentationView', () => {
  it('renders the generated docs site and sync preview', () => {
    render(
      <DocumentationView
        manifest={DOCUMENTATION_SITE_INTERNAL_MANIFEST}
        initialSlug={['product']}
      />,
    );

    expect(screen.getByText('Project Manager Documentation')).toBeInTheDocument();
    expect(screen.getByText('Sync Preview')).toBeInTheDocument();
    expect(screen.getAllByText(/Public/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/npm run docs:site:sync/i)).toBeInTheDocument();
  });
});
