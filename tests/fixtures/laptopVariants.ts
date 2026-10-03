import type { Laptop, RmbPricingSettings } from '../../shared/types';
import { defaultRmbTransactionFee } from '../../shared/rmbPricing';

export const variantSettings = (): RmbPricingSettings => ({ exchangeRate: 1.75, bankChargeMode: 'percentage_min', bankChargeRateBps: 850, bankChargeMinimumGhs: 7.47, bankCharges: [{ minimum: 0, maximum: null, charge: 10 }], transactionFee: defaultRmbTransactionFee(), profitMargins: [{ minimum: 0, maximum: 1900, percent: 20 }, { minimum: 1900.01, maximum: null, percent: 15 }] });
export const variantLaptop = (availability = 'Available'): Laptop => ({ laptopId: 'TEST-VARIANTS', title: 'HP Envy 14', categoryId: 'LAPTOP', brand: 'HP', model: 'Envy 14', processor: 'Original CPU', ram: '4GB', storage: '128GB', screen: '14 inch', colour: 'Silver', graphics: 'Integrated', ports: 'USB-C', operatingSystem: 'Windows', picturesUrl: [], availability, active: true, sortOrder: 1, priceGhs: 777, preorderDeliveryOptions: ['express', 'two-months'], preorderCost: { rawCostRmb: 400, shippingExpressGhs: 80, shippingTwoMonthsGhs: 30 }, variantsEnabled: true, variantConfig: {
  cpus: [{ id: 'intel', prefix: 'Intel', model: 'Core i7-1355U' }, { id: 'amd', prefix: 'AMD', model: 'Ryzen 7 7730U' }],
  ram: [{ id: 'r8', value: '8GB' }, { id: 'r16', value: '16GB' }, { id: 'r32', value: '32GB' }],
  storage: [{ id: 's256', value: '256GB' }, { id: 's512', value: '512GB' }, { id: 's1tb', value: '1TB' }],
  rows: [{ id: 'intel-8', cpuId: 'intel', ramId: 'r8', storageId: 's256', priceGhs: 1200, priceRmb: 1000 }, { id: 'intel-16', cpuId: 'intel', ramId: 'r16', storageId: 's512', priceGhs: 1500, priceRmb: 1100 }, { id: 'amd-16', cpuId: 'amd', ramId: 'r16', storageId: 's512', priceGhs: 1450, priceRmb: 950 }]
} });
