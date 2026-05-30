import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  const root = process.env.NODE_ENV === 'development' ? process.cwd() : '';
  return NextResponse.json({ root });
}
