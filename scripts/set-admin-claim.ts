import { applicationDefault, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

const identifier = process.argv[2]?.trim();
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;

if (!identifier || !projectId) {
  console.error('Usage: GOOGLE_CLOUD_PROJECT=project-id npx tsx scripts/set-admin-claim.ts <email-or-uid>');
  process.exit(1);
}

const app = initializeApp({ credential: applicationDefault(), projectId });
const auth = getAuth(app);
const user = identifier.includes('@') ? await auth.getUserByEmail(identifier) : await auth.getUser(identifier);

await auth.setCustomUserClaims(user.uid, { ...(user.customClaims || {}), admin: true });
console.log(`Administrator access granted to ${user.email || user.uid}. Sign out and in again to refresh the token.`);
