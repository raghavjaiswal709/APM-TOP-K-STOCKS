import { NextResponse } from 'next/server';
import { getCreds } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function GET() {
  const users = getCreds().map(({ id, displayName }) => ({ id, displayName }));
  return NextResponse.json({ users });
}
