import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { Globe, ShieldCheck, Mail, BookOpen, HelpCircle, CheckCircle2, ArrowRight, FileText, Cookie } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setActiveTab, setWalletOpen, setPublisherModalOpen, openPrivacyTerms } = useTasks();
  const { isOwner } = useAuth();

  return (
    <footer className="mt-20 border-t border-blue-400/40 bg-blue-900 text-blue-100 py-12 text-xs">
      <div className="max-w-7xl mx-auto px-6">
        {/* Main 4-Column Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 pb-10 border-b border-blue-700/70">
          {/* Column 1: Brand & Operational Mission */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 font-bold text-white text-sm">
              <img
                src="/images/gideon-logo.svg"
                alt="Gideon Global Tasks official verified emblem and platform logo"
                className="w-6 h-6 rounded-md shadow-2xs"
                width="24"
                height="24"
              />
              <span>Gideon Global Tasks</span>
            </div>
            <p className="text-blue-100/90 text-xs leading-relaxed">
              East Africa exclusive crowdsourcing and artificial intelligence data annotation platform across Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia.
            </p>
            <div className="space-y-1.5 pt-1 text-[11px] text-blue-100">
              <div className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-sky-300 shrink-0" />
                <a href="mailto:nigideon36@gmail.com" className="hover:text-white font-mono">
                  nigideon36@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300 shrink-0" />
                <span>East Africa Exclusive · M-PESA &amp; Mobile Money Active</span>
              </div>
            </div>

            {/* Social Trust Links */}
            <div className="pt-2 flex items-center gap-3 text-blue-200">
              <a
                href="https://twitter.com/gideonglobal"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="X / Twitter"
                className="hover:text-white transition-colors"
                title="Follow Gideon Global on X"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
              </a>
              <a
                href="https://github.com/nigideon36-ship-it/gideonglobaltask"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="GitHub"
                className="hover:text-white transition-colors"
                title="GitHub Open Source Tools"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                </svg>
              </a>
              <a
                href="https://linkedin.com/company/gideon-global-tasks"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="LinkedIn"
                className="hover:text-white transition-colors"
                title="LinkedIn Enterprise Profile"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.49 1.49 0 1 0-.01-2.98 1.49 1.49 0 0 0 .01 2.98M5.07 18.5h2.79v-8.37H5.07v8.37z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Column 2: Platform Workspaces & Passes */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Platform & Workspaces
            </h4>
            <ul className="space-y-2 text-blue-100">
              <li>
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('tasks');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Tasks Marketplace
                </a>
              </li>
              <li>
                <a
                  href="/packages"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('packages');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Worker Passes (KES 50, 100, 200)
                </a>
              </li>
              <li>
                <a
                  href="/referrals"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('referrals');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Referral Partner Program (Earn 20%)
                </a>
              </li>
              <li>
                <a
                  href="/task-history"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('task-history');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Task History Ledger
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="hover:text-white transition-colors cursor-pointer text-left"
                >
                  Wallet & Cash Out ($20 Min)
                </button>
              </li>
              {isOwner && (
                <li>
                  <a
                    href="/employer"
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveTab('employer');
                    }}
                    className="hover:text-white transition-colors"
                  >
                    Owner &amp; Requester Portal
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Column 3: Knowledge Base & Editorial Guides */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Guides & Education
            </h4>
            <ul className="space-y-2 text-blue-100">
              <li>
                <a
                  href="/guides"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('guides');
                  }}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <BookOpen className="w-3 h-3 text-sky-300" />
                  <span>Contributor Training Guides</span>
                </a>
              </li>
              <li>
                <a
                  href="/guides#ai-data-annotation-manual"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('guides');
                  }}
                  className="hover:text-white transition-colors"
                >
                  AI Computer Vision Manual (2026)
                </a>
              </li>
              <li>
                <a
                  href="/guides#consumer-surveys-guide"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('guides');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Market Research & Surveys
                </a>
              </li>
              <li>
                <a
                  href="/guides#ocr-digitization-guide"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('guides');
                  }}
                  className="hover:text-white transition-colors"
                >
                  Receipt & Invoice OCR Guide
                </a>
              </li>
              <li>
                <a
                  href="/faq"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('faq');
                  }}
                  className="hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <HelpCircle className="w-3 h-3 text-sky-300" />
                  <span>Platform FAQ & Answers</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Column 4: Mandatory Compliance & Corporate Governance */}
          <div className="space-y-3">
            <h4 className="font-bold text-white text-xs uppercase tracking-wider">
              Company & Compliance
            </h4>
            <ul className="space-y-2 text-blue-100">
              <li>
                <a
                  href="/about"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('about');
                  }}
                  className="hover:text-white font-medium transition-colors"
                >
                  About Us & Governance
                </a>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('contact');
                  }}
                  className="hover:text-white font-medium transition-colors"
                >
                  Contact Support Desk
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('privacy');
                  }}
                  className="hover:text-white font-medium transition-colors"
                >
                  Privacy Policy (AdSense & GDPR)
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('terms');
                  }}
                  className="hover:text-white font-medium transition-colors"
                >
                  Terms of Service & Rules
                </a>
              </li>
              <li>
                <a
                  href="/disclaimer"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('disclaimer');
                  }}
                  className="hover:text-white font-medium transition-colors"
                >
                  Earnings & Legal Disclaimer
                </a>
              </li>
              <li>
                <a
                  href="/sitemap"
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab('sitemap');
                  }}
                  className="hover:text-white font-medium transition-colors flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  <span>HTML Sitemap Directory</span>
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => {
                    try {
                      localStorage.removeItem('gideon_cookie_consent');
                      window.location.reload();
                    } catch {}
                  }}
                  className="text-blue-200 hover:text-white transition-colors flex items-center gap-1 text-[11px] cursor-pointer"
                >
                  <Cookie className="w-3 h-3" />
                  <span>Reset Cookie Preferences</span>
                </button>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Verified Files */}
        <div className="pt-6 flex flex-col md:flex-row items-center justify-between gap-4 text-[11px] text-blue-200">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
            <span>© {new Date().getFullYear()} Gideon Global Tasks Inc. All rights reserved.</span>
            <span aria-hidden="true" className="text-blue-400">·</span>
            <a href="/google2d71976008fafb8e.html" target="_blank" className="hover:text-white underline">Search Console Verification</a>
            <span aria-hidden="true" className="text-blue-400">·</span>
            <a href="/ads.txt" target="_blank" className="hover:text-white underline">ads.txt</a>
            <span aria-hidden="true" className="text-blue-400">·</span>
            <a href="/sitemap.xml" target="_blank" className="hover:text-white underline">sitemap.xml</a>
            <span aria-hidden="true" className="text-blue-400">·</span>
            <a href="/robots.txt" target="_blank" className="hover:text-white underline">robots.txt</a>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-white font-medium">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
              <span>256-Bit Escrow Security</span>
            </span>
            <span aria-hidden="true" className="text-blue-400">·</span>
            <span className="text-blue-200 font-mono">Domain: gideon-global-tasks.ai.studio</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
