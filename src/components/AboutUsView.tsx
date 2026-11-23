import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromKes, formatCurrencyFromUsd, WITHDRAWAL_THRESHOLD_USD } from '../lib/eastAfrica';
import { ShieldCheck, Users, Award, CheckCircle2, ArrowRight, Mail, Lock } from 'lucide-react';

export const AboutUsView: React.FC = () => {
  const { setActiveTab } = useTasks();
  const { selectedCountry } = useRegion();

  return (
    <div className="space-y-12 animate-in fade-in duration-200">
      {/* Editorial Hero Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-8 md:p-12 shadow-lg border border-slate-800">
        <div className="max-w-3xl space-y-4">
          <div className="text-xs font-medium text-emerald-400">
            About Gideon Global Tasks · Founded in Kenya for East Africa
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight text-balance">
            Built for Practical Digital Work, Local Auctions &amp; Free Pay-Per-View Statuses in East Africa.
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Gideon Global Tasks was built to provide reliable digital work and trusted peer commerce across Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia—with free contributor access, PayPal-only cash-outs from {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} under strict Front &amp; Back National ID KYC, and 50% PayPal escrow protection on live auctions.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab('guides')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer inline-flex items-center gap-2"
            >
              <span>Read Our Contributor Handbooks</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-colors border border-white/20 cursor-pointer inline-flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Gideon &amp; Support</span>
            </button>
          </div>
        </div>
      </div>

      {/* The Story & Practical Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            Focused Across Eight East African Nations on One Trusted PayPal Rail
          </h2>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            Every morning at exactly 08:00 AM EAT, we drop 1 carefully vetted task with rewards determined by the sponsoring merchant and task scope—free for every contributor with zero Worker Passes.
          </p>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            Whether you are verifying a receipt, completing a research survey, listing a real product in our 50% PayPal Escrow Auctions, or posting free funny photos and videos in our Pay-Per-View Status Feed ({formatCurrencyFromKes(5, selectedCountry)}/view settled after 24 hours), all payouts settle exclusively via <strong>PayPal</strong> starting from <strong>{formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</strong> once both Front and Back National ID KYC are approved.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-2xl font-bold text-brand-600 font-mono tabular-nums">8 Nations</span>
              <p className="text-xs font-semibold text-slate-900 mt-1">Regional Access</p>
              <p className="text-[11px] text-slate-500">KE, UG, TZ, RW, BI, SS, ET &amp; SO.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-2xl font-bold text-emerald-600 font-mono tabular-nums">
                {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}
              </span>
              <p className="text-xs font-semibold text-slate-900 mt-1">PayPal Cash-Out Floor</p>
              <p className="text-[11px] text-slate-500">PayPal-only · Front/Back ID KYC required.</p>
            </div>
          </div>
        </div>

        {/* Values Bento */}
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Separated Wallets &amp; Honest Expectations</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Your earned task wallet is never auto-debited for Investment Pools or Auction Escrow deposits. Micro-tasks provide supplemental side income—rewards depend on each daily 08:00 AM EAT task and merchant budget.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">50% Escrow Auctions &amp; Free Pay-Per-View</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Product auctions require a 50% PayPal security escrow deposit first from sellers and buyers so any dispute on real items can be compensated fairly. Pay-Per-View statuses remain 100% free and pay {formatCurrencyFromKes(5, selectedCountry)}/view after 24 hours.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">20% Direct Referral Share</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Members earn a transparent 20% referral commission tracked directly in their contributor ledger whenever invited members complete qualifying platform activity.
            </p>
          </div>
        </div>
      </div>

      {/* Founder & Editorial Standards */}
      <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs font-semibold text-emerald-700">
              Founder &amp; Editorial Accountability
            </div>
            <h2 className="text-xl font-bold text-slate-900">Founded &amp; Managed by Gideon N.</h2>
          </div>
          <a
            href="mailto:nigideon36@gmail.com"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline font-mono"
          >
            nigideon36@gmail.com
          </a>
        </div>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed max-w-3xl">
          Gideon Global Tasks is independently built and operated from Kenya by <strong>Gideon N.</strong> Support tickets, withdrawal verifications, auction moderation, and editorial guides are reviewed directly in-house so contributors can reach a real operator by email, phone (<a href="tel:+254712727558" className="text-slate-900 font-mono underline">+254712727558</a>), or WhatsApp (<a href="https://wa.me/254785909543" target="_blank" rel="noopener noreferrer" className="text-slate-900 font-mono underline">0785909543</a>).
        </p>

        {/* Publisher & Editorial Standards */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <p className="text-xs font-semibold text-slate-800">
            Editorial Standards, Privacy &amp; Reference Policies:
          </p>
          <p className="text-xs text-slate-600 leading-relaxed max-w-3xl">
            Our educational handbooks are drafted and periodically updated from real quality audits and support feedback—not spun from external blogs. Advertising networks (Google AdSense and Monetag) operate strictly under clear disclosures and never influence task approvals, auction winners, or Pay-Per-View settlements.
          </p>
          <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
            <a
              href="https://support.google.com/adsense/answer/48182"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 underline font-medium"
            >
              Google AdSense Program Policies ↗
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://www.w3.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 underline font-medium"
            >
              W3C Accessibility Standards ↗
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://gdpr.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 underline font-medium"
            >
              EU Data Protection Reference ↗
            </a>
          </div>
        </div>
      </div>

      {/* Operational & Data Safety */}
      <div className="p-8 bg-slate-100/80 rounded-3xl border border-slate-200 space-y-6">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Platform Moderation &amp; Data Protection</h2>
          <p className="text-xs text-slate-600">
            Clear rules protect contributors, marketplace buyers, and advertising partners alike.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-600">
          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Human-Only Submissions</span>
            </h3>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Timing checks, attention traps, and duplicate detection prevent automated scripts from flooding surveys or annotation queues.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>PII Minimization</span>
            </h3>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Survey replies and task work product stay separated from personal payout numbers and login credentials, and public leaderboards never expose private emails or phone numbers.
            </p>
          </div>

          <div className="space-y-1.5">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>100% Free Task Access</span>
            </h3>
            <p className="text-slate-600 text-[11px] leading-relaxed">
              Every member receives 1 vetted daily task dropped at 08:00 AM EAT with zero Worker Pass required—and National ID KYC keeps every PayPal cash-out protected.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Direct Operator Email: <strong className="text-slate-900 font-mono">nigideon36@gmail.com</strong></span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('contact')}
            className="text-brand-600 hover:text-brand-700 font-semibold cursor-pointer underline text-xs"
          >
            Contact Support &amp; Corrections Desk →
          </button>
        </div>
      </div>
    </div>
  );
};
