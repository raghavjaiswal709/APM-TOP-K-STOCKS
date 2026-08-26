import { NextResponse } from 'next/server';
import { getCreds } from '../_lib/state';

export const dynamic = 'force-dynamic';

/**
 * The member roster, straight out of config.ini.
 *
 * clientId and redirectUri ride along so the auth UI can show the selected
 * member's own app config without a second round-trip. secretKey is
 * deliberately never in this payload — it is the one field in a config.ini
 * section that must not reach the browser, and the token exchange happens
 * server-side precisely so it doesn't have to.
 */
export async function GET() {
  const users = getCreds().map(({ id, displayName, clientId, redirectUri }) => ({
    id,
    displayName,
    clientId,
    redirectUri,
  }));
  return NextResponse.json({ users });
}
