// Local-only sharing fixture. Captures share/copy output without sending data.
import React from 'react';
import { createRoot } from 'react-dom/client';
import { PreorderProductView } from '../../src/components/preorder/PreorderProductView';
import type { PreorderProduct } from '../../shared/types';
import '../../src/index.css';

const report = (text: string) => { document.getElementById('share-report')!.textContent = text; };
Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => report(`Copied: ${text}`) } });
const product: PreorderProduct = {
  productId: 'SHARE-TEST', name: 'Test preorder headphones', categoryId: 'TEST', active: true,
  description: 'Local test product for sharing.', details: [], previewImagePath: '/landing-workspace.webp', galleryImagePaths: ['/landing-workspace.webp'],
  deliveryOptions: ['express', 'two-months'], variantAxes: [{ name: 'Colour', options: ['Black', 'White'] }], imageAssignments: [],
  combinations: [
    { combinationId: 'black', selections: { Colour: 'Black' }, priceExpressPesewas: 10000, priceTwoMonthsPesewas: 8000 },
    { combinationId: 'white', selections: { Colour: 'White' }, priceExpressPesewas: 12000, priceTwoMonthsPesewas: 9000 },
  ],
};
createRoot(document.getElementById('root')!).render(<><output id="share-report" aria-label="Sharing regression" className="block p-2 text-xs">Local sharing test</output><PreorderProductView product={product} onBack={() => {}} onAdd={() => {}} onCompare={() => {}} comparing={false} canCompare /></>);
