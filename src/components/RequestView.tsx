import React, { useState } from 'react';
import { Layers, Laptop, CheckCircle2, MessageSquare } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

export const RequestView: React.FC = () => {
  const [requestMode, setRequestMode] = useState<'software' | 'laptop'>('software');

  // Software Form State
  const [sFirst, setSFirst] = useState('');
  const [sLast, setSLast] = useState('');
  const [sPhone, setSPhone] = useState('');
  const [sEmail, setSEmail] = useState('');
  const [sSoftware, setSSoftware] = useState('');
  const [sUrl, setSUrl] = useState('');
  const [sNotes, setSNotes] = useState('');
  const [softwareSubmitted, setSoftwareSubmitted] = useState(false);

  // Laptop Form State
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
  const [laptopSubmitted, setLaptopSubmitted] = useState(false);
  const [laptopRef, setLaptopRef] = useState('');

  const handleSoftwareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sFirst || !sLast || !sPhone || !sEmail || !sSoftware) return;
    setSoftwareSubmitted(true);
  };

  const handleLaptopSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lName || !lPhone || !lBudget) return;
    const generatedRef = 'LR-' + Math.floor(100000 + Math.random() * 900000);
    setLaptopRef(generatedRef);
    setLaptopSubmitted(true);
  };

  const resetSoftware = () => {
    setSoftwareSubmitted(false);
    setSSoftware('');
    setSNotes('');
    setSUrl('');
  };

  const resetLaptop = () => {
    setLaptopSubmitted(false);
    setLBudget('');
    setLPreferred('');
    setLSpecs('');
    setLPurpose('');
    setLNotes('');
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
      {/* Page Title */}
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#014040] tracking-tight">
          {STORE_COPY.requestPage.pageTitle}
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 font-medium mt-2">
          {STORE_COPY.brand.tagline}
        </p>
      </div>

      {/* Mode Selector */}
      <div className="bg-[#edf5f3] p-1.5 rounded-2xl border border-[#cbe3dd] flex max-w-md mx-auto shadow-2xs">
        <button
          type="button"
          id="btn-choose-request-software"
          onClick={() => setRequestMode('software')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            requestMode === 'software'
              ? 'bg-[#014040] text-white shadow-xs'
              : 'text-slate-700 hover:text-[#014040]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>{STORE_COPY.requestPage.modeSoftware}</span>
        </button>

        <button
          type="button"
          id="btn-choose-request-laptop"
          onClick={() => setRequestMode('laptop')}
          className={`flex-1 py-3 px-4 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            requestMode === 'laptop'
              ? 'bg-[#014040] text-white shadow-xs'
              : 'text-slate-700 hover:text-[#014040]'
          }`}
        >
          <Laptop className="w-4 h-4" />
          <span>{STORE_COPY.requestPage.modeLaptop}</span>
        </button>
      </div>

      {/* Mode 1: Request Software */}
      {requestMode === 'software' && (
        <div className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-8 shadow-xs">
          {!softwareSubmitted ? (
            <div>
              <div className="border-b border-[#edf4f3] pb-4 mb-6">
                <h2 className="text-xl font-black text-[#014040]">
                  {STORE_COPY.requestPage.software.title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {STORE_COPY.requestPage.software.subtitle}
                </p>
              </div>

              <form onSubmit={handleSoftwareSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1.5">
                      {STORE_COPY.requestPage.software.firstName}
                    </label>
                    <input
                      type="text"
                      value={sFirst}
                      onChange={(e) => setSFirst(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1.5">
                      {STORE_COPY.requestPage.software.lastName}
                    </label>
                    <input
                      type="text"
                      value={sLast}
                      onChange={(e) => setSLast(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#014040] mb-1.5">
                    {STORE_COPY.requestPage.software.phone}
                    <span className="block font-normal text-slate-500 text-[11px] mt-0.5">
                      {STORE_COPY.requestPage.software.phoneHint}
                    </span>
                  </label>
                  <input
                    type="tel"
                    value={sPhone}
                    onChange={(e) => setSPhone(e.target.value)}
                    required
                    placeholder="e.g. 0542638979"
                    className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#014040] mb-1.5">
                    {STORE_COPY.requestPage.software.email}
                  </label>
                  <input
                    type="email"
                    value={sEmail}
                    onChange={(e) => setSEmail(e.target.value)}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#014040] mb-1.5">
                    {STORE_COPY.requestPage.software.softwareName}
                  </label>
                  <input
                    type="text"
                    value={sSoftware}
                    onChange={(e) => setSSoftware(e.target.value)}
                    placeholder={STORE_COPY.requestPage.software.softwarePlaceholder}
                    required
                    className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#014040] mb-1.5">
                    {STORE_COPY.requestPage.software.websiteLink}
                    <span className="font-normal text-slate-500 text-[11px] ml-1">
                      {STORE_COPY.requestPage.software.websiteHint}
                    </span>
                  </label>
                  <input
                    type="url"
                    value={sUrl}
                    onChange={(e) => setSUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#014040] mb-1.5">
                    {STORE_COPY.requestPage.software.notes}
                    <span className="font-normal text-slate-500 text-[11px] ml-1">
                      {STORE_COPY.requestPage.software.notesHint}
                    </span>
                  </label>
                  <textarea
                    rows={3}
                    value={sNotes}
                    onChange={(e) => setSNotes(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {STORE_COPY.requestPage.software.submitBtn}
                </button>
              </form>
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 bg-[#d9ffe0] text-[#0d6520] rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl p-4 max-w-md mx-auto text-sm leading-relaxed">
                <strong>{STORE_COPY.requestPage.software.successTitle}</strong>{' '}
                {STORE_COPY.requestPage.software.successDesc(sSoftware, sPhone)}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetSoftware}
                  className="px-5 py-2.5 rounded-xl bg-[#014040] text-white font-bold text-xs hover:bg-[#025656] cursor-pointer"
                >
                  Submit another request
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mode 2: Request a Laptop (Full fidelity from openLaptopRequest) */}
      {requestMode === 'laptop' && (
        <div className="bg-white rounded-2xl border border-[#d8e7e4] p-6 sm:p-8 shadow-xs">
          {!laptopSubmitted ? (
            <div>
              <div className="border-b border-[#edf4f3] pb-4 mb-6">
                <h2 className="text-xl font-black text-[#014040]">
                  {STORE_COPY.requestPage.laptop.title}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  {STORE_COPY.requestPage.laptop.subtitle}
                </p>
              </div>

              <form onSubmit={handleLaptopSubmit} className="space-y-6">
                {/* Step 1: Your Details */}
                <div className="space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {STORE_COPY.requestPage.laptop.stepDetails}
                  </div>
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
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
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
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.email}
                      </label>
                      <input
                        type="email"
                        value={lEmail}
                        onChange={(e) => setLEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.location}
                      </label>
                      <input
                        type="text"
                        value={lLocation}
                        onChange={(e) => setLLocation(e.target.value)}
                        placeholder={STORE_COPY.requestPage.laptop.locationPlaceholder}
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2: What You Need */}
                <div className="space-y-3 pt-3 border-t border-[#edf4f3]">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {STORE_COPY.requestPage.laptop.stepNeed}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1">
                      {STORE_COPY.requestPage.laptop.budget}
                      <span className="block font-normal text-slate-500 text-[11px] mt-0.5">
                        {STORE_COPY.requestPage.laptop.budgetHint}
                      </span>
                    </label>
                    <input
                      type="text"
                      value={lBudget}
                      onChange={(e) => setLBudget(e.target.value)}
                      placeholder={STORE_COPY.requestPage.laptop.budgetPlaceholder}
                      required
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1">
                      {STORE_COPY.requestPage.laptop.preferredBrand}
                    </label>
                    <input
                      type="text"
                      value={lPreferred}
                      onChange={(e) => setLPreferred(e.target.value)}
                      placeholder={STORE_COPY.requestPage.laptop.preferredPlaceholder}
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                    />
                  </div>
                </div>

                {/* Step 3: Desired Specifications */}
                <div className="space-y-3 pt-3 border-t border-[#edf4f3]">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {STORE_COPY.requestPage.laptop.stepSpecs}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.storageSize}
                      </label>
                      <input
                        type="text"
                        value={lStorage}
                        onChange={(e) => setLStorage(e.target.value)}
                        placeholder={STORE_COPY.requestPage.laptop.storagePlaceholder}
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.ramSize}
                      </label>
                      <input
                        type="text"
                        value={lRam}
                        onChange={(e) => setLRam(e.target.value)}
                        placeholder={STORE_COPY.requestPage.laptop.ramPlaceholder}
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1">
                      {STORE_COPY.requestPage.laptop.otherSpecs}
                      <span className="block font-normal text-slate-500 text-[11px] mt-0.5">
                        {STORE_COPY.requestPage.laptop.otherSpecsHint}
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={lSpecs}
                      onChange={(e) => setLSpecs(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1">
                      {STORE_COPY.requestPage.laptop.purpose}
                      <span className="block font-normal text-slate-500 text-[11px] mt-0.5">
                        {STORE_COPY.requestPage.laptop.purposeHint}
                      </span>
                    </label>
                    <textarea
                      rows={2}
                      value={lPurpose}
                      onChange={(e) => setLPurpose(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1">
                      {STORE_COPY.requestPage.laptop.preferredCondition}
                    </label>
                    <select
                      value={lCondition}
                      onChange={(e) => setLCondition(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                    >
                      {STORE_COPY.requestPage.laptop.conditionOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Step 4: Timing */}
                <div className="space-y-3 pt-3 border-t border-[#edf4f3]">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {STORE_COPY.requestPage.laptop.stepTiming}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.howSoon}
                      </label>
                      <select
                        value={lTimeline}
                        onChange={(e) => setLTimeline(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      >
                        {STORE_COPY.requestPage.laptop.howSoonOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-[#014040] mb-1">
                        {STORE_COPY.requestPage.laptop.readiness}
                      </label>
                      <select
                        value={lReadiness}
                        onChange={(e) => setLReadiness(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                      >
                        {STORE_COPY.requestPage.laptop.readinessOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#014040] mb-1">
                      {STORE_COPY.requestPage.laptop.anythingElse}
                    </label>
                    <textarea
                      rows={2}
                      value={lNotes}
                      onChange={(e) => setLNotes(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs cursor-pointer"
                >
                  {STORE_COPY.requestPage.laptop.submitBtn}
                </button>
              </form>
            </div>
          ) : (
            <div className="py-6 text-center space-y-4">
              <div className="w-12 h-12 bg-[#d9ffe0] text-[#0d6520] rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
              </div>
              <div className="bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl p-4 max-w-md mx-auto text-sm leading-relaxed whitespace-pre-line">
                <strong>{STORE_COPY.requestPage.laptop.successTitle(lName)}</strong>{' '}
                {STORE_COPY.requestPage.laptop.successDesc(laptopRef)}
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={resetLaptop}
                  className="px-5 py-2.5 rounded-xl bg-[#014040] text-white font-bold text-xs hover:bg-[#025656] cursor-pointer"
                >
                  Submit another request
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
