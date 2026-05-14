import { MainClient } from '../../ui/MainClient';

interface ProjectDetailPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

export function generateStaticParams() {
  return [{ projectId: 'owner-property' }, { projectId: 'devpilot' }];
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;
  return <MainClient currentView="projects" initialProjectId={decodeURIComponent(projectId)} />;
}
