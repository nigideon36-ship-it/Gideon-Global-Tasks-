import React from 'react';
import { useTasks } from '../context/TaskContext';
import { ShieldCheck, Globe, Users, Award, CheckCircle2, ArrowRight, Mail, Sparkles, Building2, Lock } from 'lucide-react';

export const AboutUsView: React.FC = () => {
  const { setActiveTab } = useTasks();

  return (
    <div className="space-y-12 animate-in fade-in duration-200">
      {/* Hero Header */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-brand-950 text-white rounded-3xl p-8 md:p-12 shadow-xl border border-slate-700/50 relative overflow-hidden">
        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded-full">
            <Building2 className="w-3.5 h-3.5" />
            <span>About Gideon Global Tasks</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-white leading-tight">
            Pioneering Fair, Borderless Crowdsourcing & AI Ground Truth.
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed">
            Founded to bridge the digital divide, Gideon Global Tasks connects frontier artificial intelligence labs, market researchers, and tech enterprises with verified, skilled human contributors across 45+ countries for high-precision data annotation, consumer surveys, content creation, and micro tasks.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setActiveTab('tasks')}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-xl text-xs transition-colors shadow-sm cursor-pointer flex items-center gap-2"
            >
              <span>Explore Task Marketplace</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setActiveTab('contact')}
              className="px-5 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-xl text-xs transition-colors border border-white/20 cursor-pointer flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              <span>Contact Executive Team</span>
            </button>
          </div>
        </div>
      </div>

      {/* The Core Mission & Problem We Solve */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight">
            The Digital Economy Should Have No Borders.
          </h2>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            Every day, enterprise artificial intelligence models require millions of human-verified data points—ranging from 2D bounding boxes on urban crosswalks to receipt digitizations and subjective sentiment ratings. Traditional platforms lock out international workers with exorbitant transaction fees, arbitrary account bans, and payment delays.
          </p>
          <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
            Gideon Global Tasks was architected from the ground up to solve this imbalance. By integrating native mobile micropayments through <strong>M-PESA</strong> and international bank disbursements via <strong>Wise</strong>, we ensure contributors from Nairobi to Manila and São Paulo receive reliable, instant compensation with a guaranteed 0% fee escrow starting from $100.
          </p>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-2xl font-bold text-brand-600 font-mono">45+</span>
              <p className="text-xs font-semibold text-slate-900 mt-1">Countries Represented</p>
              <p className="text-[11px] text-slate-500">Diverse linguistic and geographical workforce.</p>
            </div>
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
              <span className="text-2xl font-bold text-emerald-600 font-mono">99.4%</span>
              <p className="text-xs font-semibold text-slate-900 mt-1">Audit Accuracy Rate</p>
              <p className="text-[11px] text-slate-500">Multimodal automated & peer verification.</p>
            </div>
          </div>
        </div>

        {/* Values Bento */}
        <div className="space-y-4">
          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">256-Bit Financial Escrow</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Every requester budget is pre-funded into secure platform escrow before a single task is published. Workers are guaranteed instant credit upon submission approval without payment counterparty risk.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center font-bold">
              <Award className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Merit-Based Contributor Tiers</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              We reward consistency. Our 7-day login streak grants an automatic 20% earnings multiplier across all completed bounties, and contributors with high accuracy ratings unlock VIP high-yield tasks.
            </p>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-sm space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">20% Transparent Referral Partnering</h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Community growth is shared with the workers who make it happen. Every referrer receives a permanent 20% commission on worker pass purchases made by referred contributors.
            </p>
          </div>
        </div>
      </div>

      {/* Executive Leadership & E-A-T Credentials */}
      <div className="p-8 bg-white rounded-3xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              Executive Leadership &amp; Editorial Governance
            </span>
            <h2 className="text-xl font-bold text-slate-900 mt-1">Founder &amp; Principal Architect: Gideon N.</h2>
          </div>
          <a
            href="mailto:nigideon36@gmail.com"
            className="text-xs font-semibold text-brand-600 hover:text-brand-700 underline font-mono"
          >
            nigideon36@gmail.com
          </a>
        </div>
        <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
          Gideon Global Tasks was architected by <strong>Gideon N.</strong>, an experienced systems architect and data operations engineer with over eight years of experience directing distributed human-in-the-loop machine learning annotation pipelines, high-concurrency database architectures, and international micro-task compensation models. Under this leadership, our platform maintains strict adherence to international research standards, algorithmic consensus verification, and publisher compliance.
        </p>

        {/* Authoritative External Citations */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-xs font-semibold text-slate-700">Authoritative Industry Standards &amp; Compliance Frameworks:</p>
          <div className="flex flex-wrap items-center gap-4 text-xs">
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
              W3C Web Standards ↗
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://gdpr.eu/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 underline font-medium"
            >
              EU General Data Protection Regulation (GDPR) ↗
            </a>
            <span className="text-slate-300">·</span>
            <a
              href="https://wise.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 underline font-medium"
            >
              Wise International Payment Rails ↗
            </a>
          </div>
        </div>
      </div>

      {/* Leadership & Operational Integrity */}
      <div className="p-8 bg-slate-100/80 rounded-3xl border border-slate-200 space-y-6">
        <div className="max-w-2xl space-y-1">
          <h2 className="text-xl font-bold text-slate-900">Governance &amp; Editorial Standards</h2>
          <p className="text-xs text-slate-600">
            Adhering to strict international data privacy guidelines, ethical AI development principles, and Google publisher policies.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs text-slate-600">
          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Zero-Bot Fraud Protection</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Proprietary behavioral telemetry and automated timing audits prevent automated scripts, ensuring requesters receive authentic human intelligence.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Full PII Anonymization</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Contributor responses are cryptographically detached from personal identity credentials before export, preserving worker privacy in compliance with GDPR and CCPA.
            </p>
          </div>

          <div className="space-y-1.5">
            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Transparent Fee Guarantees</span>
            </h4>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              We never take hidden cuts from worker task rewards. Worker passes ($2 Starter, $5 Pro, $10 VIP) cover platform compute while 100% of task rewards go to contributors.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <Lock className="w-4 h-4 text-slate-400" />
            <span>Corporate Headquarters &amp; Global Inquiries: <strong className="text-slate-900 font-mono">nigideon36@gmail.com</strong></span>
          </div>
          <button
            onClick={() => setActiveTab('contact')}
            className="text-brand-600 hover:text-brand-700 font-semibold cursor-pointer underline text-xs"
          >
            Submit an official media or enterprise inquiry →
          </button>
        </div>
      </div>
    </div>
  );
};
