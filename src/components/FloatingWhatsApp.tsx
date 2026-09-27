import React from 'react';
import { STORE_COPY } from '../config/storeCopy';
import { WhatsAppIcon } from './WhatsAppIcon';

/**
 * Persistent WhatsApp shortcut pinned to the lower-right corner.
 *
 * Desktop only. On a phone the header carries the WhatsApp button instead —
 * the corner belongs to the bottom navigation, and two WhatsApp entry points
 * on one small screen is one too many.
 *
 * The pulse is deliberately gentle and is disabled entirely for visitors who
 * prefer reduced motion.
 */
export const FloatingWhatsApp: React.FC = () => {
  return (
    <a
      id="floating-whatsapp-btn"
      href={STORE_COPY.brand.whatsAppUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={STORE_COPY.brand.whatsAppAccessibleLabel}
      title={STORE_COPY.brand.whatsAppCta}
      className="group fixed bottom-6 right-6 z-[45] hidden h-14 w-14 items-center justify-center md:flex"
    >
      <span className="relative flex h-14 w-14 items-center justify-center">
        {/* Expanding halo */}
        <span
          aria-hidden="true"
          className="hk-whatsapp-ring pointer-events-none absolute inline-flex h-14 w-14 rounded-full bg-[#25D366]/45"
        />

        {/* Button face */}
        <span className="hk-whatsapp-fab relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/35 ring-1 ring-black/5 transition-colors group-hover:bg-[#1eb355]">
          <WhatsAppIcon className="h-7 w-7" />
        </span>
      </span>

      {/* Label reveals on pointer devices only */}
      <span className="pointer-events-none absolute right-16 hidden whitespace-nowrap rounded-full bg-[#014040] px-3.5 py-2 text-xs font-bold text-white shadow-md opacity-0 translate-x-1.5 transition-[opacity,transform] duration-200 group-hover:opacity-100 group-hover:translate-x-0 md:inline-flex">
        {STORE_COPY.brand.whatsAppCta}
      </span>
    </a>
  );
};
