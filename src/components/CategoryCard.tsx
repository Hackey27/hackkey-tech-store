import React from 'react';
import { Category } from '../types';
import { Boxes, ChartNoAxesCombined, ChevronRight, Laptop, Palette, Wrench } from 'lucide-react';

interface CategoryCardProps {
  category: Category;
  isSelected: boolean;
  onSelect: (categoryId: string) => void;
}

export const CategoryCard: React.FC<CategoryCardProps> = ({
  category,
  isSelected,
  onSelect
}) => {
  const getCategoryIcon = (id: string) => {
    switch (id) {
      case 'DATA':
        return <ChartNoAxesCombined className="h-10 w-10" />;
      case 'SERVICE':
        return <Wrench className="h-10 w-10" />;
      case 'BUNDLE':
        return <Boxes className="h-10 w-10" />;
      case 'LAPTOP':
        return <Laptop className="h-10 w-10" />;
      case 'DESIGN':
        return <Palette className="h-10 w-10" />;
      default:
        return <ChartNoAxesCombined className="h-10 w-10" />;
    }
  };

  const catId = category.categoryId || category.categoryId || '';

  return (
    <div
      id={`category-card-${catId}`}
      onClick={() => onSelect(catId)}
      style={category.imageUrl ? { backgroundImage: `linear-gradient(rgb(1 64 64 / 80%), rgb(1 64 64 / 80%)), url("${category.imageUrl}")` } : undefined}
      className={`group min-h-36 cursor-pointer select-none rounded-2xl border bg-cover bg-center p-5 text-left transition-all duration-200 sm:p-6 ${
        isSelected
          ? 'bg-[#014040] text-white border-[#014040] shadow-md ring-2 ring-[#05ef28]'
          : category.imageUrl ? 'text-white border-[#014040] hover:shadow-md' : 'bg-white text-slate-800 border-[#d8e7e4] hover:border-[#014040] hover:shadow-xs hover:bg-[#fbfdfc]'
      }`}
    >
      <div className="flex h-full items-center gap-4">
          <div
            className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl transition-colors ${
              isSelected
                ? 'bg-[#05ef28] text-[#014040]'
                : category.imageUrl ? 'bg-white/15 text-[#05ef28]' : 'bg-[#edf5f3] text-[#014040] group-hover:bg-[#014040] group-hover:text-[#05ef28]'
            }`}
          >
            {getCategoryIcon(catId)}
          </div>
        <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><h3
          className={`text-lg font-black tracking-tight leading-snug sm:text-xl ${
            isSelected || category.imageUrl ? 'text-white' : 'text-[#014040]'
          }`}
        >
          {category.name}
        </h3><ChevronRight className={`mt-1 h-5 w-5 shrink-0 transition-transform group-hover:translate-x-0.5 ${isSelected || category.imageUrl ? 'text-[#05ef28]' : 'text-slate-400 group-hover:text-[#014040]'}`} /></div>

      {/* Examples tag */}
      {category.representativeItems && category.representativeItems.length > 0 && (
        <div className="mt-3 border-t border-dashed border-current/15 pt-2.5">
          <div className="flex flex-wrap gap-1">
            {category.representativeItems.slice(0, 3).map((item, idx) => (
              <span
                key={idx}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  isSelected || category.imageUrl
                    ? 'bg-white/15 text-slate-100'
                    : 'bg-[#edf4f3] text-slate-700'
                }`}
              >
                {item}
              </span>
            ))}
            {category.representativeItems.length > 3 && (
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  isSelected || category.imageUrl ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                +{category.representativeItems.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
        </div>
      </div>
    </div>
  );
};
