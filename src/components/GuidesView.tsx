import React, { useEffect, useMemo, useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromKes } from '../lib/eastAfrica';
import {
  getEditorialGuides,
  GuideArticle,
  GuideCategoryKey,
} from '../data/editorialGuides';
import {
  BookOpen,
  CheckCircle2,
  ArrowRight,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';

export const GuidesView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const { selectedCountry } = useRegion();
  const guides = useMemo(() => getEditorialGuides(selectedCountry), [selectedCountry]);

  const [categoryFilter, setCategoryFilter] = useState<'all' | GuideCategoryKey>('all');
  const [selectedGuideId, setSelectedGuideId] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const paramId = new URLSearchParams(window.location.search).get('guide')?.trim();
      if (paramId) return paramId;
    }
    return 'ai-data-annotation-manual';
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncFromQuery = () => {
      const paramId = new URLSearchParams(window.location.search).get('guide')?.trim();
      if (!paramId) return;
      const matched = guides.find(
        (g) => g.id === paramId || (g.legacyIds && g.legacyIds.includes(paramId))
      );
      if (matched) {
        setSelectedGuideId(matched.id);
      }
    };
    const handleCustomSelect = (event: Event) => {
      const customEvent = event as CustomEvent<string>;
      const guideId = customEvent.detail?.trim();
      if (!guideId) return;
      const matched = guides.find(
        (g) => g.id === guideId || (g.legacyIds && g.legacyIds.includes(guideId))
      );
      if (matched) {
        setSelectedGuideId(matched.id);
      }
    };
    syncFromQuery();
    window.addEventListener('popstate', syncFromQuery);
    window.addEventListener('gideon:select-guide', handleCustomSelect as EventListener);
    return () => {
      window.removeEventListener('popstate', syncFromQuery);
      window.removeEventListener('gideon:select-guide', handleCustomSelect as EventListener);
    };
  }, [guides]);

  const filteredGuides = useMemo(() => {
    if (categoryFilter === 'all') return guides;
    return guides.filter((g) => g.categoryKey === categoryFilter);
  }, [guides, categoryFilter]);

  const selectedGuide: GuideArticle = useMemo(() => {
    const exact = guides.find(
      (g) => g.id === selectedGuideId || (g.legacyIds && g.legacyIds.includes(selectedGuideId))
    );
    if (exact) return exact;
    return filteredGuides[0] || guides[0];
  }, [guides, filteredGuides, selectedGuideId]);

  const handleSelectGuide = (guideId: string) => {
    setSelectedGuideId(guideId);
    try {
      window.history.replaceState({ tab: 'guides' }, '', `/guides?guide=${encodeURIComponent(guideId)}`);
    } catch {}
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-200">
      {/* Editorial Header */}
      <header className="space-y-3 max-w-3xl pb-6 border-b border-slate-200">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <BookOpen className="w-3.5 h-3.5 text-brand-600" />
          <span>Editorial Knowledge Base</span>
          <span aria-hidden="true">·</span>
          <span>East Africa Field Handbooks</span>
          <span aria-hidden="true">·</span>
          <span>Human-Edited</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight text-balance">
          Practical Handbooks for East African Contributors, Sellers &amp; Creators
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
          Every guide below is written and maintained by our Nairobi operations desk from real review queues—covering street-scene image labeling, survey quality filters, thermal receipt math, PayPal settlement thresholds &amp; National ID KYC, 50% PayPal escrow auctions, and free Pay-Per-View 24-hour status payouts.
        </p>

        {/* Functional Category Filter Tabs */}
        <div className="pt-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            All Handbooks ({guides.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('data-work')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'data-work'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Annotation, Surveys &amp; OCR
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('finance')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'finance'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            PayPal, KYC &amp; Payouts
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('marketplace')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
              categoryFilter === 'marketplace'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            Auctions &amp; Pay-Per-View
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Directory */}
        <aside className="lg:col-span-4 space-y-4">
          <div className="text-xs font-semibold text-slate-500 px-1">
            Select a Handbook ({filteredGuides.length})
          </div>
          <div className="space-y-2.5">
            {filteredGuides.map((guide, index) => {
              const isSelected = guide.id === selectedGuide.id;
              return (
                <button
                  key={guide.id}
                  type="button"
                  onClick={() => handleSelectGuide(guide.id)}
                  className={`w-full text-left p-4 rounded-2xl transition-colors cursor-pointer border ${
                    isSelected
                      ? 'bg-white border-brand-600 shadow-sm'
                      : 'bg-slate-50/70 hover:bg-white border-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1.5">
                    <span className="font-mono text-slate-400">0{index + 1}.</span>
                    <span className="text-brand-700 font-semibold">{guide.category}</span>
                    <span aria-hidden="true">·</span>
                    <span>{guide.readTime}</span>
                  </div>
                  <h2
                    className={`text-xs font-bold leading-snug ${
                      isSelected ? 'text-slate-900' : 'text-slate-700'
                    }`}
                  >
                    {guide.title}
                  </h2>
                </button>
              );
            })}
          </div>

          <div className="p-5 bg-slate-900 text-white rounded-2xl space-y-3 mt-4">
            <h3 className="font-bold text-xs text-white">
              8:00 AM EAT Daily Drop &amp; PayPal KYC
            </h3>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Every contributor gets 100% free access (zero Worker Pass required) with 1 vetted task dropped daily at 08:00 AM EAT. Complete your {selectedCountry.idDocumentName} Front &amp; Back KYC to unlock PayPal withdrawals from {formatCurrencyFromKes(150, selectedCountry)}.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className="w-full py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
            >
              Open Dashboard &amp; KYC
            </button>
          </div>
        </aside>

        {/* Long-Form Editorial Article Canvas */}
        <article
          id={selectedGuide.id}
          className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-xs space-y-8"
        >
          {/* Article Masthead */}
          <header className="space-y-4 pb-6 border-b border-slate-200 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-semibold text-brand-700">{selectedGuide.category}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                <Clock className="w-3 h-3" />
                {selectedGuide.readTime}
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedGuide.date}</span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight leading-tight text-balance">
              {selectedGuide.title}
            </h2>

            <p className="text-sm md:text-base text-slate-600 leading-relaxed">
              {selectedGuide.subtitle}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-slate-500">
              <User className="w-3.5 h-3.5 text-slate-400" />
              <span>
                By <strong className="text-slate-900">{selectedGuide.author}</strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>{selectedGuide.authorRole}</span>
            </div>
          </header>

          {/* Opening Editorial Note */}
          <div className="max-w-2xl text-sm md:text-[15px] text-slate-700 leading-[1.75]">
            <p>{selectedGuide.openingNote}</p>
          </div>

          {/* Article Body Sections */}
          <div className="space-y-10 max-w-2xl text-sm md:text-[15px] text-slate-700 leading-[1.75]">
            {selectedGuide.sections.map((sec, idx) => (
              <section key={idx} className="space-y-4 pt-2 border-t border-slate-100">
                <h3 className="text-lg font-bold text-slate-900 tracking-tight pt-4">
                  {sec.heading}
                </h3>

                {sec.body.map((paragraph, pIdx) => (
                  <p key={pIdx}>{paragraph}</p>
                ))}

                {sec.example && (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 my-4">
                    <div className="text-xs font-bold text-slate-900">
                      {sec.example.label}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 bg-white border border-emerald-200 rounded-xl space-y-1">
                        <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Accepted Example</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{sec.example.good}</p>
                      </div>
                      <div className="p-3.5 bg-white border border-rose-200 rounded-xl space-y-1">
                        <div className="font-bold text-rose-800 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                          <span>Common Rejection</span>
                        </div>
                        <p className="text-slate-600 leading-relaxed">{sec.example.avoid}</p>
                      </div>
                    </div>
                  </div>
                )}

                {sec.checklist.length > 0 && (
                  <div className="p-5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2.5">
                    <span className="text-xs font-bold text-slate-900 block">
                      Practical Checklist Before Submitting
                    </span>
                    <ul className="space-y-2">
                      {sec.checklist.map((item, cIdx) => (
                        <li key={cIdx} className="flex items-start gap-2.5 text-xs text-slate-700 leading-relaxed">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* Editorial Review & Corrections Notice */}
          <footer className="pt-6 border-t border-slate-200 space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-600 leading-relaxed">
              <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0 mt-0.5" />
              <div>
                <strong className="text-slate-900 block mb-0.5">Editorial &amp; Accuracy Note</strong>
                Our handbooks are written by human editors based on live submission audits and player support tickets in East Africa. Spot an outdated carrier fee or rule? Email{' '}
                <a href="mailto:nigideon36@gmail.com" className="text-brand-700 underline font-medium">
                  nigideon36@gmail.com
                </a>{' '}
                for review.
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
              <span className="text-slate-500">
                Gideon Global Tasks · East Africa Contributor Guides
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('pay-per-view')}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-semibold transition-colors cursor-pointer"
                >
                  Open Pay-Per-View (Free)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className="px-4 py-2 bg-slate-900 text-white rounded-xl font-semibold hover:bg-slate-800 transition-colors cursor-pointer inline-flex items-center gap-1.5"
                >
                  <span>Browse Available Tasks</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
};
