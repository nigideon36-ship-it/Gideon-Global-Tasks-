import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import {
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';
import { ShieldCheck, Award, Users } from 'lucide-react';

export const PlatformOverviewLanding: React.FC = () => {
  const { setActiveTab } = useTasks();
  const { selectedCountry } = useRegion();

  return (
    <section className="space-y-12 py-8 border-t border-blue-400/40 mt-12 text-white">
      {/* Editorial Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="text-xs font-semibold text-blue-200">
            How Gideon Global Tasks Works
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight text-balance">
            Practical Micro-Work, Local Auctions &amp; Free Pay-Per-View Statuses Across East Africa.
          </h2>
          <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
            Built for contributors, buyers, and everyday creators across Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia.
          </p>
          <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
            Catch the single daily vetted task dropped at <strong className="text-white">8:00 AM EAT</strong> (merchant-set rewards, 100% free access), trade real physical goods in <strong className="text-white">50% PayPal Escrow Auctions</strong>, or upload free Pay-Per-View statuses ({formatCurrencyFromKes(5, selectedCountry)}/view). Withdrawals start at <strong className="text-white">{formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</strong> via <strong className="text-white">PayPal only</strong> after Front &amp; Back National ID KYC approval.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('guides')}
              className="text-xs font-bold text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
            >
              Read Contributor Handbooks →
            </button>
            <span className="text-blue-300">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('pay-per-view')}
              className="text-xs font-bold text-amber-200 hover:text-amber-100 underline cursor-pointer"
            >
              Pay-Per-View (Free · 5 KSh/View) →
            </button>
            <span className="text-blue-300">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('auctions')}
              className="text-xs font-semibold text-white hover:text-blue-200 underline cursor-pointer"
            >
              Product Auctions →
            </button>
            <span className="text-blue-300">·</span>
            <button
              type="button"
              onClick={() => setActiveTab('about')}
              className="text-xs font-semibold text-white hover:text-blue-200 underline cursor-pointer"
            >
              Editorial Policy &amp; About →
            </button>
          </div>
        </div>

        {/* 4-Step Mechanism Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-xs font-mono">
              01
            </div>
            <h3 className="font-bold text-sm text-slate-900">Pick Tasks That Match Your Attention</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Choose between consumer surveys, street-scene image labeling, thermal receipt verification, short writing briefs, or social creator tasks.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs font-mono">
              02
            </div>
            <h3 className="font-bold text-sm text-slate-900">1 Task Daily at 8:00 AM EAT</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Every member gets 100% free access with zero Worker Pass fees. Keep time for 8:00 AM EAT when today&apos;s single task drops—each reward is set by the merchant based on task scope.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-xs font-mono">
              03
            </div>
            <h3 className="font-bold text-sm text-slate-900">50% Escrow-Protected Auctions</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Both buyers and sellers place a 50% product security deposit via PayPal before bidding or listing real goods, guaranteeing fair compensation if any issue arises.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-bold flex items-center justify-center text-xs font-mono">
              04
            </div>
            <h3 className="font-bold text-sm text-slate-900">PayPal Cash-Out From {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Upload your Front &amp; Back National ID for KYC verification and cash out from {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} strictly via PayPal.
            </p>
          </div>
        </div>
      </div>

      {/* Platform Standards & Real Commitments */}
      <div className="p-8 bg-white/95 rounded-3xl border border-blue-200/70 shadow-sm space-y-6 text-slate-900">
        <div className="max-w-2xl space-y-1">
          <h3 className="text-lg font-bold text-slate-900">Review Standards &amp; Member Protections</h3>
          <p className="text-xs text-slate-600">
            Plain rules covering task verification, local auction listings, and 24-hour Pay-Per-View status payouts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Protected Task Wallet</span>
            </h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Task earnings remain in your withdrawable balance. Optional passes and investment pools are funded only through separate mobile money or card deposits.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-brand-600" />
              <span>Human Quality &amp; Fraud Review</span>
            </h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Submissions pass speed checks, attention verifications, and moderator spot audits—keeping survey answers and receipt numbers useful and honest.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span>20% Referral Partner Share</span>
            </h4>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Share your invite link to earn a 20% partner commission on qualified referred contributor activity and verified PayPal checkouts.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded FAQ Teaser */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Common Questions Before Starting</h3>
            <p className="text-xs text-blue-100">Straight answers on 8:00 AM EAT drops, PayPal KYC cash-outs, and 50% auction escrow.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('faq')}
            className="text-xs font-semibold text-white hover:text-blue-200 underline cursor-pointer"
          >
            Read full FAQ →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">Why are withdrawals verified with National ID KYC from {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}?</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Strict KYC verification (uploading both front and back photos of your National ID) protects PayPal cash-outs from {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} against impersonation and ensures one authentic payout per contributor.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">When do tasks drop and how are rewards determined?</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              There are zero Worker Passes required. Exactly 1 task drops daily at 08:00 AM EAT, and its reward varies depending on the task complexity and merchant budget.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">Which payment method is used?</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              PayPal is the sole supported gateway for international checkouts, 50% auction escrow deposits, investment pools, and verified contributor withdrawals.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-none space-y-2">
            <h4 className="font-bold text-slate-900">How does Free Pay-Per-View Status earning work?</h4>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              Posting funny videos, funny photos, or personal clips inside the platform is 100% free. Each unique registered member who views your status adds {formatCurrencyFromKes(5, selectedCountry)}, settled automatically after 24 hours.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
