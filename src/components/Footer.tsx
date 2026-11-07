import React from 'react';
import { useTasks } from '../context/TaskContext';
import { Globe, ShieldCheck } from 'lucide-react';

export const Footer: React.FC = () => {
  const { setActiveTab, setWalletOpen } = useTasks();

  return (
    <footer className="mt-20 border-t border-slate-200 bg-white text-slate-500 py-12 text-xs">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2 font-bold text-slate-900 text-sm">
            <span>Gideon Global Tasks</span>
            <span aria-hidden="true" className="text-slate-300">·</span>
            <span className="font-normal text-xs text-slate-500">Borderless Crowdsourcing Network</span>
          </div>
          <p className="text-slate-400 text-[11px]">
            Empowering global contributors with fair micropayments for surveys, AI data annotation, document extraction, content writing, and micro tasks.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 font-medium text-slate-600">
          <button onClick={() => setActiveTab('tasks')} className="hover:text-slate-900 transition-colors">
            Tasks Marketplace
          </button>
          <button onClick={() => setActiveTab('meme-studio')} className="hover:text-slate-900 transition-colors">
            Meme Studio
          </button>
          <button onClick={() => setActiveTab('leaderboard')} className="hover:text-slate-900 transition-colors">
            Leaderboard
          </button>
          <button onClick={() => setActiveTab('employer')} className="hover:text-slate-900 transition-colors">
            Employer Portal
          </button>
          <button onClick={() => setWalletOpen(true)} className="hover:text-slate-900 transition-colors">
            Cash Out
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-400">
        <div>
          © {new Date().getFullYear()} Gideon Global Tasks Inc. All rights reserved.
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>256-Bit Escrow Security</span>
          </span>
          <span aria-hidden="true">·</span>
          <span>Terms of Service</span>
          <span aria-hidden="true">·</span>
          <span>Privacy Policy</span>
        </div>
      </div>
    </footer>
  );
};
