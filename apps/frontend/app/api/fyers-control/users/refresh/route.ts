import { NextResponse } from 'next/server';
import { refreshCreds } from '../../_lib/state';

export const dynamic = 'force-dynamic';

export async function POST() {
  const result = refreshCreds();
  return NextResponse.json(result);
}
