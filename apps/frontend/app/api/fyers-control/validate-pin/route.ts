import { NextRequest, NextResponse } from 'next/server';
import { validatePin, readJson } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, pin } = await readJson(req);
  if (typeof userId !== 'string' || !userId || (typeof pin !== 'string' && typeof pin !== 'number') || pin === '') {
    return NextResponse.json({ error: 'userId and pin are required' }, { status: 400 });
  }

  const result = validatePin(userId, String(pin));

  if (!result.ok) {
    if (result.locked) {
      return NextResponse.json(
        { error: 'Too many failed attempts. Try again in 5 minutes.', locked: true },
        { status: 401 },
      );
    }
    return NextResponse.json(
      { error: 'Invalid PIN', attemptsLeft: result.attemptsLeft },
      { status: 401 },
    );
  }

  return NextResponse.json({ ok: true });
}
