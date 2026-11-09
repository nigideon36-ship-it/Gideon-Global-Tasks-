import React from 'react';
import { useTasks } from '../context/TaskContext';
import { Globe, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setActiveTab, setWalletOpen, setPublisherModalOpen, openPrivacyTerms } = useTasks();

  return (
    <footer className="mt-20 border-t border-slate-200 bg-white text-slate-500 py-12 text-xs">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 font-bold text-slate-900 text-sm">
            <span>Gideon Global Tasks</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-normal text-xs text-slate-500">Borderless Crowdsourcing Network</span>
          </div>
          <p className="text-slate-400 text-[11px] max-w-xl">
            Empowering global contributors with fair micropayments for surveys, AI data annotation, document extraction, content writing, and micro tasks with M-PESA and Wise disbursements.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 font-medium text-slate-600">
          <button onClick={() => setActiveTab('tasks')} className="hover:text-slate-900 transition-colors cursor-pointer">
            Tasks Marketplace
          </button>
          <button onClick={() => setActiveTab('referrals')} className="hover:text-slate-900 transition-colors cursor-pointer">
            Referrals (20%)
          </button>
          <button onClick={() => setActiveTab('meme-studio')} className="hover:text-slate-900 transition-colors cursor-pointer">
            Meme Studio
          </button>
          <button onClick={() => setPublisherModalOpen(true)} className="text-brand-600 hover:text-brand-700 font-semibold transition-colors cursor-pointer flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>Publish to Google (AdSense & Search Console)</span>
          </button>
          <button onClick={() => setWalletOpen(true)} className="hover:text-slate-900 transition-colors cursor-pointer">
            Cash Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-2">
          <span>© {new Date().getFullYear()} Gideon Global Tasks Inc. All rights reserved.</span>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <a href="/sitemap.xml" target="_blank" className="hover:text-slate-600 underline">sitemap.xml</a>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <a href="/robots.txt" target="_blank" className="hover:text-slate-600 underline">robots.txt</a>
          <span aria-hidden="true" className="text-slate-300">·</span>
          <a href="/ads.txt" target="_blank" className="hover:text-slate-600 underline">ads.txt</a>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit Escrow Security</span>
          </span>
          <span aria-hidden="true">·</span>
          <button onClick={() => openPrivacyTerms('terms')} className="hover:text-slate-600 transition-colors cursor-pointer">
            Terms of Service
          </button>
          <span aria-hidden="true">·</span>
          <button onClick={() => openPrivacyTerms('privacy')} className="hover:text-slate-600 transition-colors cursor-pointer">
            Privacy Policy
          </button>
        </div>
      </div>
    </footer>
  );
};
