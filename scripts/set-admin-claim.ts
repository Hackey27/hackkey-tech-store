import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { allowedAdminEmails } from '../server/adminAuth';

/**
 * Grant administrator access to one account.
 *
 * Run by hand from a trusted machine, never from CI. Two things have to be true
 * before an account can administer the store, and this reports on both rather
 * than granting one and leaving the other to be discovered at the sign-in
 * screen:
 *
 *   1. the `admin: true` custom claim, which this sets, and
 *   2. membership of ADMIN_ALLOWED_EMAILS on the deployed service.
 *
 * The email must also be verified. Console-created accounts start unverified,
 * so `--verify-email` marks an address you already control as verified; use it
 * only for an address you know is yours.
 */

const args = process.argv.slice(2);
const verifyEmail = args.includes('--verify-email');
const identifier = args.find((arg) => !arg.startsWith('--'))?.trim();
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!identifier || !projectId) {
  console.error(
    'Usage: GOOGLE_CLOUD_PROJECT=project-id npx tsx scripts/set-admin-claim.ts <email-or-uid> [--verify-email]'
  );
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const user = identifier.includes('@') ? await auth.getUserByEmail(identifier) : await auth.getUser(identifier);

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
console.log(`Administrator claim granted to ${user.email || user.uid}.`);

if (verifyEmail && !user.emailVerified) {
  await auth.updateUser(user.uid, { emailVerified: true });
  console.log('Email address marked verified.');
}

// Everything below is a warning, not a failure: the claim is granted either
// way, and the operator needs to know what is still missing.
const email = user.email?.trim().toLowerCase();
if (!email) {
  console.warn('WARNING: this account has no email address, so it can never match the allowlist.');
} else {
  if (!verifyEmail && !user.emailVerified) {
    console.warn(
      'WARNING: this email address is not verified, so sign-in will be refused. ' +
        'Verify it from the account, or re-run with --verify-email.'
    );
  }
  const allowed = allowedAdminEmails();
  if (!allowed.length) {
    console.warn(
      'WARNING: ADMIN_ALLOWED_EMAILS is not set here, so this shell cannot confirm the ' +
        'deployed service will accept this address. Check it on the Cloud Run service.'
    );
  } else if (!allowed.includes(email)) {
    console.warn(`WARNING: ${email} is NOT in ADMIN_ALLOWED_EMAILS. The claim alone will not grant access.`);
  } else {
    console.log(`${email} is in ADMIN_ALLOWED_EMAILS.`);
  }
}

console.log('Sign out and in again to refresh the token.');
