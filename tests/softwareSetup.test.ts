import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Firestore } from '@google-cloud/firestore';
import { Product, Variant } from '../shared/types';
import { newSoftwareProduct, newSoftwareVariant, saveVariantInProduct, suggestSoftwareVariantId } from '../shared/softwareSetup';
import { createSoftwareProduct, saveSoftwareVariant } from '../server/softwareSetupData';
import { saveProductConfiguration } from '../server/adminData';

const base = newSoftwareProduct('analysis');
const version = (id: string, name: string, os = 'Windows', latest = true): Variant => ({
  ...newSoftwareVariant({ ...base, productId: 'AMOS' }, []),
  variantId: id, versionOrPlan: name, os, latest, priceGhs: 100, available: true,
});
const software = (): Product => ({ ...base, productId: 'AMOS', productName: 'AMOS', active: true,
  bannerImagePath: 'catalogue/amos/banner.webp',
  variants: [version('AMOS01', '31'), version('AMOS02', '30', 'Windows', false), version('AMOSMAC', '31', 'macOS')],
});

/** Local transaction fixture; never connects to Firestore or changes live orders. */
function database(seed: Record<string, Record<string, unknown>[]>) {
  const rows = new Map(Object.entries(seed).map(([collection, entries]) => [collection, new Map(entries.map(entry => [String(entry.id), structuredClone(entry)]))]));
  const collection = (name: string) => {
    const query = (field?: string, value?: unknown, limit = Infinity): any => ({
      name, field, value, max: limit,
      doc: (id: string) => ({ name, id }),
      where: (field: string, _operator: string, value: unknown) => query(field, value),
      limit: (count: number) => query(field, value, count),
    });
    return query();
  };
  const db = { collection, runTransaction: async (fn: (tx: any) => unknown) => {
    const writes: (() => void)[] = [];
    const tx = {
      get: async (ref: any) => {
        const records = rows.get(ref.name) || new Map();
        if (ref.id !== undefined) return { exists: records.has(ref.id), data: () => structuredClone(records.get(ref.id)) };
        const selected = [...records.values()].filter(entry => !ref.field || entry[ref.field] === ref.value).slice(0, ref.max);
        return { empty: selected.length === 0, docs: selected.map(entry => ({ data: () => structuredClone(entry) })) };
      },
      create: (ref: any, entry: unknown) => writes.push(() => {
        if (!rows.has(ref.name)) rows.set(ref.name, new Map());
        assert.equal(rows.get(ref.name)!.has(ref.id), false);
        rows.get(ref.name)!.set(ref.id, structuredClone(entry) as any);
      }),
      update: (ref: any, patch: unknown) => writes.push(() => rows.get(ref.name)!.set(ref.id, { ...rows.get(ref.name)!.get(ref.id), ...(patch as object) })),
      set: (ref: any, entry: unknown) => writes.push(() => rows.get(ref.name)!.set(ref.id, structuredClone(entry) as any)),
    };
    const result = await fn(tx);
    writes.forEach(write => write());
    return result;
  } } as unknown as Firestore;
  return { db, read: (collection: string, id: string) => rows.get(collection)?.get(id) };
}

test('suggested IDs describe version and OS, avoid collisions and never renumber old IDs', () => {
  const used = ['AMOS01', 'AMOS02', 'amos-v32-windows', 'AMOS-V32-WINDOWS-2'];
  assert.equal(suggestSoftwareVariantId('AMOS', '32', 'Windows', used), 'AMOS-V32-WINDOWS-3');
  assert.equal(suggestSoftwareVariantId('AMOS', '32.1', 'macOS', used), 'AMOS-V32-1-MACOS');
  assert.deepEqual(used.slice(0, 2), ['AMOS01', 'AMOS02']);
  assert.ok(suggestSoftwareVariantId('X'.repeat(80), '9'.repeat(80), 'Windows', []).length <= 120);
});

test('latest recommendation moves for the same OS while historical identities and other OSs remain', () => {
  const old = software();
  const next = saveVariantInProduct(old, version('AMOS-V32-WINDOWS', '32'), true);
  const newer = saveVariantInProduct(next, version('AMOS-V33-WINDOWS', '33'), true);
  assert.deepEqual(newer.variants.map(v => v.variantId), ['AMOS-V33-WINDOWS', 'AMOS-V32-WINDOWS', 'AMOS01', 'AMOS02', 'AMOSMAC']);
  assert.deepEqual(next.variants.map(entry => entry.variantId), ['AMOS-V32-WINDOWS', 'AMOS01', 'AMOS02', 'AMOSMAC']);
  assert.deepEqual(next.variants.map(entry => entry.latest), [true, false, false, true]);
  assert.equal(next.variants[1].versionOrPlan, '31');
  assert.equal(next.variants[1].priceGhs, 100);
  assert.equal(old.variants[0].latest, true);
  assert.equal(next.bannerImagePath, old.bannerImagePath);
});

