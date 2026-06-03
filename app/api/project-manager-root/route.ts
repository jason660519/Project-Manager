import { NextResponse } from 'next/server';

export const dynamic = 'force-static';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 });
  }
  return NextResponse.json({ root: process.cwd() });
}
