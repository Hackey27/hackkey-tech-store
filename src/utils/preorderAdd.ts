import { PreorderProduct } from '../../shared/types';
import { readableSelections, resolvePreorderSelection } from '../../shared/preorderCombinations';
import { PreorderCartAddition } from './usePreorderCart';

/**
 * The cart line for a product with nothing left to choose.
 *
 * Used by the listing card and by the comparison, which both offer "Add to
 * pre-order" on a single-combination product. One implementation, because two
 * would be two chances for a card and a comparison to price the same item
 * differently.
 *
 * It resolves through the same function the product page uses rather than
 * reading the combination directly, and returns null when nothing is priced —
 * the caller is expected to have hidden the button by then, but a silent null
 * is better than an order line at no price.
 */
export function buildSingleCombinationAddition(product: PreorderProduct): PreorderCartAddition | null {
  const resolved = resolvePreorderSelection(product, {});
  const combination = resolved.combination;
  if (!combination) return null;

  const delivery = product.deliveryOptions[0];
  const pricePesewas =
    delivery === 'express' ? resolved.priceExpressPesewas : resolved.priceTwoMonthsPesewas;
  if (typeof pricePesewas !== 'number') return null;

  return {
    productId: product.productId,
    productName: product.name,
    combinationId: combination.combinationId,
    selectionLabel: readableSelections(combination.selections, product.variantAxes),
    delivery,
    pricePesewas,
    // Both prices travel with the line so the cart can switch delivery without
    // re-reading a catalogue that may have refreshed by then.
    pricesPesewas: {
      express: resolved.priceExpressPesewas ?? undefined,
      'two-months': resolved.priceTwoMonthsPesewas ?? undefined,
    },
    availableDeliveries: product.deliveryOptions,
    imageUrl: resolved.imagePath || undefined,
  };
}
