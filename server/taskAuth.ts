import crypto from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

interface GoogleTokenPayload {
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  email?: string;
  email_verified?: boolean;
}

interface GoogleJwk extends JsonWebKey { kid?: string; alg?: string; use?: string }
let keyCache: { keys: GoogleJwk[]; expiresAt: number } | null = null;

function decodePart<T>(value: string): T {
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as T;
}

async function googleKeys(): Promise<GoogleJwk[]> {
  if (keyCache && keyCache.expiresAt > Date.now()) return keyCache.keys;
  const response = await fetch('https://www.googleapis.com/oauth2/v3/certs');
  if (!response.ok) throw new Error(`Google signing keys returned HTTP ${response.status}.`);
  const body = await response.json() as { keys?: GoogleJwk[] };
  const keys = Array.isArray(body.keys) ? body.keys : [];
  if (!keys.length) throw new Error('Google returned no signing keys.');
  const maxAge = /max-age=(\d+)/i.exec(response.headers.get('cache-control') || '');
  keyCache = { keys, expiresAt: Date.now() + Math.max(60_000, Number(maxAge?.[1] || 3600) * 1000) };
  return keys;
}

export async function verifyGoogleTaskToken(token: string, audience: string, expectedEmail: string, now = Date.now()): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const header = decodePart<{ alg?: string; kid?: string }>(parts[0]);
  const payload = decodePart<GoogleTokenPayload>(parts[1]);
  if (header.alg !== 'RS256' || !header.kid) return false;
  const seconds = Math.floor(now / 1000);
  if (payload.aud !== audience || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss || '')) return false;
  if (!payload.exp || payload.exp <= seconds || !payload.iat || payload.iat > seconds + 60) return false;
  if (payload.email !== expectedEmail || payload.email_verified !== true) return false;
  const key = (await googleKeys()).find((candidate) => candidate.kid === header.kid && candidate.kty === 'RSA');
  if (!key) return false;
  return crypto.verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), crypto.createPublicKey({ key: key as crypto.JsonWebKey, format: 'jwk' }), Buffer.from(parts[2], 'base64url'));
}

export async function requireTaskCaller(req: Request, res: Response, next: NextFunction) {
  const expectedEmail = String(process.env.TASK_CALLER_SERVICE_ACCOUNT || '').trim();
  const audience = String(process.env.TASK_AUDIENCE || '').trim();
  if (!expectedEmail || !audience) return res.status(503).json({ error: 'Scheduled task authentication is not configured.' });
  const match = /^Bearer\s+(.+)$/i.exec(String(req.header('authorization') || ''));
  if (!match?.[1]) return res.status(401).json({ error: 'Task authentication required.' });
  try {
    if (!await verifyGoogleTaskToken(match[1], audience, expectedEmail)) return res.status(403).json({ error: 'Task caller is not authorized.' });
    next();
  } catch (error) {
    console.error('[tasks] OIDC verification failed:', error);
    return res.status(401).json({ error: 'Invalid task token.' });
  }
}
