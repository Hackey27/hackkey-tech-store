import React from 'react';
import type { PreorderProduct, RmbPricingSettings } from '../../shared/types';
import { combinationsForAxes, readableSelections } from '../../shared/preorderCombinations';
import { RmbCostEditor } from './RmbCostEditor';

export function RmbCombinationCosts({ product, settings, onChange }: { product: PreorderProduct; settings: RmbPricingSettings; onChange: (product: Partial<PreorderProduct>) => void }) {
  const rows = product.uniformPricing ? product.combinations.slice(0, 1) : product.combinations;
  return <section className="space-y-4"><h3 className="font-black text-[#014040]">RMB costs &amp; calculated selling prices</h3>{rows.map((combination, index) => <div key={combination.combinationId}><p className="mb-2 text-sm font-bold">{product.uniformPricing ? 'Same source costs for all combinations' : readableSelections(combination.selections, product.variantAxes) || 'No variants'}</p><RmbCostEditor cost={combination.sourceCost} deliveries={product.deliveryOptions} settings={settings} onChange={sourceCost => onChange({ combinations: product.combinations.map((row, position) => product.uniformPricing || position === index ? { ...row, sourceCost } : row) })} /></div>)}{product.uniformPricing && <button type="button" className="rounded-xl border px-4 py-2 text-xs font-bold" onClick={() => onChange({ combinations: combinationsForAxes(product.variantAxes).map(row => ({ ...row, ...(product.combinations[0]?.sourceCost ? { sourceCost: product.combinations[0].sourceCost } : {}) })) })}>Fill combinations from variants</button>}</section>;
}
