import React from 'react';
import { Product } from '../types';
import { Tag, Info, CheckCircle2, ShieldAlert } from 'lucide-react';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  return (
    <div
      id={`product-card-${product.id}`}
      className="flex flex-col justify-between rounded-xl bg-[#0e1c1c] border border-[#014040] hover:border-[#05ef28]/60 transition-all duration-200 overflow-hidden text-slate-100 shadow-md"
    >
      <div className="p-5">
        {/* Top Badges */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[#014040] text-[#05ef28] border border-[#05ef28]/30">
            {product.placeholderLabel}
          </span>
          <span className="text-[10px] font-semibold text-slate-400 bg-black/40 px-2 py-0.5 rounded">
            {product.categoryName}
          </span>
        </div>

        {/* Product Title */}
        <h3 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
          {product.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-300 mt-2 leading-relaxed">
          {product.description}
        </p>

        {/* Details / Specs list */}
        {product.details && product.details.length > 0 && (
          <div className="mt-4 space-y-1.5 pt-3 border-t border-[#014040]/50">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Specifications & Scope:
            </span>
            {product.details.map((detail, idx) => (
              <div key={idx} className="flex items-start gap-1.5 text-xs text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#05ef28] shrink-0 mt-0.5" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        )}

        {/* Reference types / Tags */}
        {product.referenceTypes && product.referenceTypes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {product.referenceTypes.map((ref, idx) => (
              <span
                key={idx}
                className="text-[10px] px-2 py-0.5 rounded-full bg-[#014040]/70 text-slate-300 border border-[#014040]"
              >
                {ref}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Card Footer: Pricing note & Read-only preview state */}
      <div className="px-5 py-3 bg-[#014040]/30 border-t border-[#014040] flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-slate-300">
          <Info className="w-3.5 h-3.5 text-[#05ef28]" />
          <span className="text-[11px] font-medium">{product.pricingNote || 'Configured via Google Sheets'}</span>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#014040] text-[#05ef28] text-[10px] font-bold uppercase tracking-wider border border-[#05ef28]/40">
          Read-Only Preview
        </div>
      </div>
    </div>
  );
};
