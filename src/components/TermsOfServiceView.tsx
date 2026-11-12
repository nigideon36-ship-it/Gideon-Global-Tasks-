import React from 'react';
import { useTasks } from '../context/TaskContext';
import { FileText, ShieldAlert, ArrowLeft, CheckCircle2, DollarSign } from 'lucide-react';

export const TermsOfServiceView: React.FC = () => {
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
          Effective Date: November 11, 2026 · Governing Entity: Gideon Global Tasks Inc.
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
        <h2 className="text-xl font-bold text-slate-900">2. Contributor Worker Passes & Service Fees</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          To maintain high data integrity, deter automated malicious scripts, and finance dedicated server compute, contributors activate an authorized worker pass:
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <h3 className="font-bold text-slate-900">Starter Pass ($2.00)</h3>
            <p className="text-slate-500 text-[11px]">Grants up to 25 tasks daily across consumer market surveys and micro tasks.</p>
          </div>
          <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-1.5 text-xs">
            <h3 className="font-bold text-emerald-950">Pro Pass ($5.00)</h3>
            <p className="text-emerald-900 text-[11px]">Unlocks 75 tasks daily, autonomous AI computer vision annotation, receipt OCR, and meme studio bounties.</p>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
            <h3 className="font-bold text-slate-900">VIP Pass ($10.00)</h3>
            <p className="text-slate-500 text-[11px]">Unlimited daily tasks, technical copywriting, priority queue, and 0% withdrawal transaction fees.</p>
          </div>
        </div>
      </section>

      {/* Section 3 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">3. Quality Audits, Accuracy Standards & Zero-Bot Policy</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Enterprise clients rely on ground-truth datasets produced through Gideon Global Tasks. As such:
        </p>
        <ul className="list-disc pl-5 text-xs md:text-sm text-slate-600 space-y-1.5">
          <li><strong>Automated & Peer Review:</strong> Task submissions undergo automated validation algorithms and human consensus audits.</li>
          <li><strong>Minimum Accuracy Score:</strong> Contributors must maintain an average accuracy score of at least 85% to retain active pass privileges.</li>
          <li><strong>Zero-Bot Policy:</strong> The use of headless browser scrapers, macro scripts, artificial intelligence answer generation for human-subject surveys, or multi-accounting is strictly prohibited and results in immediate account forfeiture without refund.</li>
        </ul>
      </section>

      {/* Section 4 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">4. Withdrawal Thresholds, Milestones & Disbursement Rails</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          All financial disbursements adhere to transparent milestone economics:
        </p>
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs text-slate-700">
          <p className="font-semibold text-slate-900 flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <span>Minimum Payout Milestone: $100.00 USD</span>
          </p>
          <p className="text-slate-600 leading-relaxed">
            Due to fixed banking routing surcharges on cross-border financial transactions, withdrawals unlock once your approved wallet balance reaches <strong>$100.00 USD</strong>.
          </p>
          <p className="text-slate-600 leading-relaxed">
            Disbursements are processed within 24–48 hours via <strong>M-PESA</strong> (direct STK mobile money to verified East African phone numbers) and <strong>Wise</strong> (international bank rails covering 80+ currencies).
          </p>
        </div>
      </section>

      {/* Section 5 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">5. 20% Referral Commission Program</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Contributors receive a dedicated affiliate tracking link. When a new user creates an account via your link and purchases a worker pass, you receive a guaranteed 20% commission ($0.40 on Starter, $1.00 on Pro, $2.00 on VIP) credited directly to your withdrawable wallet balance.
        </p>
      </section>

      {/* Section 6 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">6. Intellectual Property & Contributor Work Product</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Upon successful task completion and reward credit, contributors transfer all ownership, copyright, and intellectual property rights in the submitted work product (e.g., bounding boxes, text keying, copywriting) to the requester.
        </p>
      </section>

      {/* Section 7 */}
      <section className="space-y-3">
        <h2 className="text-xl font-bold text-slate-900">7. Independent Contractor Relationship</h2>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Contributors perform tasks as independent contractors and not as employees, agents, or partners of Gideon Global Tasks Inc. Contributors are solely responsible for all local income taxes, withholdings, and reporting applicable in their jurisdiction.
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
