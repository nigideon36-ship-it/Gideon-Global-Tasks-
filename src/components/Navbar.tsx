import React from 'react';
import { useTasks } from '../context/TaskContext';
import { Wallet, Globe, Sparkles, Flame } from 'lucide-react';
import { ThemeColorPicker } from './ThemeColorPicker';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, userStats, setWalletOpen, setStreakModalOpen } = useTasks();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setActiveTab('tasks')}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm transition-colors">
            G
          </div>
          <span>Gideon Global Tasks</span>
        </button>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'tasks' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveTab('task-history')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'task-history' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Task History
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'referrals' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Referrals (20%)
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'packages' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Worker Passes ($2–$10)
          </button>
          <button
            onClick={() => setActiveTab('meme-studio')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'meme-studio' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Meme Studio
          </button>
          <button
            onClick={() => setActiveTab('ai-media')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'ai-media' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            AI Media & 3D
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <ThemeColorPicker />

          <button
            type="button"
            onClick={() => setStreakModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
            title="Daily Contributor Streak"
          >
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="font-mono">{userStats.streakDays}d</span>
            <span className="text-[10px] text-amber-600 font-semibold">{userStats.streakDays >= 7 ? '+20%' : '+10%'}</span>
          </button>

          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tabular-nums font-mono">${userStats.balance.toFixed(2)}</span>
            <span className="text-slate-400">·</span>
            <span>Withdraw</span>
          </button>
        </div>
      </div>
    </header>
  );
};
