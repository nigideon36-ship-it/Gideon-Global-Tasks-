import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { TaskCategory } from '../types/tasks';
import { Search, Flame, ShieldCheck, Zap } from 'lucide-react';

interface Props {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  difficultyFilter: string;
  onDifficultyChange: (d: string) => void;
  sortBy: string;
  onSortChange: (s: string) => void;
}

export const HeroMarketplace: React.FC<Props> = ({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  difficultyFilter,
  onDifficultyChange,
  sortBy,
  onSortChange
}) => {
  const { userStats, setWalletOpen, setStreakModalOpen } = useTasks();

  const CATEGORIES: { id: string; label: string }[] = [
    { id: 'all', label: 'All Tasks' },
    { id: 'survey', label: 'I Survey' },
    { id: 'annotation', label: 'Data Annotation' },
    { id: 'data-entry', label: 'Data Entry' },
    { id: 'writing', label: 'Writing & Copy' },
    { id: 'meme-content', label: 'Memes & Content' },
    { id: 'micro', label: 'Micro Tasks (30s)' }
  ];

  const streakMultiplierPercent = userStats.streakDays >= 7 ? 20 : 10;

  return (
    <div className="space-y-8">
      {/* Editorial Hero Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-white rounded-3xl border border-slate-200 p-6 md:p-10 shadow-xs overflow-hidden">
        <div className="lg:col-span-7 space-y-5">
          {/* Daily streak indicator */}
          <button
            type="button"
            onClick={() => setStreakModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-amber-50 hover:bg-amber-100 cursor-pointer rounded-xl border border-amber-200 text-xs font-semibold text-amber-800 transition-all shadow-xs group"
          >
            <Flame className="w-4 h-4 fill-amber-500 text-amber-500 group-hover:scale-110 transition-transform" />
            <span>
              {userStats.streakDays}-Day Contributor Streak Active (+{streakMultiplierPercent}% Bonus Payout)
            </span>
            <span className="text-[11px] text-amber-600 font-bold underline ml-1">
              {userStats.streakDays >= 7 ? 'Milestone Claimed' : 'View Calendar →'}
            </span>
          </button>

          <h1 className="text-3xl md:text-5xl font-extrabold tracking-tight text-slate-900 text-balance leading-tight">
            Earn Globally with Surveys, AI Annotation & Micro Tasks
          </h1>

          <p className="text-slate-600 text-sm md:text-base leading-relaxed max-w-xl">
            Join thousands of remote earners worldwide on Gideon Global Tasks. Complete paid questionnaires, label computer vision datasets, digitize retail receipts, draft marketing copy, and generate viral memes with instant withdrawals.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onSelectCategory('annotation')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm whitespace-nowrap"
            >
              Explore AI Labelling
            </button>
            <button
              onClick={() => onSelectCategory('survey')}
              className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Take High-Paying Surveys
            </button>
            <button
              onClick={() => setWalletOpen(true)}
              className="text-xs text-brand-600 hover:text-brand-800 font-semibold hover:underline"
            >
              View Your Wallet (${userStats.balance.toFixed(2)}) →
            </button>
          </div>
        </div>

        {/* Hero Visual Asset */}
        <div className="lg:col-span-5 h-full">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md aspect-16/10 lg:aspect-auto lg:h-72">
            <img
              src="/src/assets/images/hero_global_workforce_1794041820709.jpg"
              alt="Global Workforce Collaboration"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent flex items-end p-4">
              <div className="text-white text-xs">
                <span className="font-bold block">140+ Countries Represented</span>
                <span className="text-slate-300 text-[11px]">Fair, borderless micropayments since 2024</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Proof & KPI Strip (§3.C / §1.H) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-3 text-center border-r border-slate-100 last:border-r-0">
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            $184,200+
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Paid to Contributors</div>
        </div>
        <div className="p-3 text-center border-r border-slate-100 last:border-r-0">
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            140+
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Nations Active</div>
        </div>
        <div className="p-3 text-center border-r border-slate-100 last:border-r-0">
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            99.4%
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Task Approval Rate</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl md:text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            0% Fees
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Gold & Diamond Tiers</div>
        </div>
      </div>

      {/* Interactive Filter Bar */}
      <div className="space-y-4 pt-2">
        {/* Category Segmented Tabs (Functional Buttons) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search & Sort Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tasks by keyword or company..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-brand-500 outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              value={difficultyFilter}
              onChange={(e) => onDifficultyChange(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 outline-hidden focus:border-brand-500"
            >
              <option value="all">All Difficulties</option>
              <option value="Beginner">Beginner</option>
              <option value="Intermediate">Intermediate</option>
              <option value="Expert">Expert</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 outline-hidden focus:border-indigo-500"
            >
              <option value="highest-reward">Highest Bounty</option>
              <option value="quickest">Quickest (Min Time)</option>
              <option value="most-spots">Most Spots Left</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};
