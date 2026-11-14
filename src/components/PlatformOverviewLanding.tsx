import React from 'react';
import { useTasks } from '../context/TaskContext';
import { ShieldCheck, Zap, Globe, ArrowRight, CheckCircle2, Award, Users, BookOpen, HelpCircle, DollarSign, Wallet } from 'lucide-react';

export const PlatformOverviewLanding: React.FC = () => {
  const { setActiveTab, setPackagesModalOpen } = useTasks();

  return (
    <section className="space-y-12 py-8 border-t border-blue-400/40 mt-12 text-white">
      {/* Editorial Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-900 bg-white border border-blue-200 px-3 py-1 rounded-full shadow-xs">
            <Globe className="w-3.5 h-3.5 text-blue-600" />
            <span>How Gideon Global Tasks Operates</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white leading-tight">
            Connecting Frontier Artificial Intelligence with East African Human Intelligence.
          </h2>
          <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
            Gideon Global Tasks is an East Africa-exclusive crowdsourcing and multimodal data annotation marketplace serving contributors in Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia.
          </p>
          <p className="text-xs md:text-sm text-blue-100 leading-relaxed">
            Contributors earn verified micropayments for completed tasks, maintain an ongoing accuracy score, build daily login streak multipliers, and withdraw accumulated earnings starting from the $20.00 milestone directly via <strong className="text-white">M-PESA</strong>, <strong className="text-white">Airtel / MTN MoMo</strong>, and <strong className="text-white">East Africa Bank</strong> rails.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('about')}
              className="text-xs font-semibold text-white hover:text-blue-200 underline cursor-pointer"
            >
              Learn more about our corporate mission →
            </button>
            <span className="text-blue-300">·</span>
            <button
              onClick={() => setActiveTab('guides')}
              className="text-xs font-semibold text-white hover:text-blue-200 underline cursor-pointer"
            >
              Read contributor training guides →
            </button>
          </div>
        </div>

        {/* 4-Step Mechanism Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-brand-50 text-brand-700 font-bold flex items-center justify-center text-xs">
              01
            </div>
            <h3 className="font-bold text-sm text-slate-900">Select Task Specialization</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Choose from consumer market research surveys, 2D computer vision bounding boxes, receipt and invoice OCR digitization, technical copywriting, or rapid usability micro tasks.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-700 font-bold flex items-center justify-center text-xs">
              02
            </div>
            <h3 className="font-bold text-sm text-slate-900">Activate Contributor Pass</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Unlock daily task quotas with a nominal pass: Starter (KES 50 for 25 tasks), Pro (KES 100 for 75 tasks), or VIP (KES 200 for unlimited bounties), converted automatically into your local East African currency.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-700 font-bold flex items-center justify-center text-xs">
              03
            </div>
            <h3 className="font-bold text-sm text-slate-900">Maintain 7-Day Streaks</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Submit accurate work adhering to instructions. Complete tasks daily to reach the 7-day contributor milestone, unlocking an instant $5.00 cash bonus plus a permanent +20% reward multiplier.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-700 font-bold flex items-center justify-center text-xs">
              04
            </div>
            <h3 className="font-bold text-sm text-slate-900">Withdraw at $20 Milestone</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Once your balance reaches the $20.00 cash-out threshold, initiate a zero-fee transfer directly to your M-PESA, Airtel / MTN MoMo, or East Africa Bank account.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Quality Assurance Bento */}
      <div className="p-8 bg-white/95 rounded-3xl border border-blue-200/70 shadow-sm space-y-6 text-slate-900">
        <div className="max-w-2xl space-y-1">
          <h3 className="text-lg font-bold text-slate-900">Enterprise Standards & Security Commitments</h3>
          <p className="text-xs text-slate-500">
            Built to deliver mathematically sound ground truth data for frontier machine learning models.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Full Escrow Protection</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Every task reward is backed by 100% pre-funded enterprise deposits held in secure digital escrow. You are guaranteed payout upon task verification.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-brand-600" />
              <span>99.4% Multi-Tier Audit Rate</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Automated IoU checks, spatial validation, and peer consensus filter out low-accuracy submissions, maintaining high reputation scores for reliable workers.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" />
              <span>20% Transparent Referral Share</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Invite friends to the contributor workforce and earn a permanent 20% commission on every worker pass activated through your unique link.
            </p>
          </div>
        </div>
      </div>

      {/* Embedded FAQ Teaser (AdSense Content Anchor) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-white">Common Platform Questions</h3>
            <p className="text-xs text-blue-100">Quick answers to frequently asked contributor questions.</p>
          </div>
          <button
            onClick={() => setActiveTab('faq')}
            className="text-xs font-semibold text-white hover:text-blue-200 underline cursor-pointer"
          >
            View all 8+ questions →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">Why does payout start at $20.00?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              By aggregating payments starting from $20, Gideon Global Tasks absorbs all gateway and mobile money fees, guaranteeing contributors receive 100% of their earnings with zero deduction fees.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">How do worker passes (KES 50, KES 100, KES 200) operate?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Passes fund platform infrastructure and prevent bot abuse. They unlock generous daily task quotas in Kenya Shillings (or your local East Africa currency equivalent) while 100% of task rewards go into your wallet.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">How do I receive M-PESA &amp; Mobile Money disbursements?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Simply enter your verified East Africa mobile number (+254, +256, +255, +250, +257, +211, +251, or +252). When your withdrawal is processed, funds arrive directly and generate an official transaction receipt code.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">How does the 7-day streak bonus work?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Log in and complete at least one task each day. On Day 7, you receive an automatic $5.00 cash bonus plus an ongoing +20% reward multiplier applied to every future task approved.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};
