import React from 'react';
import { MessageSquare, Phone, Mail, Monitor, Laptop, Download, ExternalLink } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

export const HelpHubView: React.FC = () => {
  const windowsTeamViewerUrl = 'https://download.teamviewer.com/download/TeamViewerQS.exe';
  const macTeamViewerUrl = 'https://download.teamviewer.com/download/TeamViewerQS.dmg';

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
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm transition-all shadow-xs"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquare className="w-5 h-5 fill-current" />
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
                  <span className="text-xs sm:text-sm font-semibold">
                    Phone number: <strong>{STORE_COPY.brand.phoneRaw}</strong>
                  </span>
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
                  <span className="text-xs sm:text-sm font-semibold">
                    Email: <strong>{STORE_COPY.brand.email}</strong>
                  </span>
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
              {/* Windows TeamViewer */}
              <a
                id="remote-support-windows-btn"
                href={windowsTeamViewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#014040] hover:bg-[#025656] text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Monitor className="w-5 h-5 text-[#05ef28]" />
                  <span className="text-xs sm:text-sm font-bold">
                    {STORE_COPY.help.windowsTeamViewer}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#05ef28] text-xs font-bold shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </div>
              </a>

              {/* Mac TeamViewer */}
              <a
                id="remote-support-mac-btn"
                href={macTeamViewerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-3.5 rounded-xl bg-[#014040] hover:bg-[#025656] text-white transition-all group"
              >
                <div className="flex items-center gap-3">
                  <Laptop className="w-5 h-5 text-[#05ef28]" />
                  <span className="text-xs sm:text-sm font-bold">
                    {STORE_COPY.help.macTeamViewer}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/10 text-[#05ef28] text-xs font-bold shrink-0">
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </div>
              </a>
            </div>
          </div>

          <div className="mt-5 text-[11.5px] text-slate-500">
            {STORE_COPY.help.unavailableNotice}
          </div>
        </section>
      </div>
    </div>
  );
};
