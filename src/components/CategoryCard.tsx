import React from 'react';
import { Category, BusinessCategory } from '../types';
import { Binary, FileSearch, Package, Laptop, Check } from 'lucide-react';

interface CategoryCardProps {
  category: Category;
  isSelected: boolean;
  onSelect: (categoryId: BusinessCategory) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  isSelected,
  onSelect
}) => {
  const getCategoryIcon = (id: BusinessCategory) => {
    switch (id) {
      case 'statistical-software':
        return <Binary className="w-5 h-5" />;
      case 'research-services':
        return <FileSearch className="w-5 h-5" />;
      case 'software-bundles':
        return <Package className="w-5 h-5" />;
      case 'laptops':
        return <Laptop className="w-5 h-5" />;
      default:
        return <Binary className="w-5 h-5" />;
    }
  };

  return (
    <div
      id={`category-card-${category.id}`}
      onClick={() => onSelect(category.id)}
      className={`cursor-pointer text-left p-4 sm:p-5 rounded-xl border transition-all duration-200 flex flex-col justify-between ${
        isSelected
          ? 'bg-[#014040] border-[#05ef28] shadow-lg shadow-[#014040]/50 ring-1 ring-[#05ef28]'
          : 'bg-[#0e1c1c] border-[#014040]/70 hover:border-[#05ef28]/50 hover:bg-[#122323]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-[#05ef28] text-[#014040]'
                : 'bg-[#014040] text-[#05ef28]'
            }`}
          >
            {getCategoryIcon(category.id)}
          </div>
          {isSelected && (
            <span className="flex items-center gap-1 text-[11px] font-bold text-[#05ef28] bg-black/40 px-2 py-0.5 rounded-full border border-[#05ef28]/40">
              <Check className="w-3 h-3" />
              Active
            </span>
          )}
        </div>

        <h3 className="text-base font-bold text-white tracking-tight">
          {category.name}
        </h3>
        <p className="text-xs text-slate-300 mt-1 leading-relaxed">
          {category.shortDescription}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[#014040]/50">
        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block mb-1">
          Representative Offerings:
        </span>
        <div className="flex flex-wrap gap-1">
          {category.representativeItems.map((item, idx) => (
            <span
              key={idx}
              className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                isSelected
                  ? 'bg-black/30 text-white border border-[#05ef28]/30'
                  : 'bg-[#014040]/60 text-slate-300'
              }`}
            >
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};
