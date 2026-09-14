import React from 'react';
import { Category, BusinessCategory } from '../types';
import { BarChart3, FileText, Layers, Laptop, ChevronRight } from 'lucide-react';

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
        return <BarChart3 className="w-5 h-5" />;
      case 'research-services':
        return <FileText className="w-5 h-5" />;
      case 'software-bundles':
        return <Layers className="w-5 h-5" />;
      case 'laptops':
        return <Laptop className="w-5 h-5" />;
      default:
        return <BarChart3 className="w-5 h-5" />;
    }
  };

  const catId = category.category_id || category.id || '';

  return (
    <div
      id={`category-card-${catId}`}
      onClick={() => onSelect(catId)}
      className={`group cursor-pointer text-left p-4 sm:p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between select-none ${
        isSelected
          ? 'bg-[#014040] text-white border-[#014040] shadow-md ring-2 ring-[#05ef28]'
          : 'bg-white text-slate-800 border-[#d8e7e4] hover:border-[#014040] hover:shadow-xs hover:bg-[#fbfdfc]'
      }`}
    >
      <div>
        <div className="flex items-center justify-between mb-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-[#05ef28] text-[#014040]'
                : 'bg-[#edf5f3] text-[#014040] group-hover:bg-[#014040] group-hover:text-[#05ef28]'
            }`}
          >
            {getCategoryIcon(catId)}
          </div>
          <ChevronRight
            className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${
              isSelected ? 'text-[#05ef28]' : 'text-slate-400 group-hover:text-[#014040]'
            }`}
          />
        </div>

        <h3
          className={`text-sm sm:text-base font-bold tracking-tight leading-snug ${
            isSelected ? 'text-white' : 'text-[#014040]'
          }`}
        >
          {category.name}
        </h3>

        <p
          className={`text-xs mt-1.5 leading-relaxed ${
            isSelected ? 'text-slate-200' : 'text-slate-600'
          }`}
        >
          {category.shortDescription}
        </p>
      </div>

      {/* Examples tag */}
      {category.representativeItems && category.representativeItems.length > 0 && (
        <div className="mt-3 pt-2.5 border-t border-dashed border-current/15">
          <div className="flex flex-wrap gap-1">
            {category.representativeItems.slice(0, 3).map((item, idx) => (
              <span
                key={idx}
                className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                  isSelected
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
                  isSelected ? 'text-slate-300' : 'text-slate-400'
                }`}
              >
                +{category.representativeItems.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
