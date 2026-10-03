import type { Laptop, PreorderDelivery, PricingConfig, RmbPricingSettings } from '../shared/types';
import { pricedLaptopVariant } from '../shared/laptopVariants';
import { calculateRmbPrice, isPreorderLaptop, laptopDeliveries } from '../shared/rmbPricing';
import { laptopToCatalogueItem } from './catalogue';

/** The enquiry retains the current server price; the browser cannot supply it. */
export function laptopEnquiryDetails(laptop: Laptop, rowId: string, delivery: PreorderDelivery, settings: RmbPricingSettings, config: PricingConfig): Record<string, unknown> {
  if (laptop.variantsEnabled) {
    const { option, price } = pricedLaptopVariant(laptop, rowId, delivery, settings);
    return { variantRowId: option.rowId, cpu: option.cpu, ram: option.ram, storage: option.storage, currencyBasis: option.currencyBasis, pricePesewas: price, ...(isPreorderLaptop(laptop) ? { delivery } : {}) };
  }
  if (isPreorderLaptop(laptop)) {
    if (!laptopDeliveries(laptop).includes(delivery)) throw new Error('Choose a valid delivery option.');
    return { delivery, pricePesewas: calculateRmbPrice(laptop.preorderCost, delivery, settings).pricePesewas };
  }
  const price = laptopToCatalogueItem(laptop, config).pricePesewas;
  return price ? { pricePesewas: price } : {};
}
