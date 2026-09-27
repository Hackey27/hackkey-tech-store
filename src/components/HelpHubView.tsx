import React, { useEffect, useState } from 'react';
import {
  Phone,
  Mail,
  Monitor,
  Laptop,
  Download,
  ExternalLink
} from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';
import { WhatsAppIcon } from './WhatsAppIcon';
import type { SupportTool } from '../../shared/types';

/**
 * What to show before the seller has configured anything, and if the request
 * for the configured list fails. Remote support is the page a customer opens
 * when they are already stuck, so it must never be empty.
 */
const FALLBACK_TOOLS: SupportTool[] = [
  { toolId: 'teamviewer-windows', label: 'Windows', url: 'https://download.teamviewer.com/download/TeamViewerQS.exe', active: true },
  { toolId: 'teamviewer-mac', label: 'Mac', url: 'https://download.teamviewer.com/download/TeamViewerQS.dmg', active: true }
];

/** Mac keeps the laptop glyph; everything else reads as a screen session. */
const toolIcon = (tool: SupportTool) => (/\bmac(os)?\b/i.test(tool.label) ? Laptop : Monitor);

export const HelpHubView: React.FC = () => {
  const [tools, setTools] = useState<SupportTool[]>(FALLBACK_TOOLS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/support-tools');
        if (!response.ok) return;
        const data = await response.json();
        // An empty configured list means "not set up yet", not "show nothing".
        if (!cancelled && Array.isArray(data.tools) && data.tools.length) setTools(data.tools);
      } catch {
        // Keep the fallback. A failed lookup must not empty the page.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Top Header */}
      <div className="text-center max-w-2xl mx-auto">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#014040] tracking-tight">
          {STORE_COPY.help.secTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2">
          {STORE_COPY.help.contactDesc}
        </p>
      </div>

      {/* Support Channels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        {/* Contact Hack-Key Tech */}
        <section className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#edf5f3] text-[#014040] flex items-center justify-center mb-4 border border-[#cbe3dd]">
              <Phone className="w-5 h-5 text-[#014040]" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#014040]">
              {STORE_COPY.help.contactTitle}
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              {STORE_COPY.help.contactDesc}
            </p>

            <div className="mt-5 space-y-3">
              {/* WhatsApp help button */}
              <a
                id="help-whatsapp-link"
                href={STORE_COPY.brand.whatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={STORE_COPY.brand.whatsAppAccessibleLabel}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm hk-pressable shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <WhatsAppIcon className="w-5 h-5" />
                  <span>{STORE_COPY.help.whatsAppHelpBtn}</span>
                </div>
                <ExternalLink className="w-4 h-4 stroke-[2.5]" />
              </a>

              {/* Phone number */}
              <a
                id="help-phone-link"
                href={`tel:${STORE_COPY.brand.phoneRaw}`}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#edf5f3] hover:bg-[#dff0ec] border border-[#cbe3dd] text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-[#014040]" />
                  <strong className="text-xs sm:text-sm">{STORE_COPY.brand.phoneRaw}</strong>
                </div>
              </a>

              {/* Email */}
              <a
                id="help-email-link"
                href={`mailto:${STORE_COPY.brand.email}`}
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#edf5f3] hover:bg-[#dff0ec] border border-[#cbe3dd] text-slate-900 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-[#014040]" />
                  <strong className="text-xs sm:text-sm">{STORE_COPY.brand.email}</strong>
                </div>
              </a>
            </div>
          </div>
        </section>

        {/* Remote support (TeamViewer) */}
        <section className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-7 shadow-xs flex flex-col justify-between">
          <div>
            <div className="w-11 h-11 rounded-xl bg-[#edf5f3] text-[#014040] flex items-center justify-center mb-4 border border-[#cbe3dd]">
              <Monitor className="w-5 h-5 text-[#014040]" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-[#014040]">
              {STORE_COPY.help.remoteSupportTitle}
            </h2>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {STORE_COPY.help.remoteSupportDesc}
            </p>

            <div className="mt-5 space-y-3">
              {/* Set in the admin portal under Support tools. The seller owns
                  these because vendors move their downloads. */}
              {tools.map((tool) => {
                const Icon = toolIcon(tool);
                return (
                  <a
                    key={tool.toolId}
                    id={`remote-support-${tool.toolId}-btn`}
                    href={tool.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between p-3.5 rounded-xl bg-[#014040] hover:bg-[#025656] text-white hk-pressable group"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className="w-5 h-5 shrink-0 text-[#05ef28]" />
                      <span className="min-w-0">
                        <span className="block truncate text-xs sm:text-sm font-bold">{tool.label}</span>
                        {tool.note && <span className="mt-0.5 block truncate text-[11px] font-medium text-white/70">{tool.note}</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#05ef28] text-xs font-bold shrink-0">
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

        </section>
      </div>
    </div>
  );
};
