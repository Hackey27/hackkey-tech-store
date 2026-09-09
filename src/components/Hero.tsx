import React from 'react';
import { CreditCard, Clock, MessageSquare } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

interface HeroProps {
  onBrowseClick?: () => void;
  onFindOrderClick?: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onFindOrderClick }) => {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eaf3f1] to-[#f7faf9] border-b border-[#dce9e6] py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#014040] tracking-tight leading-tight">
            {STORE_COPY.hero.title}
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-700 font-medium leading-relaxed max-w-2xl mx-auto">
            {STORE_COPY.hero.lead}
          </p>

          {/* Three Compact Trust Indicators */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-slate-800">
            {/* 1. Secure Paystack checkout */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#cbe0dc] shadow-xs hover:border-[#014040]/50 transition-colors">
              <CreditCard className="w-4 h-4 text-[#014040]" />
              <span>{STORE_COPY.hero.trustChips[0]}</span>
            </div>

            {/* 2. Find your order anytime */}
            <div
              onClick={onFindOrderClick}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#cbe0dc] shadow-xs cursor-pointer hover:border-[#014040]/50 transition-colors"
            >
              <Clock className="w-4 h-4 text-[#014040]" />
              <span>{STORE_COPY.hero.trustChips[1]}</span>
            </div>

            {/* 3. WhatsApp support */}
            <a
              href={STORE_COPY.brand.whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-[#cbe0dc] shadow-xs hover:border-[#014040]/50 transition-colors"
            >
              <MessageSquare className="w-4 h-4 text-[#05ef28]" />
              <span>{STORE_COPY.hero.trustChips[2]}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
