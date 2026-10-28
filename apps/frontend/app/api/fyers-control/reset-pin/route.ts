import { NextRequest, NextResponse } from 'next/server';
import { checkPin, validatePin, updateUserPin, addLog, readJson } from '../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const { userId, currentPin, newPin } = await readJson(req);

  if (typeof userId !== 'string' || !userId || typeof currentPin !== 'string' || !currentPin || typeof newPin !== 'string' || !newPin) {
    return NextResponse.json({ error: 'userId, currentPin and newPin are required' }, { status: 400 });
  }
  if (!/^\d{4}$/.test(newPin)) {
    return NextResponse.json({ error: 'New PIN must be exactly 4 digits' }, { status: 400 });
  }

  // Verify current PIN before allowing change. validatePin shares the unlock
  // flow's 5-attempt lockout, so this endpoint can't be used to brute-force a PIN.
  if (checkPin(userId, currentPin) === null) {
    return NextResponse.json({ error: 'No PIN configured for this user' }, { status: 400 });
  }
  const valid = validatePin(userId, currentPin);
  if (!valid.ok) {
    addLog({ level: 'warning', action: 'RESET_PIN', message: `Wrong current PIN for reset — user: ${userId}` });
    return NextResponse.json(
      { error: valid.locked ? 'Too many failed attempts. Try again in 5 minutes.' : 'Current PIN is incorrect', locked: !!valid.locked },
      { status: 401 },
    );
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
