import React, { useState } from 'react';
import {
  MessageSquare,
  Phone,
  Mail,
  Monitor,
  Laptop,
  Download,
  ExternalLink,
  Layers,
  X,
  CheckCircle2
} from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

interface HelpHubViewProps {
  onNavigateToRequest?: (mode: 'software' | 'laptop') => void;
}

export const HelpHubView: React.FC<HelpHubViewProps> = ({ onNavigateToRequest }) => {
  const windowsTeamViewerUrl = 'https://download.teamviewer.com/download/TeamViewerQS.exe';
  const macTeamViewerUrl = 'https://download.teamviewer.com/download/TeamViewerQS.dmg';

  // Modal sheet state for Section 9.8: Both must open as a modal sheet
  const [modalMode, setModalMode] = useState<'software' | 'laptop' | null>(null);

  // Software modal form state
  const [sFirst, setSFirst] = useState('');
  const [sLast, setSLast] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sSoftware, setSSoftware] = useState('');
  const [sUrl, setSUrl] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [sSubmitted, setSSubmitted] = useState(false);
  const [sLoading, setSLoading] = useState(false);

  // Laptop modal form state
  const [lName, setLName] = useState('');
  const [lPhone, setLPhone] = useState('');
  const [lEmail, setLEmail] = useState('');
  const [lLocation, setLLocation] = useState('');
  const [lBudget, setLBudget] = useState('');
  const [lPreferred, setLPreferred] = useState('');
  const [lStorage, setLStorage] = useState('');
  const [lRam, setLRam] = useState('');
  const [lSpecs, setLSpecs] = useState('');
  const [lPurpose, setLPurpose] = useState('');
  const [lCondition, setLCondition] = useState('Foreign Slightly Used - cheaper');
  const [lTimeline, setLTimeline] = useState('As soon as possible');
  const [lReadiness, setLReadiness] = useState('Fully ready');
  const [lNotes, setLNotes] = useState('');
  const [lSubmitted, setLSubmitted] = useState(false);
  const [lRef, setLRef] = useState('');
  const [lLoading, setLLoading] = useState(false);

  const handleSoftwareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sFirst || !sLast || !sPhone || !sEmail || !sSoftware) return;

    setSLoading(true);
    try {
      await fetch('/api/requests/software', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: sFirst,
          lastName: sLast,
          phone: sPhone,
          email: sEmail,
          softwareName: sSoftware,
          websiteUrl: sUrl,
          notes: sNotes
        })
      });
      setSSubmitted(true);
    } catch (err) {
      console.error(err);
      setSSubmitted(true);
    } finally {
      setSLoading(false);
    }
  };

  const handleLaptopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lName || !lPhone || !lBudget) return;

    setLLoading(true);
    try {
      const res = await fetch('/api/requests/laptop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: lName,
          phone: lPhone,
          email: lEmail,
          location: lLocation,
          budget: lBudget,
          preferredBrand: lPreferred,
          storage: lStorage,
          ram: lRam,
          specsNotes: lSpecs,
          purpose: lPurpose,
          condition: lCondition,
          timeline: lTimeline,
          readiness: lReadiness,
          notes: lNotes
        })
      });
      const data = await res.json();
      setLRef(data.request?.request_id || 'LR-' + Math.floor(100000 + Math.random() * 900000));
      setLSubmitted(true);
    } catch (err) {
      console.error(err);
      setLRef('LR-' + Math.floor(100000 + Math.random() * 900000));
      setLSubmitted(true);
    } finally {
      setLLoading(false);
    }
  };

  const closeModal = () => {
    setModalMode(null);
    setSSubmitted(false);
    setLSubmitted(false);
  };

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

      {/* Section 9.8: Request something card with modal sheet openers */}
      <section className="bg-gradient-to-br from-[#014040] to-[#025656] text-white rounded-2xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-lg sm:text-xl font-black tracking-tight">
              Request something
            </h3>
            <p className="text-xs sm:text-sm text-slate-200 max-w-xl leading-relaxed">
              Can&apos;t find the software you need, or looking for a laptop that matches a particular budget or specification?
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 shrink-0">
            <button
              type="button"
              id="help-request-software-btn"
              onClick={() => setModalMode('software')}
              className="px-5 py-2.5 rounded-xl bg-white text-[#014040] font-black text-xs hover:bg-[#edf5f3] transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>Request software</span>
            </button>

            <button
              type="button"
              id="help-request-laptop-btn"
              onClick={() => setModalMode('laptop')}
              className="px-5 py-2.5 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Laptop className="w-4 h-4" />
              <span>Request a laptop</span>
            </button>
          </div>
        </div>
      </section>

      {/* MODAL SHEET FOR REQUESTS (Section 9.8) */}
      {modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-white rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto border border-[#d8e7e4] shadow-2xl p-6 sm:p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#edf4f3] pb-4">
              <div>
                <h2 className="text-xl font-black text-[#014040]">
                  {modalMode === 'software'
                    ? STORE_COPY.requestPage.software.title
                    : STORE_COPY.requestPage.laptop.title}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalMode === 'software'
                    ? STORE_COPY.requestPage.software.subtitle
                    : STORE_COPY.requestPage.laptop.subtitle}
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Software Form */}
            {modalMode === 'software' && (
              <>
                {!sSubmitted ? (
                  <form onSubmit={handleSoftwareSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.software.firstName}
                        </label>
                        <input
                          type="text"
                          value={sFirst}
                          onChange={(e) => setSFirst(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.software.lastName}
                        </label>
                        <input
                          type="text"
                          value={sLast}
                          onChange={(e) => setSLast(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.software.phone}
                      </label>
                      <input
                        type="tel"
                        value={sPhone}
                        onChange={(e) => setSPhone(e.target.value)}
                        required
                        placeholder="e.g. 0542638979"
                        className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.software.email}
                      </label>
                      <input
                        type="email"
                        value={sEmail}
                        onChange={(e) => setSEmail(e.target.value)}
                        required
                        className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.software.softwareName}
                      </label>
                      <input
                        type="text"
                        value={sSoftware}
                        onChange={(e) => setSSoftware(e.target.value)}
                        placeholder={STORE_COPY.requestPage.software.softwarePlaceholder}
                        required
                        className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.software.notes}
                        <span className="font-normal text-slate-500 text-[11px] ml-1">(optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={sNotes}
                        onChange={(e) => setSNotes(e.target.value)}
                        className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={sLoading}
                      className="w-full py-3 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {sLoading ? 'Submitting...' : STORE_COPY.requestPage.software.submitBtn}
                    </button>
                  </form>
                ) : (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-[#d9ffe0] text-[#0d6520] rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div className="bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl p-4 text-xs leading-relaxed">
                      <strong>{STORE_COPY.requestPage.software.successTitle}</strong>{' '}
                      {STORE_COPY.requestPage.software.successDesc(sSoftware, sPhone)}
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-5 py-2 rounded-xl bg-[#014040] text-white font-bold text-xs"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Modal Body: Laptop Form */}
            {modalMode === 'laptop' && (
              <>
                {!lSubmitted ? (
                  <form onSubmit={handleLaptopSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.laptop.name}
                        </label>
                        <input
                          type="text"
                          value={lName}
                          onChange={(e) => setLName(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.laptop.phone}
                        </label>
                        <input
                          type="tel"
                          value={lPhone}
                          onChange={(e) => setLPhone(e.target.value)}
                          required
                          className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.budget}
                        <span className="block font-normal text-slate-500 text-[11px]">
                          {STORE_COPY.requestPage.laptop.budgetHint}
                        </span>
                      </label>
                      <input
                        type="text"
                        value={lBudget}
                        onChange={(e) => setLBudget(e.target.value)}
                        placeholder={STORE_COPY.requestPage.laptop.budgetPlaceholder}
                        required
                        className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.laptop.preferredBrand}
                          <span className="font-normal text-slate-500 text-[11px] ml-1">(optional)</span>
                        </label>
                        <input
                          type="text"
                          value={lPreferred}
                          onChange={(e) => setLPreferred(e.target.value)}
                          placeholder="e.g. Dell, ThinkPad, HP"
                          className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.laptop.preferredCondition}
                        </label>
                        <select
                          value={lCondition}
                          onChange={(e) => setLCondition(e.target.value)}
                          className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                        >
                          {STORE_COPY.requestPage.laptop.conditionOptions.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.purpose}
                        <span className="font-normal text-slate-500 text-[11px] ml-1">(optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        value={lPurpose}
                        onChange={(e) => setLPurpose(e.target.value)}
                        placeholder="e.g. Statistical computing, regression models in SPSS"
                        className="w-full px-3 py-2 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={lLoading}
                      className="w-full py-3 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs sm:text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {lLoading ? 'Submitting...' : STORE_COPY.requestPage.laptop.submitBtn}
                    </button>
                  </form>
                ) : (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-[#d9ffe0] text-[#0d6520] rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div className="bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl p-4 text-xs leading-relaxed">
                      <strong>{STORE_COPY.requestPage.laptop.successTitle(lName)}</strong>{' '}
                      {STORE_COPY.requestPage.laptop.successDesc(lRef)}
                    </div>
                    <button
                      type="button"
                      onClick={closeModal}
                      className="px-5 py-2 rounded-xl bg-[#014040] text-white font-bold text-xs"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
