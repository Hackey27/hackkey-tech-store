import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { NextFunction, Request, Response } from 'express';

export interface AdminActor {
  uid: string;
  email?: string;
}

export interface AdminRequest extends Request {
  adminActor?: AdminActor;
}

function projectId(): string {
  // Cloud Run does not inject GOOGLE_CLOUD_PROJECT automatically. Keep the
  // deployed Firebase project explicit while still allowing emulator/test
  // overrides.
  return process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'hack-key-tech-store-staging';
}

function adminAuth() {
  const app =
    getApps()[0] ||
    initializeApp({
      credential: applicationDefault(),
      projectId: projectId()
    });
  return getAuth(app);
}

export function bearerToken(header?: string): string | null {
  const match = /^Bearer\s+(.+)$/i.exec(header || '');
  return match?.[1]?.trim() || null;
}

export function validateAdminClaims(
  token: Pick<DecodedIdToken, 'uid' | 'email' | 'aud' | 'iss'> & { admin?: boolean },
  expectedProject = projectId()
): AdminActor {
  const issuer = `https://securetoken.google.com/${expectedProject}`;
  if (token.aud !== expectedProject || token.iss !== issuer) {
    throw new Error('Token belongs to another Firebase project.');
  }
  if (token.admin !== true) {
    const error = new Error('Admin claim required.') as Error & { status?: number };
    error.status = 403;
    throw error;
  }
  return { uid: token.uid, email: token.email };
}

export async function verifyAdminToken(idToken: string): Promise<AdminActor> {
  // checkRevoked=true means a disabled/revoked admin loses access immediately.
  const decoded = await adminAuth().verifyIdToken(idToken, true);
  return validateAdminClaims(decoded);
}

export function requireAdmin(
  verifier: (token: string) => Promise<AdminActor> = verifyAdminToken
) {
  return async (req: AdminRequest, res: Response, next: NextFunction) => {
    const token = bearerToken(req.header('authorization'));
    if (!token) return res.status(401).json({ error: 'Authentication required.' });

    try {
      req.adminActor = await verifier(token);
      next();
    } catch (err) {
      const status = (err as { status?: number }).status === 403 ? 403 : 401;
      return res.status(status).json({
        error: status === 403 ? 'Administrator access required.' : 'Invalid or expired token.'
      });
    }
  };
}
