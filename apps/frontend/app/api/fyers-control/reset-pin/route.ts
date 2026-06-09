import { NextRequest, NextResponse } from 'next/server';
import { checkPin, updateUserPin, addLog } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, currentPin, newPin } = await req.json() ?? {};

  if (!userId || !currentPin || !newPin) {
    return NextResponse.json({ error: 'userId, currentPin and newPin are required' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'New PIN must be exactly 4 digits' }, { status: 400 });
  }

  // Verify current PIN before allowing change
  const valid = checkPin(userId, currentPin);
  if (valid === null) {
    return NextResponse.json({ error: 'No PIN configured for this user' }, { status: 400 });
  }
  if (!valid) {
    addLog({ level: 'warning', action: 'RESET_PIN', message: `Wrong current PIN for reset — user: ${userId}` });
    return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
  }

  try {
    updateUserPin(userId, newPin);
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = (err as Error).message;
    addLog({ level: 'error', action: 'RESET_PIN', message: `Failed to update PIN: ${msg}` });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
