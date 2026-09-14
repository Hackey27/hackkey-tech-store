import React from 'react';
import { MessageCircle } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

/**
 * Persistent WhatsApp shortcut pinned to the lower-left corner.
 *
 * Sits above the mobile bottom navigation on small screens and drops to the
 * corner on desktop. The pulse is deliberately gentle and is disabled entirely
 * for visitors who prefer reduced motion.
 */
export const FloatingWhatsApp: React.FC = () => {
  return (
    <a
      id="floating-whatsapp-btn"
      href={STORE_COPY.brand.whatsAppUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat with ${STORE_COPY.brand.name} on WhatsApp`}
      title="Chat on WhatsApp"
      className="group fixed bottom-20 left-4 md:bottom-6 md:left-6 z-[45] flex items-center gap-3"
    >
      <span className="relative flex h-14 w-14 items-center justify-center">
        {/* Expanding halo */}
        <span
          aria-hidden="true"
          className="hk-whatsapp-ring absolute inline-flex h-14 w-14 rounded-full bg-[#25D366]/45"
        />

        {/* Button face */}
        <span className="hk-whatsapp-fab relative inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg shadow-[#25D366]/35 ring-1 ring-black/5 transition-colors group-hover:bg-[#1eb355]">
          <MessageCircle className="h-7 w-7 fill-current stroke-[1.5]" />
        </span>
      </span>

      {/* Label reveals on pointer devices only */}
      <span className="hidden md:inline-flex items-center rounded-full bg-[#014040] px-3.5 py-2 text-xs font-bold text-white shadow-md opacity-0 translate-x-[-6px] transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0 pointer-events-none">
        Chat on WhatsApp
      </span>
    </a>
  );
};
