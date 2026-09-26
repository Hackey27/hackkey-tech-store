import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { NextFunction, Request, Response } from 'express';

export interface AdminActor {
  uid: string;
  email?: string;
  authTime?: number;
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

/**
 * The exact email addresses allowed to administer this store.
 *
 * The `admin: true` custom claim alone is not enough. A claim can be granted
 * from the Firebase console by anyone with project access, so on its own it
 * makes "who may administer the shop" a property of IAM rather than something
 * stated in one place and reviewable. This list is that one place, and an
 * address that is not on it is refused however its token was minted.
 *
 * It is not a defence against whoever owns the Google Cloud project — they can
 * change the list. It stops an accidental or unnoticed grant becoming access.
 */
export function allowedAdminEmails(value = process.env.ADMIN_ALLOWED_EMAILS): string[] {
  return String(value || '')
    .split(/[,\s]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Production refuses to serve the admin API until the list is set, rather than
 * falling back to claim-only access. An unset variable that silently widens
 * access is the failure nobody notices: it looks exactly like a working portal.
 * The storefront itself is unaffected — a missing admin setting must not stop
 * customers buying.
 */
export function adminAccessConfigured(): boolean {
  return process.env.NODE_ENV !== 'production' || allowedAdminEmails().length > 0;
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
  token: Pick<DecodedIdToken, 'uid' | 'email' | 'aud' | 'iss'> & {
    admin?: boolean;
    auth_time?: number;
    email_verified?: boolean;
  },
  expectedProject = projectId(),
  allowed = allowedAdminEmails()
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

  // An empty list means unconfigured, which only development permits: the
  // production admin subtree is refused outright by adminAccessConfigured()
  // rather than quietly accepting any claim-bearing account here.
  if (allowed.length) {
    const email = token.email?.trim().toLowerCase();
    const forbidden = (reason: string) => {
      const error = new Error(reason) as Error & { status?: number };
      error.status = 403;
      return error;
    };
    // A token with no email cannot be matched against the list, so it cannot
    // be allowed by it.
    if (!email) throw forbidden('The account has no email address.');
    // Without this an address could be claimed by an account that never proved
    // it owns the mailbox, which matters the moment any self-service sign-in
    // provider is enabled.
    if (token.email_verified !== true) throw forbidden('The administrator email address is not verified.');
    if (!allowed.includes(email)) throw forbidden('This account is not an allowed administrator.');
  }

  return { uid: token.uid, email: token.email, ...(typeof token.auth_time === 'number' ? { authTime: token.auth_time } : {}) };
}

export function hasRecentAdminAuth(actor: AdminActor, nowSeconds = Date.now() / 1000): boolean {
  return Boolean(actor.authTime && actor.authTime <= nowSeconds + 30 && nowSeconds - actor.authTime <= 300);
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
      // The reason is logged but never returned. The client is told only that
      // access was refused, because "that address is not on the list" tells an
      // attacker which addresses are; the operator, meanwhile, needs to know
      // exactly which rule refused them or a lockout is unexplainable. Before
      // this, an unverified-email refusal looked identical to a wrong password.
      console.warn(`[admin] Access refused (${status}): ${(err as Error).message}`);
      return res.status(status).json({
        error: status === 403 ? 'Administrator access required.' : 'Invalid or expired token.'
      });
    }
  };
}
