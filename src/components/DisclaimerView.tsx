import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromUsd, WITHDRAWAL_THRESHOLD_USD } from '../lib/eastAfrica';
import { AlertTriangle, ArrowLeft, ExternalLink } from 'lucide-react';

export const DisclaimerView: React.FC = () => {
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
        <span className="text-slate-900 font-medium">Disclaimer</span>
      </nav>

      {/* Header with H1 */}
      <header className="space-y-4 pb-8 border-b border-slate-200">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
          <span>Earnings & Legal Disclosures</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
          Earnings Disclaimer, Advertising Notice & Legal Disclosures
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          Last Updated: November 11, 2026 · Official Domain: <strong className="text-slate-700">https://gideon-global-tasks.ai.studio/</strong>
        </p>
      </header>

      {/* Earnings Disclaimer */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">1. Earnings &amp; Income Representation Disclaimer</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks provides a structured daily micro-work marketplace where 1 vetted task is dropped per day at 08:00 AM EAT with zero Worker Pass fees. Task rewards vary depending on the specific task type and the budget set by the sponsoring merchant. Any reward examples cited across the site do not represent a guaranteed fixed salary.
        </p>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Your individual earnings depend on catching the 8:00 AM EAT daily task drop on time, merchant bounty availability, your accuracy audit scores, and geographic eligibility.
        </p>
      </section>

      {/* Payout Rail Disclosures */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. PayPal-Only Withdrawals, Strict KYC &amp; Auction Escrow</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Withdrawals begin once a contributor reaches the approved balance threshold of <strong>{formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</strong> (150 Shillings equivalent) and passes strict KYC verification (front and back photos of their National ID). All deposits and payouts operate exclusively through <strong>PayPal</strong>. Real-product auction participants must maintain a mandatory 50% PayPal escrow deposit to cover dispute compensation between buyer and seller.
        </p>
      </section>

      {/* Third-Party Advertising & AdSense Disclaimer */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. Third-Party Advertising & Google AdSense Disclaimer</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          This website displays advertisements and sponsored notices delivered via Google AdSense, Monetag, and authorized ad exchanges. The appearance of any advertisement on Gideon Global Tasks does not constitute an endorsement, guarantee, warranty, or recommendation by Gideon Global Tasks of the products, services, claims, or companies advertised.
        </p>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          We encourage visitors to exercise due diligence before engaging with any third-party advertised offer. For details regarding how advertising cookies are utilized or to opt out of interest-based ads, please visit our{' '}
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('privacy');
            }}
            className="text-brand-600 font-semibold underline"
          >
            Privacy Policy
          </a>{' '}
          and{' '}
          <a
            href="https://adssettings.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 font-semibold underline inline-flex items-center gap-1"
          >
            Google Ads Settings
            <ExternalLink className="w-3 h-3" />
          </a>.
        </p>
      </section>

      {/* Trademark Notice */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Trademark &amp; Brand Attribution Notice</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Google and Google AdSense are trademarks of Google LLC. PayPal is a trademark of PayPal Holdings, Inc. All product and company names are used strictly for identification. User-uploaded photos and short videos in the Pay-Per-View Status Feed remain the responsibility of their respective uploaders and are hosted exclusively within the platform.
        </p>
      </section>

      {/* Contact Details */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. Questions & Legal Inquiries</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          If you have questions regarding this Disclaimer or our platform policies, please contact our support team at <a href="mailto:nigideon36@gmail.com" className="text-brand-600 font-semibold underline">nigideon36@gmail.com</a>.
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
            href="/terms"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('terms');
            }}
            className="hover:text-slate-900 underline"
          >
            Terms of Service
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
