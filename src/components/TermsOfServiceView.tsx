import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromKes, formatCurrencyFromUsd, WITHDRAWAL_THRESHOLD_USD } from '../lib/eastAfrica';
import { FileText, ArrowLeft, Wallet } from 'lucide-react';

export const TermsOfServiceView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const { selectedCountry } = useRegion();

  return (
    <article className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-200 text-slate-800">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-500">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('tasks');
          }}
          className="hover:text-slate-900 transition-colors"
        >
          Home
        </a>
        <span>/</span>
        <span className="text-slate-900 font-medium">Terms of Service</span>
      </nav>

      {/* Header with H1 */}
      <header className="space-y-4 pb-8 border-b border-slate-200">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
          <FileText className="w-3.5 h-3.5 text-slate-600" />
          <span>Contributor Agreement & Platform Rules</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
          Terms of Service & Contributor Operating Rules
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          Effective Date: November 18, 2026 · Operated by Gideon Global Tasks (Kenya &amp; East Africa)
        </p>
      </header>

      {/* Section 1 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. Acceptance of Terms & Contributor Eligibility</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          By accessing or utilizing Gideon Global Tasks (the "Platform" or "Service"), you agree to be bound by these Terms of Service. To participate as a contributor or requester, you must be at least 18 years of age and legally authorized to enter into binding agreements in your jurisdiction.
        </p>
      </section>

      {/* Section 2 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. Daily 8:00 AM EAT Single-Task Drop &amp; Merchant Rewards</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks provides 100% free contributor access with no Worker Pass subscriptions or tier fees:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <h3 className="font-bold text-slate-900">1 Task Daily at 08:00 AM EAT</h3>
            <p className="text-slate-500 text-[11px]">Only one vetted task is dropped per day at exactly 8:00 AM East Africa Time. Contributors must keep time to participate in the daily drop.</p>
          </div>
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1.5 text-xs">
            <h3 className="font-bold text-emerald-950">Merchant-Set Task Rewards</h3>
            <p className="text-emerald-900 text-[11px]">There is no fixed ceiling—task payouts depend directly on which task is dropped and the reward funded by the client/merchant.</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <h3 className="font-bold text-slate-900">Zero Worker Pass Required</h3>
            <p className="text-slate-500 text-[11px]">Every verified account accesses the daily drop, Free Pay-Per-View statuses, and Escrow Auctions without pass payments.</p>
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. Quality Audits, Accuracy Standards &amp; Zero-Bot Policy</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Enterprise clients rely on ground-truth datasets produced through Gideon Global Tasks. As such:
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li><strong>Automated &amp; Peer Review:</strong> Task submissions undergo automated validation algorithms and human consensus audits.</li>
          <li><strong>Minimum Accuracy Score:</strong> Contributors must maintain accurate, genuine submissions and an average quality rating of at least 85%.</li>
          <li><strong>Zero-Bot Policy:</strong> The use of headless browser scrapers, macro scripts, automated form-fillers, or multi-accounting is strictly prohibited and results in permanent account ban without payout.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. KSh 150 Withdrawal Threshold, Strict KYC &amp; PayPal-Only Rails</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          All financial disbursements adhere to transparent identity protection rules:
        </p>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <span>Minimum Payout Milestone: {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} (150 Shillings eq.)</span>
          </p>
          <p className="text-slate-600 leading-relaxed">
            Withdrawals start once your approved wallet balance reaches <strong>{formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</strong> AND your identity passes strict KYC verification (uploading both <strong>Front &amp; Back photos</strong> of your country&apos;s National ID, e.g., Kenyan Kitambulisho, Uganda NIRA, Tanzania NIDA, Rwanda Indangamuntu).
          </p>
          <p className="text-slate-600 leading-relaxed">
            PayPal is the sole supported payment and withdrawal gateway. Disbursements are sent directly to your verified PayPal email address upon Owner review.
          </p>
        </div>
      </section>

      {/* Section 5 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. 20% Referral Commission Program</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Contributors receive a dedicated affiliate tracking link. When referred users join and complete qualified PayPal checkouts or activity, your 20% partner commission is credited directly to your withdrawable wallet balance.
        </p>
      </section>

      {/* Section 6 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. Intellectual Property &amp; Contributor Work Product</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Upon successful task completion and reward credit, contributors transfer all ownership, copyright, and intellectual property rights in the submitted work product (e.g., bounding boxes, text keying, copywriting) to the requester.
        </p>
      </section>

      {/* Section 7 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. 50% Escrow-Protected Auctions &amp; Free Pay-Per-View Status Feed</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          In Customer Product Auctions, real physical products require a <strong>mandatory 50% of the product amount paid as an escrow security deposit via PayPal first</strong> by sellers and buyers/bidders so any dispute on real items can be compensated fairly between the buyer and seller. In the free Pay-Per-View Status Feed, contributors upload original funny photos, videos, or personal media with zero upload fee; verified views from registered members earn {formatCurrencyFromKes(5, selectedCountry)} per viewer and settle automatically after 24 hours.
        </p>
      </section>

      {/* Section 8 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">8. Contact & Legal Notices</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Questions or disputes regarding these Terms of Service should be directed to our legal department at <a href="mailto:nigideon36@gmail.com" className="text-brand-600 font-semibold underline">nigideon36@gmail.com</a>.
        </p>
      </section>

      {/* Footer Navigation */}
      <div className="pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => setActiveTab('tasks')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Tasks Marketplace</span>
        </button>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('privacy');
            }}
            className="hover:text-slate-900 underline"
          >
            Privacy Policy
          </a>
          <span>·</span>
          <a
            href="/disclaimer"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('disclaimer');
            }}
            className="hover:text-slate-900 underline"
          >
            Disclaimer
          </a>
          <span>·</span>
          <a
            href="/sitemap"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('sitemap');
            }}
            className="hover:text-slate-900 underline"
          >
            HTML Sitemap
          </a>
        </div>
      </div>
    </article>
  );
};
