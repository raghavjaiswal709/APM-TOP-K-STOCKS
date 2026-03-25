import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// Direct file path — works regardless of whether NestJS backend is running
const DATA_FILE = path.join(process.cwd(), '..', 'backend', 'data', 'subscribed_companies.json');

function readFile(): string[] {
  try {
    if (!fs.existsSync(DATA_FILE)) return [];
    const content = fs.readFileSync(DATA_FILE, 'utf-8').trim();
    return content ? JSON.parse(content) : [];
  } catch {
    return [];
  }
}

function writeFile(symbols: string[]): void {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(symbols, null, 2), 'utf-8');
}

export async function GET() {
  try {
    const subscribed = readFile();
    return NextResponse.json({ success: true, data: subscribed, count: subscribed.length });
  } catch (error: any) {
    console.error('[subscribed-companies] GET error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const incoming: string[] = body.symbols || body.companyCodes || [];

    if (!Array.isArray(incoming) || incoming.length === 0) {
      return NextResponse.json({ success: false, message: 'No symbols provided' }, { status: 400 });
    }

    const existing = readFile();
    const updated = [...new Set([...existing, ...incoming])];
    writeFile(updated);

    console.log(`[subscribed-companies] Saved ${incoming.length} symbol(s), total: ${updated.length}`);
    return NextResponse.json({ success: true, count: updated.length, symbols: updated });
  } catch (error: any) {
    console.error('[subscribed-companies] POST error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    writeFile([]);
    console.log('[subscribed-companies] Cleared all entries');
    return NextResponse.json({ success: true, message: 'Cleared all subscribed companies' });
  } catch (error: any) {
    console.error('[subscribed-companies] DELETE error:', error.message);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
