import React, { useState, useEffect } from 'react';
import { Layers, Laptop, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { STORE_COPY } from '../config/storeCopy';

type RequestMode = 'software' | 'laptop';

export const RequestView: React.FC<{ initialMode?: RequestMode | null }> = ({ initialMode = null }) => {
  /**
   * Requests open as a modal sheet, matching the pattern the help hub used to
   * carry. The tab itself only presents the two launchers.
   */
  const [modalMode, setModalMode] = useState<RequestMode | null>(initialMode);

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

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Close on Escape and lock background scrolling while the sheet is open.
  useEffect(() => {
    if (!modalMode) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalMode(null);
    };

    document.addEventListener('keydown', handleKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [modalMode]);

  const openModal = (mode: RequestMode) => {
    setSubmitError(null);
    setModalMode(mode);
  };

  const closeModal = () => {
    setModalMode(null);
    setSubmitError(null);
  };

  const handleSoftwareSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sFirst || !sLast || !sPhone || !sEmail || !sSoftware) return;

    setIsSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch('/api/requests/software', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: sFirst,
          lastName: sLast,
          phone: sPhone,
          email: sEmail,
          softwareName: sSoftware,
          websiteUrl: sUrl,
          notes: sNotes,
        })
      });
      if (!res.ok) {
        throw new Error('Failed to submit software request.');
      }
      setSoftwareSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaptopSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lName || !lPhone || !lBudget) return;

    setIsSubmitting(true);
    setSubmitError(null);
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
          notes: lNotes,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error('Failed to submit laptop sourcing request.');
      }
      setLaptopRef(data.request?.requestId || 'LR-' + Math.floor(100000 + Math.random() * 900000));
      setLaptopSubmitted(true);
    } catch (err: any) {
      setSubmitError(err.message || 'Error submitting request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSoftware = () => {
    setSoftwareSubmitted(false);
    setSSoftware('');
    setSNotes('');
    setSUrl('');
    setSubmitError(null);
  };

  const resetLaptop = () => {
    setLaptopSubmitted(false);
    setLBudget('');
    setLPreferred('');
    setLSpecs('');
    setLPurpose('');
    setLNotes('');
    setSubmitError(null);
  };

  const fieldClass =
    'w-full px-3.5 py-2.5 bg-[#f8fbfa] border border-[#cbdcd9] rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:border-[#014040] focus:ring-1 focus:ring-[#05ef28]';

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

      {/* Launcher card — carries the design and behaviour the help hub used */}
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
              id="btn-choose-request-software"
              onClick={() => openModal('software')}
              className="px-5 py-2.5 rounded-xl bg-white text-[#014040] font-black text-xs hover:bg-[#edf5f3] transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Layers className="w-4 h-4" />
              <span>{STORE_COPY.requestPage.modeSoftware}</span>
            </button>

            <button
              type="button"
              id="btn-choose-request-laptop"
              onClick={() => openModal('laptop')}
              className="px-5 py-2.5 rounded-xl bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-xs transition-all shadow-xs flex items-center gap-2 cursor-pointer"
            >
              <Laptop className="w-4 h-4" />
              <span>{STORE_COPY.requestPage.modeLaptop}</span>
            </button>
          </div>
        </div>
      </section>

      {/* MODAL SHEET */}
      {modalMode && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-[#d8e7e4] shadow-2xl p-6 sm:p-8 space-y-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 border-b border-[#edf4f3] pb-4">
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
                aria-label="Close"
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submission error */}
            {submitError && (
              <div className="flex items-start gap-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 p-3.5 text-xs leading-relaxed">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            {/* Modal Body: Software Request */}
            {modalMode === 'software' && (
              <>
                {!softwareSubmitted ? (
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
                          className={fieldClass}
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
                          className={fieldClass}
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
                        className={fieldClass}
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
                        className={fieldClass}
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
                        className={fieldClass}
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
                        className={fieldClass}
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
                        className={fieldClass}
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : STORE_COPY.requestPage.software.submitBtn}
                    </button>
                  </form>
                ) : (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-[#d9ffe0] text-[#0d6520] rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div className="bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl p-4 max-w-md mx-auto text-sm leading-relaxed">
                      <strong>{STORE_COPY.requestPage.software.successTitle}</strong>{' '}
                      {STORE_COPY.requestPage.software.successDesc(sSoftware, sPhone)}
                    </div>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={resetSoftware}
                        className="px-5 py-2.5 rounded-xl bg-[#014040] text-white font-bold text-xs hover:bg-[#025656] cursor-pointer"
                      >
                        Submit another request
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-5 py-2.5 rounded-xl bg-[#edf5f3] text-[#014040] font-bold text-xs hover:bg-[#dff0ec] cursor-pointer"
                      >
                        Close Window
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Modal Body: Laptop Request */}
            {modalMode === 'laptop' && (
              <>
                {!laptopSubmitted ? (
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
                            className={fieldClass}
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
                            className={fieldClass}
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
                            className={fieldClass}
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
                            className={fieldClass}
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
                          className={fieldClass}
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
                          className={fieldClass}
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
                            className={fieldClass}
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
                            className={fieldClass}
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
                          className={fieldClass}
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
                          className={fieldClass}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-[#014040] mb-1">
                          {STORE_COPY.requestPage.laptop.preferredCondition}
                        </label>
                        <select
                          value={lCondition}
                          onChange={(e) => setLCondition(e.target.value)}
                          className={fieldClass}
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
                            className={fieldClass}
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
                            className={fieldClass}
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
                          className={fieldClass}
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3.5 px-4 bg-[#05ef28] hover:bg-[#04d824] text-[#014040] font-black text-sm rounded-xl transition-all shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? 'Submitting...' : STORE_COPY.requestPage.laptop.submitBtn}
                    </button>
                  </form>
                ) : (
                  <div className="py-6 text-center space-y-4">
                    <div className="w-12 h-12 bg-[#d9ffe0] text-[#0d6520] rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle2 className="w-7 h-7 stroke-[2.5]" />
                    </div>
                    <div className="bg-[#d9ffe0] border border-[#b2f0bf] text-[#0d6520] rounded-xl p-4 max-w-md mx-auto text-sm leading-relaxed whitespace-pre-line">
                      <strong>{STORE_COPY.requestPage.laptop.successTitle(lName)}</strong>{' '}
                      {STORE_COPY.requestPage.laptop.successDesc(laptopRef)}
                    </div>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={resetLaptop}
                        className="px-5 py-2.5 rounded-xl bg-[#014040] text-white font-bold text-xs hover:bg-[#025656] cursor-pointer"
                      >
                        Submit another request
                      </button>
                      <button
                        type="button"
                        onClick={closeModal}
                        className="px-5 py-2.5 rounded-xl bg-[#edf5f3] text-[#014040] font-bold text-xs hover:bg-[#dff0ec] cursor-pointer"
                      >
                        Close Window
                      </button>
                    </div>
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
