import { NextRequest, NextResponse } from 'next/server';
import { getAuthState, resetAuth, resetToken } from '../../_lib/state';

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

/** Reset token: release the lock and delete token files so the next login starts fresh */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  try {
    return NextResponse.json({ ok: true, ...resetToken(userId) });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
