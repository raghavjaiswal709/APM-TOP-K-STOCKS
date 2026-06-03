import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5002';
const DATA_DIR = path.join(process.cwd(), '..', 'backend', 'data');

function writeJsonFile(filename: string, data: unknown): void {
  const filePath = path.join(DATA_DIR, filename);
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

async function clearViaBackend(endpoint: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${BACKEND_URL}${endpoint}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clearAll: true }),
    });
    if (response.ok) {
      const data = await response.json();
      return { success: true, message: data.message || 'Cleared' };
    }
    return { success: false, message: `Backend responded with ${response.status}` };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
}

/**
 * POST /api/admin/reset-tab-data
 * Body: { tab: 'subscribed' | 'available' | 'stopped' | 'blocked' }
 *
 * Resets the JSON file(s) for the given tab to empty.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tab } = body;

    if (!tab || !['subscribed', 'available', 'stopped', 'blocked'].includes(tab)) {
      return NextResponse.json(
        { success: false, message: 'Invalid tab. Must be one of: subscribed, available, stopped, blocked' },
        { status: 400 }
      );
    }

    if (tab === 'subscribed' || tab === 'available') {
      // Clear via backend first (crucial for Docker volumes)
      const result = await clearViaBackend('/api/admin/subscribed-companies');
      if (!result.success) {
        // Fallback for local development
        writeJsonFile('subscribed_companies.json', []);
      }
      return NextResponse.json({ success: true, message: 'Subscribed companies cleared' });
    }

    if (tab === 'stopped') {
      // Clear via backend first
      const [stoppedResult, failedResult] = await Promise.all([
        clearViaBackend('/api/admin/stopped-companies'),
        clearViaBackend('/api/admin/failed-subscriptions'),
      ]);

      if (!stoppedResult.success) {
        // Fallback for local development
        writeJsonFile('stopped_companies.json', []);
      }
      if (!failedResult.success) {
        // Fallback for local development
        writeJsonFile('failed_subscriptions.json', []);
      }

      return NextResponse.json({ success: true, message: 'Stopped companies and failed subscriptions cleared' });
    }

    if (tab === 'blocked') {
      // Clear via backend first
      const result = await clearViaBackend('/api/admin/permanently-stopped');
      if (!result.success) {
        // Fallback for local development
        writeJsonFile('permanently_stopped.json', []);
      }
      return NextResponse.json({ success: true, message: 'Permanently blocked symbols cleared' });
    }

    return NextResponse.json({ success: false, message: 'Unknown error' }, { status: 500 });
  } catch (error: any) {
    console.error('[reset-tab-data] Error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
