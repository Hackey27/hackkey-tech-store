import type { CatalogueItem, Laptop, LaptopVariantConfig, LaptopVariantOption, PreorderDelivery, RmbPricingSettings } from './types';
import { calculateRmbPrice, isPreorderLaptop, laptopDeliveries } from './rmbPricing';
import { cedisToPesewas } from './money';

export const emptyLaptopVariants = (): LaptopVariantConfig => ({ cpus: [], ram: [], storage: [], rows: [] });
export const cpuLabel = (cpu: { prefix: string; model: string }) => `${cpu.prefix.trim()} ${cpu.model.trim()}`;
export const laptopListingId = (laptopId: string, rowId: string) => `${laptopId}::${rowId}`;
export function validateLaptopVariants(laptop: Laptop): void {
  if (!laptop.variantsEnabled) return;
  const config = laptop.variantConfig;
  if (!config) throw new Error('Add CPU, RAM and Storage variants and at least one combination.');
  for (const [label, values] of [['CPU', config.cpus], ['RAM', config.ram], ['Storage', config.storage]] as const) {
    if (!Array.isArray(values) || !values.length) throw new Error(`Add at least one ${label} variant.`);
    const ids = new Set<string>(), names = new Set<string>();
    for (const value of values) {
      if (!/^[A-Za-z0-9_-]{1,120}$/.test(value.id) || ids.has(value.id)) throw new Error(`${label} variant IDs must be unique and valid.`);
      const name = 'prefix' in value ? (value.prefix.trim() && value.model.trim() ? cpuLabel(value) : '') : value.value.trim();
      if (!name) throw new Error(`${label} variants cannot be empty${label === 'CPU' ? '; enter both prefix and model' : ''}.`);
      if (names.has(name.toLowerCase().replace(/\s+/g, ' '))) throw new Error(`Duplicate ${label} variant: ${name}.`);
      ids.add(value.id); names.add(name.toLowerCase().replace(/\s+/g, ' '));
    }
  }
  if (!Array.isArray(config.rows) || !config.rows.length) throw new Error('Add at least one complete combination before saving with variants on.');
  const ids = new Set<string>(), selections = new Set<string>();
  config.rows.forEach((row, index) => {
    if (!/^[A-Za-z0-9_-]{1,120}$/.test(row.id) || ids.has(row.id)) throw new Error('Combination IDs must be unique and valid.');
    if (!config.cpus.some(v => v.id === row.cpuId) || !config.ram.some(v => v.id === row.ramId) || !config.storage.some(v => v.id === row.storageId)) throw new Error(`Combination ${index + 1}: choose CPU, RAM and Storage.`);
    const key = JSON.stringify([row.cpuId, row.ramId, row.storageId]);
    if (selections.has(key)) throw new Error(`Combination ${index + 1}: this CPU + RAM + Storage combination already exists.`);
    const field = isPreorderLaptop(laptop) ? 'priceRmb' : 'priceGhs';
    const price = row[field];
    if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0 || cedisToPesewas(price) / 100 !== price) throw new Error(`Combination ${index + 1}: enter a ${field === 'priceRmb' ? 'RMB' : 'GHS'} price greater than zero, with up to two decimals. Availability changed? Fill the new currency prices before saving.`);
    ids.add(row.id); selections.add(key);
  });
}

export function laptopVariantOption(laptop: Laptop, rowId: string, settings: RmbPricingSettings): LaptopVariantOption {
  const config = laptop.variantConfig!;
  const row = config?.rows.find(row => row.id === rowId);
  const cpu = config?.cpus.find(value => value.id === row?.cpuId), ram = config?.ram.find(value => value.id === row?.ramId), storage = config?.storage.find(value => value.id === row?.storageId);
  if (!row || !cpu || !ram || !storage) throw new Error('Laptop combination no longer exists.');
  const option: LaptopVariantOption = { laptopId: laptop.laptopId, rowId, cpu: cpuLabel(cpu), ram: ram.value, storage: storage.value, cpuId: cpu.id, ramId: ram.id, storageId: storage.id, currencyBasis: isPreorderLaptop(laptop) ? 'RMB' : 'GHS' };
  if (!isPreorderLaptop(laptop)) {
    if (typeof row.priceGhs === 'number' && Number.isFinite(row.priceGhs) && row.priceGhs > 0) option.pricePesewas = cedisToPesewas(row.priceGhs);
  } else {
    option.deliveryPrices = {};
    for (const delivery of laptopDeliveries(laptop)) {
      try { option.deliveryPrices[delivery] = calculateRmbPrice({ ...laptop.preorderCost, rawCostRmb: row.priceRmb! }, delivery, settings).pricePesewas; }
      catch { /* An incomplete global configuration withholds this price. */ }
    }
    const prices = Object.values(option.deliveryPrices);
    if (prices.length) option.pricePesewas = Math.min(...prices);
  }
  return option;
}

export function pricedLaptopVariant(laptop: Laptop, rowId: string, delivery: PreorderDelivery | undefined, settings: RmbPricingSettings) {
  if (!laptop.variantsEnabled) throw new Error('Laptop variants are no longer enabled. Review the current listing.');
  const option = laptopVariantOption(laptop, rowId, settings);
  const price = option.currencyBasis === 'RMB' ? (delivery && laptopDeliveries(laptop).includes(delivery) ? option.deliveryPrices?.[delivery] : undefined) : option.pricePesewas;
  if (!price || price <= 0) throw new Error('This laptop combination needs a valid price and delivery option. Review the current listing.');
  return { option, price };
}

export function laptopItemUrl(item: CatalogueItem): string {
  return item.laptopVariant ? `/laptops/${encodeURIComponent(item.laptopVariant.laptopId)}?variant=${encodeURIComponent(item.laptopVariant.rowId)}` : `/laptops/${encodeURIComponent(item.itemId)}`;
}
export function resolveLaptopListing(items: CatalogueItem[], laptopId?: string, rowId?: string | null) {
  if (!laptopId) return undefined;
  return rowId ? items.find(item => item.laptopVariant?.laptopId === laptopId && item.laptopVariant.rowId === rowId) : items.find(item => item.itemId === laptopId) || items.find(item => item.laptopVariant?.laptopId === laptopId);
}

/** CPU → RAM → Storage refinement permits switching even between disjoint rows. */
export function switchLaptopVariant(options: LaptopVariantOption[], current: LaptopVariantOption, field: 'cpuId' | 'ramId' | 'storageId', value: string): LaptopVariantOption | undefined {
  const candidates = options.filter(option => option.pricePesewas && option[field] === value && (field === 'cpuId' || option.cpuId === current.cpuId) && (field !== 'storageId' || option.ramId === current.ramId));
  return candidates.sort((a, b) => Number(b.ramId === current.ramId) + Number(b.storageId === current.storageId) - Number(a.ramId === current.ramId) - Number(a.storageId === current.storageId))[0];
}
