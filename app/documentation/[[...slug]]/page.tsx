import { MainClient } from '../../ui/MainClient';
import { DOCUMENTATION_SITE_PUBLIC_MANIFEST } from '../../../lib/generated/documentation-site-public';

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCUMENTATION_SITE_PUBLIC_MANIFEST.routes.map((slug) => ({
    slug: slug ? slug.split('/') : [],
  }));
}

export default async function DocumentationPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  return <MainClient currentView="documentation" documentationSlug={slug} />;
}
