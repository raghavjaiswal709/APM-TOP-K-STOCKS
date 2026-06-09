import { NextRequest, NextResponse } from 'next/server';
import { getAuthState, resetAuth } from '../../_lib/state';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return NextResponse.json(getAuthState(userId));
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  resetAuth(userId);
  return NextResponse.json({ ok: true });
}
