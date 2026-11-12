import React from 'react';
import { useTasks } from '../context/TaskContext';
import { ShieldCheck, Zap, Globe, ArrowRight, CheckCircle2, Award, Users, BookOpen, HelpCircle, DollarSign, Wallet } from 'lucide-react';

export const PlatformOverviewLanding: React.FC = () => {
  const { setActiveTab, setPackagesModalOpen } = useTasks();

  return (
    <section className="space-y-12 py-8 border-t border-slate-200 mt-12 text-slate-800">
      {/* Editorial Overview Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
            <Globe className="w-3.5 h-3.5 text-emerald-600" />
            <span>How Gideon Global Tasks Operates</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 leading-tight">
            Connecting Frontier Artificial Intelligence with Global Human Intelligence.
          </h2>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            Gideon Global Tasks is an open crowdsourcing and multimodal data annotation marketplace. We enable enterprise machine learning teams, market research institutes, and independent software vendors to collect, annotate, and verify high-quality datasets through a globally distributed contributor workforce.
          </p>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            Contributors earn verified micropayments for completed tasks, maintain an ongoing accuracy score, build daily login streak multipliers, and withdraw accumulated earnings starting from the $100.00 milestone directly via <strong>M-PESA</strong> and <strong>Wise</strong>.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('about')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
            >
              Learn more about our corporate mission →
            </button>
            <span className="text-slate-300">·</span>
            <button
              onClick={() => setActiveTab('guides')}
              className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
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
              Unlock daily task quotas with a nominal pass: Starter ($2 for 25 tasks), Pro ($5 for 75 tasks), or VIP ($10 for unlimited bounties). Pass fees fund anti-bot compute while 100% of task rewards go to you.
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
            <h3 className="font-bold text-sm text-slate-900">Withdraw at $100 Milestone</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Once your balance reaches the $100.00 cash-out threshold, initiate a zero-fee transfer directly to your M-PESA phone number or Wise multi-currency international bank account.
            </p>
          </div>
        </div>
      </div>

      {/* Trust & Quality Assurance Bento */}
      <div className="p-8 bg-slate-100/70 rounded-3xl border border-slate-200 space-y-6">
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
            <h3 className="text-lg font-bold text-slate-900">Common Platform Questions</h3>
            <p className="text-xs text-slate-500">Quick answers to frequently asked contributor questions.</p>
          </div>
          <button
            onClick={() => setActiveTab('faq')}
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline cursor-pointer"
          >
            View all 8+ questions →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">Why does payout start at $100.00?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              By aggregating payments starting from $100, Gideon Global Tasks absorbs all gateway and mobile money fees, guaranteeing contributors receive 100% of their earnings with zero deduction fees.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">How do worker passes ($2, $5, $10) operate?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Passes fund platform infrastructure and prevent bot abuse. They unlock generous daily task quotas while allowing 100% of task rewards from requesters to go directly into your withdrawable wallet.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <h4 className="font-bold text-slate-900">How do I receive M-PESA disbursements?</h4>
            <p className="text-slate-500 leading-relaxed text-[11px]">
              Simply enter your registered Safaricom M-PESA phone number (+254...). When your withdrawal is processed, funds arrive immediately and generate an official M-PESA transaction code.
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
