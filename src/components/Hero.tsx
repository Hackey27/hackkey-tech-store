import React from 'react';
import { CreditCard, Clock, Smartphone } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { WhatsAppIcon } from './WhatsAppIcon';
import { CheckoutPaymentMode } from '../types';

interface HeroProps {
  onBrowseClick?: () => void;
  onFindOrderClick?: () => void;
  desktopImageUrl?: string;
  mobileImageUrl?: string;
  paymentMode?: CheckoutPaymentMode;
}

export const Hero: React.FC<HeroProps> = ({ onFindOrderClick, desktopImageUrl, mobileImageUrl, paymentMode = 'paystack' }) => {
  const style = {
    '--landing-desktop-image': `url("${desktopImageUrl || '/landing-workspace.webp'}")`,
    '--landing-mobile-image': `url("${mobileImageUrl || '/landing-workspace-mobile.webp'}")`
  } as React.CSSProperties;
  return (
    <section style={style} className="hk-landing-region relative border-b border-white/20 py-12 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl mx-auto text-center space-y-4">
          {/* Main Title */}
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight drop-shadow-sm">
            {STORE_COPY.hero.title}
          </h1>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-white/90 font-medium leading-relaxed max-w-2xl mx-auto drop-shadow-sm">
            {STORE_COPY.hero.lead}
          </p>

          {/* Three Compact Trust Indicators */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 text-xs font-semibold text-[#014040]">
            {/* 1. Secure Paystack checkout */}
            <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 border border-white/60 shadow-xs backdrop-blur-sm hover:bg-white transition-colors">
              {paymentMode === 'momo' ? <Smartphone className="w-4 h-4 text-[#014040]" /> : <CreditCard className="w-4 h-4 text-[#014040]" />}
              <span>{paymentMode === 'momo' ? STORE_COPY.hero.momoTrust : paymentMode === 'both' ? STORE_COPY.hero.bothPaymentTrust : STORE_COPY.hero.trustChips[0]}</span>
            </div>

            {/* 2. Find your order anytime */}
            <div
              onClick={onFindOrderClick}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 border border-white/60 shadow-xs cursor-pointer backdrop-blur-sm hover:bg-white transition-colors"
            >
              <Clock className="w-4 h-4 text-[#014040]" />
              <span>{STORE_COPY.hero.trustChips[1]}</span>
            </div>

            {/* 3. After-sales support via WhatsApp */}
            <a
              href={STORE_COPY.brand.whatsAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={STORE_COPY.brand.whatsAppAccessibleLabel}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/90 border border-white/60 shadow-xs backdrop-blur-sm hover:bg-white transition-colors"
            >
              <WhatsAppIcon className="w-4 h-4 text-[#014040]" />
              <span>{STORE_COPY.hero.trustChips[2]}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
};
