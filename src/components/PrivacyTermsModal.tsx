import React from 'react';
import { X, ShieldCheck, FileText, CheckCircle2 } from 'lucide-react';

interface PrivacyTermsModalProps {
  isOpen: boolean;
  initialTab?: 'privacy' | 'terms';
  onClose: () => void;
}

export const PrivacyTermsModal: React.FC<PrivacyTermsModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose
}) => {
  const [tab, setTab] = React.useState<'privacy' | 'terms'>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-3xl max-h-[85vh] flex flex-col bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Legal & Compliance Documentation</h2>
              <p className="text-xs text-slate-500">Google AdSense and Search Console Verified Policies</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-4">
          <button
            onClick={() => setTab('privacy')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'privacy'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Privacy Policy (AdSense Compliant)
          </button>
          <button
            onClick={() => setTab('terms')}
            className={`py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
              tab === 'terms'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Terms of Service & Contributor Rules
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 text-xs text-slate-600 space-y-4 leading-relaxed">
          {tab === 'privacy' ? (
            <>
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-emerald-900">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-[11px]">
                  <strong>AdSense Policy Notice:</strong> This privacy policy strictly satisfies Google AdSense Program Policies, including disclosure of Google cookies, third-party vendor tracking, and personalized advertising opt-outs.
                </p>
              </div>

              <h3 className="text-sm font-bold text-slate-900">1. Information We Collect</h3>
              <p>
                Gideon Global Tasks collects information you provide directly to us when creating an account, authenticating via Google OAuth, purchasing contributor passes ($2, $5, $10), completing tasks, and requesting withdrawals via M-PESA or Wise. This includes your name, email address, transaction identifiers, and task responses.
              </p>

              <h3 className="text-sm font-bold text-slate-900">2. Google AdSense & Third-Party Cookies</h3>
              <p>
                Third-party vendors, including Google, use cookies to serve ads based on a user's prior visits to this website or other websites. Google's use of advertising cookies enables it and its partners to serve ads to users based on their visit to our site and/or other sites on the Internet.
              </p>
              <p>
                Users may opt out of personalized advertising by visiting <a href="https://adssettings.google.com" target="_blank" rel="noreferrer" className="text-brand-600 underline">Google Ads Settings</a>. Alternatively, you can opt out of a third-party vendor's use of cookies for personalized advertising by visiting <a href="https://www.aboutads.info" target="_blank" rel="noreferrer" className="text-brand-600 underline">aboutads.info</a>.
              </p>

              <h3 className="text-sm font-bold text-slate-900">3. GDPR & CCPA Compliance Rights</h3>
              <p>
                In compliance with the General Data Protection Regulation (GDPR) and California Consumer Privacy Act (CCPA), you have the right to request access to your personal data, request the correction or complete erasure of your account records, or opt out of the sale or sharing of your personal information. We do not sell your personal data to third parties.
              </p>

              <h3 className="text-sm font-bold text-slate-900">4. Data Storage & Security</h3>
              <p>
                User accounts, task completions, and referral records are persistently secured using Cloud SQL PostgreSQL and Firebase Authentication. We enforce 256-bit SSL encryption on all API endpoints and database queries.
              </p>

              <h3 className="text-sm font-bold text-slate-900">5. Contact Information & Data Protection Officer</h3>
              <p>
                For privacy inquiries or account data deletion requests, contact our Data Protection Officer at <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">nigideon36@gmail.com</code>.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-bold text-slate-900">1. Contributor Eligibility & Worker Passes</h3>
              <p>
                Gideon Global Tasks provides a crowdsourced platform for verified surveys, AI computer vision annotation, retail receipt extraction, copywriting, and micro tasks. Users unlock task categories by activating a Starter ($2), Pro ($5), or VIP ($10) worker pass via M-PESA, Card, or Wallet balance.
              </p>

              <h3 className="text-sm font-bold text-slate-900">2. Task Approval & Quality Standards</h3>
              <p>
                All completed tasks undergo automated and human quality audits. Contributors maintain a quality score (target 95%+). Honest completion is required; automated bots or fraudulent submissions will result in immediate pass revocation.
              </p>

              <h3 className="text-sm font-bold text-slate-900">3. Payout Thresholds & Methods</h3>
              <p>
                Withdrawals start from a minimum threshold of <strong>$100.00 USD</strong> to maintain high liquidity and reduce transaction fees. Payouts are disbursed to verified M-PESA phone lines and Wise accounts.
              </p>

              <h3 className="text-sm font-bold text-slate-900">4. Referral Program</h3>
              <p>
                Users earn a guaranteed 20% commission on any worker pass purchased by people joining through their unique referral link. Commissions are credited immediately upon payment confirmation.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50 text-xs">
          <span className="text-slate-400">Effective Date: November 2026</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Acknowledge & Close
          </button>
        </div>
      </div>
    </div>
  );
};
