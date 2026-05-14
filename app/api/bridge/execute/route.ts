import { NextRequest, NextResponse } from 'next/server';
import sampleConfig from '../../../../config/samples/project-manager.sample.json';
import { createRuntimeAdapter } from '../../../../lib/adapters/registry';
import { ProjectManagerConfig } from '../../../../lib/types';

const config = sampleConfig as ProjectManagerConfig;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ success: false, message: '請求格式錯誤' }, { status: 400 });
  }

  const adapterId = typeof body.adapterId === 'string' ? body.adapterId : '';
  const featureId = typeof body.featureId === 'string' ? body.featureId : '';
  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 12000) : '';

  const feature = config.features.find((item) => item.id === featureId);
  if (!feature) {
    return NextResponse.json({ success: false, message: '找不到指定 Feature' }, { status: 404 });
  }

  const adapter = createRuntimeAdapter(config, adapterId);
  if (!adapter) {
    return NextResponse.json({ success: false, message: '找不到指定 Adapter' }, { status: 404 });
  }

  const result = await adapter.execute({
    feature,
    prompt,
    projectRoot: config.project.root,
  });

  return NextResponse.json(result, { status: result.success ? 200 : 400 });
}
