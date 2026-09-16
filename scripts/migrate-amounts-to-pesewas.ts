/**
 * One-off migration: order amounts from cedis to integer pesewas.
 *
 *   npx tsx scripts/migrate-amounts-to-pesewas.ts --dry-run
 *   npx tsx scripts/migrate-amounts-to-pesewas.ts
 *
 * Phase 1 stored `amountGhs` as a number of cedis. Phase 2 stores
 * `amountPesewas` as an integer, because the payment verification compares the
 * order amount against Paystack's integer for exact equality — a float cedi
 * amount cannot be compared that way.
 *
 * Idempotent: an order that already has `amountPesewas` is left alone, so this
 * is safe to run repeatedly. Like the catalogue migration it validates first
 * and writes nothing if anything looks wrong.
 */

import { Firestore, WriteBatch } from '@google-cloud/firestore';
import { cedisToPesewas } from '../src/utils/money';

const BATCH_LIMIT = 450;

interface Planned {
  orderId: string;
  amountGhs: number;
  amountPesewas: number;
  originalAmountGhs?: number;
  originalAmountPesewas?: number;
  fractional: boolean;
}

function firestoreClient(): Firestore {
  return new Firestore({
    projectId: process.env.GOOGLE_CLOUD_PROJECT || undefined,
    ignoreUndefinedProperties: true,
    ...(process.env.FIRESTORE_DATABASE_ID ? { databaseId: process.env.FIRESTORE_DATABASE_ID } : {})
  });
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const db = firestoreClient();

  const snapshot = await db.collection('orders').get();
  console.log(`Read ${snapshot.size} order(s).\n`);

  const planned: Planned[] = [];
  const blocking: string[] = [];
  let alreadyDone = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() as Record<string, unknown>;

    if (typeof data.amountPesewas === 'number') {
      alreadyDone += 1;
      continue;
    }

    const amountGhs = data.amountGhs;
    if (typeof amountGhs !== 'number' || !Number.isFinite(amountGhs)) {
      blocking.push(`${doc.id}: amountGhs is ${JSON.stringify(amountGhs)}, not a number.`);
      continue;
    }

    const amountPesewas = cedisToPesewas(amountGhs);
    const originalAmountGhs =
      typeof data.originalAmountGhs === 'number' ? data.originalAmountGhs : undefined;

    planned.push({
      orderId: doc.id,
      amountGhs,
      amountPesewas,
      originalAmountGhs,
      originalAmountPesewas:
        originalAmountGhs === undefined ? undefined : cedisToPesewas(originalAmountGhs),
      fractional: !Number.isInteger(amountGhs)
    });
  }

  const fractional = planned.filter((p) => p.fractional);
  console.log(`  already in pesewas   ${alreadyDone}`);
  console.log(`  to convert           ${planned.length}`);
  console.log(`  of which fractional  ${fractional.length}`);
  if (fractional.length) {
    console.log('\nFractional amounts (the ones float cedis would have put at risk):');
    for (const p of fractional) {
      console.log(`  ${p.orderId}  GHS ${p.amountGhs} -> ${p.amountPesewas}p`);
    }
  }
  console.log('');

  if (blocking.length) {
    console.error('BLOCKED — nothing written:');
    blocking.forEach((b) => console.error(`  - ${b}`));
    process.exit(1);
  }

  if (dryRun) {
    console.log('--dry-run: nothing written.');
    return;
  }

  if (!planned.length) {
    console.log('Nothing to do.');
    return;
  }

  let batch: WriteBatch = db.batch();
  let pending = 0;

  for (const p of planned) {
    // The cedi fields are removed in the same write: one field per concept,
    // and leaving both invites the two halves to disagree.
    batch.update(db.collection('orders').doc(p.orderId), {
      amountPesewas: p.amountPesewas,
      ...(p.originalAmountPesewas === undefined
        ? {}
        : { originalAmountPesewas: p.originalAmountPesewas }),
      amountGhs: FieldValueDelete(),
      originalAmountGhs: FieldValueDelete()
    });
    pending += 1;

    if (pending >= BATCH_LIMIT) {
      await batch.commit();
      batch = db.batch();
      pending = 0;
    }
  }

  if (pending > 0) await batch.commit();
  console.log(`Converted ${planned.length} order(s).`);
}

/** Firestore's sentinel for removing a field. */
function FieldValueDelete() {
  // Imported lazily so the module-level import list stays small and the intent
  // is obvious at the call site.
  const { FieldValue } = require('@google-cloud/firestore');
  return FieldValue.delete();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
