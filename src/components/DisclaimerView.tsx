import React from 'react';
import { useTasks } from '../context/TaskContext';
import { AlertTriangle, ArrowLeft, ShieldCheck, ExternalLink, HelpCircle } from 'lucide-react';

export const DisclaimerView: React.FC = () => {
  const { setActiveTab } = useTasks();

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
        <h2 className="text-xl font-bold text-slate-900">1. Earnings & Income Representation Disclaimer</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks provides an open crowdsourcing and multimodal data annotation marketplace. Any earnings examples, reward estimates ($1.20–$15.00+ per task), or daily bonus projections cited across the website or contributor guides are illustrative of what high-accuracy, diligent contributors can potentially generate and do not represent a guarantee of earnings.
        </p>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Your individual earnings depend on factors including the volume of available task bounties from enterprise requesters, your accuracy audit scores, task completion speed, worker pass category access, and geographic eligibility. Gideon Global Tasks does not represent itself as a "get-rich-quick" scheme, permanent full-time employment, or passive financial investment.
        </p>
      </section>

      {/* Payout Rail Disclosures */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">2. Withdrawal Milestones & Currency Processing</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Withdrawals are unlocked once a contributor reaches the approved balance threshold of <strong>$100.00 USD</strong>. While Gideon Global Tasks does not charge platform cash-out fees on approved $100+ withdrawals, foreign exchange conversion rates applied by intermediary telecommunications operators (e.g., Safaricom M-PESA) or international banking partners (e.g., Wise) are determined by market rates at the time of transfer.
        </p>
      </section>

      {/* Third-Party Advertising & AdSense Disclaimer */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. Third-Party Advertising & Google AdSense Disclaimer</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          This website displays advertisements delivered via Google AdSense and third-party advertising exchanges. The appearance of advertisements on Gideon Global Tasks does not constitute an endorsement, guarantee, warranty, or recommendation by Gideon Global Tasks of the products, services, claims, or companies advertised.
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
        <h2 className="text-xl font-bold text-slate-900">4. Trademark & Brand Attribution Notice</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Google, Google AdSense, and Google Search Console are trademarks of Google LLC. M-PESA is a registered trademark of Safaricom PLC and Vodafone Group. Wise is a trademark of Wise Payments Limited. All company, product, and service names used on this website are for identification purposes only. Use of these names, logos, and brands does not imply endorsement or affiliation.
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
