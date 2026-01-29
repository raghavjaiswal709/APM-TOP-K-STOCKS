import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const backendUrl = process.env.BACKEND_URL || 'http://localhost:5002';

type AuthData = {
  authenticated: boolean;
  token_valid: boolean;
  expires_at: string | null;
  services_notified: string[];
  client_id: string;
  redirect_uri: string;
  access_token: string;
  auth_code?: string;
  timestamp?: string;
  service?: string;
  // New fields for better expiry tracking
  jwt_expires_at?: string;
  is_expired?: boolean;
  hours_until_expiry?: number;
};

const defaultData: AuthData = {
  authenticated: false,
  token_valid: false,
  expires_at: null,
  services_notified: [],
  client_id: '',
  redirect_uri: '',
  access_token: '',
  auth_code: '',
  timestamp: '',
  service: '',
  is_expired: true,
};

const normalize = (data: any): Partial<AuthData> => {
  if (!data || typeof data !== 'object') return {};
  return {
    authenticated: data.authenticated ?? data.is_authenticated ?? data.auth ?? false,
    token_valid: data.token_valid ?? data.is_token_valid ?? data.valid ?? false,
    expires_at: data.expires_at ?? data.expiry ?? null,
    services_notified: data.services_notified ?? data.notified_services ?? [],
    client_id: data.client_id ?? data.clientId ?? data.app_id ?? data.appId ?? '',
    redirect_uri: data.redirect_uri ?? data.redirectUri ?? '',
    access_token: data.access_token ?? data.accessToken ?? '',
    auth_code: data.auth_code ?? data.authCode ?? '',
    timestamp: data.timestamp ?? data.updated_at ?? data.updatedAt ?? '',
    service: data.service ?? '',
  };
};

/**
 * Decode JWT token and extract expiry information
 * Returns null if token is invalid or doesn't have expiry
 */
function decodeJwtExpiry(accessToken: string): { exp: number; iat: number; isExpired: boolean; expiresAt: Date; hoursRemaining: number } | null {
  if (!accessToken) return null;
  
  try {
    // Extract JWT part (after client_id:)
    const jwt = accessToken.includes(':') ? accessToken.split(':')[1] : accessToken;
    
    // Get payload (second part of JWT)
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    
    // Decode base64 payload
    let payload = parts[1];
    // Add padding if needed
    const padding = 4 - (payload.length % 4);
    if (padding !== 4) {
      payload += '='.repeat(padding);
    }
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    
    if (!decoded.exp) return null;
    
    const now = new Date();
    const expiresAt = new Date(decoded.exp * 1000);
    const isExpired = now > expiresAt;
    const hoursRemaining = Math.round((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60) * 10) / 10;
    
    return {
      exp: decoded.exp,
      iat: decoded.iat || 0,
      isExpired,
      expiresAt,
      hoursRemaining
    };
  } catch (error) {
    console.error('Error decoding JWT:', error);
    return null;
  }
}

function readAuthFile(): { data: Partial<AuthData> | null; path: string | null } {
  const possiblePaths = [
    '/Users/raghav/Documents/GitHub/APM-TOP-K-STOCKS/apps/backend/data/fyers_data_auth.json', // Known absolute path
    '/app/apps/backend/data/fyers_data_auth.json', // Common path inside Docker container
    '/workspace/apps/backend/data/fyers_data_auth.json', // Alternative container workspace path
    '/usr/src/app/apps/backend/data/fyers_data_auth.json', // Another common Docker workdir
    path.join(process.cwd(), 'apps', 'backend', 'data', 'fyers_data_auth.json'),
    path.join(process.cwd(), '..', 'backend', 'data', 'fyers_data_auth.json'),
    path.join(process.cwd(), '..', 'apps', 'backend', 'data', 'fyers_data_auth.json'),
    path.join(process.cwd(), '..', '..', 'apps', 'backend', 'data', 'fyers_data_auth.json'),
    path.join(process.cwd(), 'backend', 'data', 'fyers_data_auth.json'),
    path.resolve(__dirname, '../../../../../../backend/data/fyers_data_auth.json'),
  ];

  for (const p of possiblePaths) {
    if (!fs.existsSync(p)) continue;

    try {
      const parsed = JSON.parse(fs.readFileSync(p, 'utf8')) as Partial<AuthData>;
      return { data: parsed, path: p };
    } catch (error) {
      console.error(`Error parsing auth file at ${p}:`, error);
    }
  }

  return { data: null, path: null };
}

export async function GET(request: NextRequest) {
  let backendData: AuthData = { ...defaultData };

  // 1) Fetch from backend if available
  try {
    const response = await fetch(`${backendUrl}/auth/fyers/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });

    if (response.ok) {
      const data = await response.json();
      backendData = { ...defaultData, ...normalize(data) };
    } else {
      console.warn('Backend auth status check failed');
    }
  } catch (error: any) {
    console.error(`Auth status error for ${backendUrl}:`, error?.message || error);
  }

  // 2) Always attempt to read the local auth file so credentials appear even if backend is stale
  const { data: fileData, path: filePath } = readAuthFile();
  if (filePath) {
    console.log(`Auth status using file: ${filePath}`);
  }

  // Prefer backend for operational flags, prefer file for credentials
  let mergedData: AuthData = { ...defaultData, ...backendData };

  if (fileData) {
    mergedData = {
      ...mergedData,
      ...normalize(fileData),
    } as AuthData;
  }

  const tokenFromSources = mergedData.access_token || '';

  mergedData.redirect_uri =
    mergedData.redirect_uri ||
    process.env.FYERS_REDIRECT_URI ||
    'https://raghavjaiswal709.github.io/DAKSphere_redirect/';

  // ✅ CRITICAL: Check actual JWT expiry from token payload
  const jwtInfo = decodeJwtExpiry(tokenFromSources);
  
  if (jwtInfo) {
    // Use JWT expiry as source of truth
    mergedData.jwt_expires_at = jwtInfo.expiresAt.toISOString();
    mergedData.is_expired = jwtInfo.isExpired;
    mergedData.hours_until_expiry = jwtInfo.hoursRemaining;
    
    // Override token_valid and authenticated based on actual JWT expiry
    mergedData.token_valid = !jwtInfo.isExpired;
    mergedData.authenticated = !jwtInfo.isExpired;
    
    console.log(`[Auth Status] JWT expires: ${jwtInfo.expiresAt.toISOString()}, isExpired: ${jwtInfo.isExpired}, hoursRemaining: ${jwtInfo.hoursRemaining}`);
  } else {
    // No valid JWT found - mark as expired/unauthenticated
    mergedData.token_valid = false;
    mergedData.authenticated = false;
    mergedData.is_expired = true;
    console.log('[Auth Status] No valid JWT token found');
  }

  // Derive client_id from token prefix if still missing
  if (!mergedData.client_id && mergedData.access_token?.includes(':')) {
    mergedData.client_id = mergedData.access_token.split(':')[0];
  }

  return NextResponse.json(mergedData);
}