test('existing edits keep their position and cannot rename IDs or create duplicates', () => {
  const product = software();
  const edited = saveVariantInProduct(product, { ...product.variants[1], priceGhs: 125, latest: true }, false);
  assert.equal(edited.variants[1].variantId, 'AMOS02');
  assert.equal(edited.variants[1].priceGhs, 125);
  assert.equal(edited.variants[0].latest, false);
  assert.throws(() => saveVariantInProduct(product, version('AMOS01', '32'), true), /already exists/);
  assert.throws(() => saveVariantInProduct(product, version('RENAMED', '31'), false), /cannot be renamed/);
  for (const patch of [{ versionOrPlan: '' }, { os: '' }, { priceGhs: NaN }, { priceGhs: -1 }, { priceGhs: 0 }]) {
    assert.throws(() => saveVariantInProduct(product, { ...version('NEW', '32'), ...patch }, true));
  }
});

test('software creation is hidden by default and refuses existing or historical IDs', async () => {
  const fixture = database({ categories: [{ id: 'analysis' }], products: [{ id: 'AMOS', ...software() }], orders: [{ id: 'order-1', productId: 'RETIRED', variantId: 'OLD01' }] });
  assert.equal(base.active, false);
  const created = await createSoftwareProduct({ ...base, productId: 'NEWAPP', productName: ' New app ' }, fixture.db);
  assert.equal(created.productName, 'New app');
  assert.equal(fixture.read('products', 'NEWAPP')!.active, false);
  await assert.rejects(createSoftwareProduct({ ...base, productId: 'AMOS', productName: 'Overwrite' }, fixture.db), /already in use/);
  await assert.rejects(createSoftwareProduct({ ...base, productId: 'RETIRED', productName: 'Reused' }, fixture.db), /already in use/);
  await assert.rejects(createSoftwareProduct({ ...base, categoryId: 'missing', productId: 'NEW2', productName: 'New' }, fixture.db), /Category not found/);
  await assert.rejects(createSoftwareProduct({ ...software(), productId: 'NEW3' }, fixture.db), /Save the software first/);
  assert.equal(fixture.read('products', 'AMOS')!.productName, 'AMOS');
});

test('version creation refuses IDs already tied to software, historical orders, stock or bundle choices', async () => {
  const fixture = database({ products: [{ id: 'AMOS', ...software() }, { id: 'OTHER', ...base, variants: [version('OTHER01', '1')] }],
    orders: [{ id: 'order-1', variantId: 'RETIRED01' }], licencePool: [{ id: 'stock-1', variantId: 'STOCK01' }],
    bundles: [{ id: 'bundle-1', items: [{ variantId: 'BUNDLED01' }] }],
  });
  for (const id of ['AMOS01', 'other01', 'RETIRED01', 'STOCK01', 'BUNDLED01']) {
    await assert.rejects(saveSoftwareVariant('AMOS', version(id, '32'), true, fixture.db), /already used/);
  }
  assert.deepEqual((fixture.read('products', 'AMOS') as unknown as Product).variants.map(entry => entry.variantId), ['AMOS01', 'AMOS02', 'AMOSMAC']);
});

test('transactional creation prepends the version, reads the current record and preserves existing versions, media, orders and stock', async () => {
  const oldOrder = { id: 'order-1', productId: 'AMOS', variantId: 'AMOS01', versionOrPlan: '31' };
  const oldStock = { id: 'stock-1', variantId: 'AMOS01' };
  const fixture = database({ products: [{ id: 'AMOS', ...software() }], orders: [oldOrder], licencePool: [oldStock] });
  await saveSoftwareVariant('AMOS', version('AMOS-V32-WINDOWS', '32'), true, fixture.db);
  const result = await saveSoftwareVariant('AMOS', version('AMOS-V33-WINDOWS', '33'), true, fixture.db);
  assert.equal(result.variants.length, 5);
  assert.equal(result.variants.find(entry => entry.variantId === 'AMOS-V32-WINDOWS')!.latest, false);
  assert.equal(result.bannerImagePath, software().bannerImagePath);
  assert.deepEqual(fixture.read('orders', 'order-1'), oldOrder);
  assert.deepEqual(fixture.read('licencePool', 'stock-1'), oldStock);
  await assert.rejects(saveSoftwareVariant('AMOS', version('RENAMED', '31'), false, fixture.db), /cannot be renamed/);
});

test('an older software form cannot remove new versions, rename IDs or bypass version creation', async () => {
  const original = software();
  const fixture = database({ products: [{ id: 'AMOS', ...original }] });
  const configured = { ...original, description: 'Updated description' };
  await saveProductConfiguration('AMOS', configured, fixture.db);
  assert.equal(fixture.read('products', 'AMOS')!.description, 'Updated description');
  const renamed = { ...original, variants: original.variants.map((entry, index) => index === 0 ? { ...entry, variantId: 'RENAMED' } : entry) };
  await assert.rejects(saveProductConfiguration('AMOS', renamed, fixture.db), /cannot be renamed/);
  await saveSoftwareVariant('AMOS', version('AMOS-V32-WINDOWS', '32'), true, fixture.db);
  await assert.rejects(saveProductConfiguration('AMOS', original, fixture.db), /Reload before saving/);
  assert.equal((fixture.read('products', 'AMOS') as unknown as Product).variants.length, 4);
});
