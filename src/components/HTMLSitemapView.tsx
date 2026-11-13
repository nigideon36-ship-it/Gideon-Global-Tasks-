import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { Map, ArrowLeft, ExternalLink, Globe, BookOpen, ShieldCheck, HelpCircle, FileText } from 'lucide-react';

export const HTMLSitemapView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const { isOwner } = useAuth();

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
        <span className="text-slate-900 font-medium">HTML Sitemap</span>
      </nav>

      {/* Header with H1 */}
      <header className="space-y-4 pb-8 border-b border-slate-200">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-800 bg-brand-50 border border-brand-200 px-3 py-1 rounded-full">
          <Map className="w-3.5 h-3.5 text-brand-600" />
          <span>Full Site Index & Directory</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
          HTML Sitemap & Complete Navigation Directory
        </h1>
        <p className="text-xs md:text-sm text-slate-500">
          Comprehensive navigational directory of all public pages, task categories, educational guides, and legal policies on Gideon Global Tasks.
        </p>
      </header>

      {/* Grid of Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-xs">
        {/* Section 1: Main Platform Portals */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Globe className="w-4 h-4 text-brand-600" />
            <span>Platform Workspaces & Portals</span>
          </h2>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('tasks');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Tasks Marketplace (Live Opportunities)
              </a>
              <span className="text-slate-400 block text-[11px]">Primary crowdsourcing feed with filtering by category and reward.</span>
            </li>
            <li>
              <a
                href="/task-history"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('task-history');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Task History Ledger
              </a>
              <span className="text-slate-400 block text-[11px]">Verified records of completed tasks, audit scores, and transaction IDs.</span>
            </li>
            <li>
              <a
                href="/referrals"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('referrals');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Referral Partner Dashboard (Earn 20%)
              </a>
              <span className="text-slate-400 block text-[11px]">Affiliate tracking links and pass commission summaries.</span>
            </li>
            <li>
              <a
                href="/packages"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('packages');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Worker Passes ($2 Starter, $5 Pro, $10 VIP)
              </a>
              <span className="text-slate-400 block text-[11px]">Category gating tiers and allowance quotas.</span>
            </li>
            {isOwner && (
              <li>
                <a
                  href="/employer"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('employer');
                  }}
                  className="text-brand-600 hover:text-brand-700 font-medium underline"
                >
                  Owner &amp; Requester Portal
                </a>
                <span className="text-slate-400 block text-[11px]">Owner-only task publishing and site management.</span>
              </li>
            )}
          </ul>
        </div>

        {/* Section 2: Educational Knowledge Base */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Contributor Training Guides</span>
          </h2>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a
                href="/guides"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('guides');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Contributor Training Hub (All Articles)
              </a>
            </li>
            <li>
              <a
                href="/guides#ai-data-annotation-manual"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('guides');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                2026 Manual for AI Training Data & Bounding Boxes
              </a>
              <span className="text-slate-400 block text-[11px]">Detailed guide on autonomous vehicle perception and IoU bounding boxes.</span>
            </li>
            <li>
              <a
                href="/guides#consumer-surveys-guide"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('guides');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                How Global Consumer Surveys Power Billion-Dollar Product Strategy
              </a>
              <span className="text-slate-400 block text-[11px]">Qualitative survey techniques and screener question guidelines.</span>
            </li>
            <li>
              <a
                href="/guides#ocr-digitization-guide"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('guides');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Receipt & Invoice OCR Digitization (99.5%+ Precision)
              </a>
              <span className="text-slate-400 block text-[11px]">Keying receipt headers, line items, and sales tax numbers.</span>
            </li>
            <li>
              <a
                href="/guides#micropayments-rails-guide"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('guides');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Demystifying Remote Micropayments: M-PESA & Wise Rails
              </a>
              <span className="text-slate-400 block text-[11px]">How borderless STK pushes and Wise bank payouts operate.</span>
            </li>
          </ul>
        </div>

        {/* Section 3: Legal & Trust Policies */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-brand-600" />
            <span>Corporate Governance & Legal</span>
          </h2>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a
                href="/about"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('about');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                About Us & Corporate Governance
              </a>
              <span className="text-slate-400 block text-[11px]">Founding history, 4 operating pillars, and executive leadership.</span>
            </li>
            <li>
              <a
                href="/contact"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('contact');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Contact Us & Support Center
              </a>
              <span className="text-slate-400 block text-[11px]">Interactive inquiry form and direct email (nigideon36@gmail.com).</span>
            </li>
            <li>
              <a
                href="/privacy"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('privacy');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Privacy Policy & Cookie Disclosures
              </a>
              <span className="text-slate-400 block text-[11px]">Google AdSense, DART cookies, GDPR, CCPA, and DPO details.</span>
            </li>
            <li>
              <a
                href="/terms"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('terms');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Terms of Service & Rules
              </a>
              <span className="text-slate-400 block text-[11px]">Contributor agreements, quality rules, and $100 payout milestones.</span>
            </li>
            <li>
              <a
                href="/disclaimer"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('disclaimer');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Earnings & Advertising Disclaimer
              </a>
              <span className="text-slate-400 block text-[11px]">Financial representations, trademarks, and third-party ad notices.</span>
            </li>
            <li>
              <a
                href="/faq"
                onClick={(e) => {
                  e.preventDefault();
                  setActiveTab('faq');
                }}
                className="text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Frequently Asked Questions (FAQ)
              </a>
              <span className="text-slate-400 block text-[11px]">8 detailed answers regarding passes, withdrawals, and streaks.</span>
            </li>
          </ul>
        </div>

        {/* Section 4: Machine & Crawler Files */}
        <div className="p-6 bg-white rounded-2xl border border-slate-200 space-y-3 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            <span>Search Engine & Publisher Files</span>
          </h2>
          <ul className="space-y-2 text-slate-600">
            <li>
              <a href="/sitemap.xml" target="_blank" className="text-brand-600 hover:text-brand-700 font-medium underline flex items-center gap-1">
                <span>sitemap.xml</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <span className="text-slate-400 block text-[11px]">Standard XML sitemap protocol for Googlebot and search crawlers.</span>
            </li>
            <li>
              <a href="/robots.txt" target="_blank" className="text-brand-600 hover:text-brand-700 font-medium underline flex items-center gap-1">
                <span>robots.txt</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <span className="text-slate-400 block text-[11px]">Robots exclusion protocol allowing Googlebot and Mediapartners-Google.</span>
            </li>
            <li>
              <a href="/ads.txt" target="_blank" className="text-brand-600 hover:text-brand-700 font-medium underline flex items-center gap-1">
                <span>ads.txt</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <span className="text-slate-400 block text-[11px]">Authorized Digital Sellers file for Google AdSense inventory verification.</span>
            </li>
            <li>
              <a href="/google2d71976008fafb8e.html" target="_blank" className="text-brand-600 hover:text-brand-700 font-medium underline flex items-center gap-1">
                <span>Google Search Console Verification Token</span>
                <ExternalLink className="w-3 h-3 text-slate-400" />
              </a>
              <span className="text-slate-400 block text-[11px]">Ownership verification token (google2d71976008fafb8e.html).</span>
            </li>
          </ul>
        </div>
      </div>

      {/* Return to Marketplace Footer */}
      <div className="pt-8 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
        <button
          onClick={() => setActiveTab('tasks')}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Tasks Marketplace</span>
        </button>
        <p className="text-xs text-slate-400">
          Domain: https://gideon-global-tasks.ai.studio · Updated November 2026
        </p>
      </div>
    </article>
  );
};
