import React, { useMemo } from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import {
  convertKesToLocal,
  convertUsdToLocal,
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';
import { Search, Flame, SlidersHorizontal, Clock, Coins, RotateCcw } from 'lucide-react';
import heroWorkforceImg from '../assets/images/hero_global_workforce_1794041820709.jpg';

interface Props {
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  difficultyFilter: string;
  onDifficultyChange: (d: string) => void;
  sortBy: string;
  onSortChange: (s: string) => void;
  minRewardLocal: string;
  maxRewardLocal: string;
  onMinRewardChange: (val: string) => void;
  onMaxRewardChange: (val: string) => void;
  minTimeMinutes: string;
  maxTimeMinutes: string;
  onMinTimeChange: (val: string) => void;
  onMaxTimeChange: (val: string) => void;
  onResetFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

export const HeroMarketplace: React.FC<Props> = ({
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  difficultyFilter,
  onDifficultyChange,
  sortBy,
  onSortChange,
  minRewardLocal,
  maxRewardLocal,
  onMinRewardChange,
  onMaxRewardChange,
  minTimeMinutes,
  maxTimeMinutes,
  onMinTimeChange,
  onMaxTimeChange,
  onResetFilters,
  filteredCount,
  totalCount,
}) => {
  const { tasks, userStats, setWalletOpen, setStreakModalOpen } = useTasks();
  const { selectedCountry } = useRegion();

  const CATEGORIES: { id: string; label: string }[] = [
    { id: 'all', label: 'All Tasks' },
    { id: 'creator-campaign', label: 'Creator Campaigns' },
    { id: 'survey', label: 'I Survey' },
    { id: 'annotation', label: 'Data Annotation' },
    { id: 'data-entry', label: 'Data Entry' },
    { id: 'writing', label: 'Writing & Copy' },
    { id: 'meme-content', label: 'Memes & Content' },
    { id: 'micro', label: 'Micro Tasks (30s)' }
  ];

  const streakMultiplierPercent = userStats.streakDays >= 7 ? 20 : 10;
  const totalPaidToContributors = (userStats.payoutHistory || [])
    .filter((p) => p.status === 'Completed')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  const bounds = useMemo(() => {
    const localRewards = tasks.map((t) => convertUsdToLocal(t.reward, selectedCountry));
    const minutes = tasks.map((t) => t.estimatedMinutes);
    const defaultMaxReward = convertKesToLocal(50, selectedCountry);
    return {
      minReward: localRewards.length > 0 ? Math.min(...localRewards) : 0,
      maxReward: localRewards.length > 0 ? Math.max(...localRewards, defaultMaxReward) : defaultMaxReward,
      minTime: minutes.length > 0 ? Math.min(...minutes) : 1,
      maxTime: minutes.length > 0 ? Math.max(...minutes, 20) : 20,
    };
  }, [tasks, selectedCountry]);

  const kes35 = convertKesToLocal(35, selectedCountry);
  const kes36 = convertKesToLocal(36, selectedCountry);
  const kes75 = convertKesToLocal(75, selectedCountry);
  const kes76 = convertKesToLocal(76, selectedCountry);

  const activeRewardPreset = useMemo(() => {
    if (!minRewardLocal && !maxRewardLocal) return 'all';
    const minN = minRewardLocal === '' ? null : Number(minRewardLocal);
    const maxN = maxRewardLocal === '' ? null : Number(maxRewardLocal);
    if ((minN === null || minN === 0) && maxN === kes35) return 'low';
    if (minN === kes36 && maxN === kes75) return 'mid';
    if (minN === kes76 && maxN === null) return 'high';
    return 'custom';
  }, [minRewardLocal, maxRewardLocal, kes35, kes36, kes75, kes76]);

  const activeTimePreset = useMemo(() => {
    if (!minTimeMinutes && !maxTimeMinutes) return 'all';
    const minN = minTimeMinutes === '' ? null : Number(minTimeMinutes);
    const maxN = maxTimeMinutes === '' ? null : Number(maxTimeMinutes);
    if ((minN === null || minN === 0) && maxN === 2) return 'express';
    if (minN === 3 && maxN === 5) return 'short';
    if (minN === 6 && maxN === 10) return 'medium';
    if (minN === 11 && maxN === null) return 'long';
    return 'custom';
  }, [minTimeMinutes, maxTimeMinutes]);

  const hasActiveFilters =
    selectedCategory !== 'all' ||
    searchQuery.trim() !== '' ||
    difficultyFilter !== 'all' ||
    minRewardLocal.trim() !== '' ||
    maxRewardLocal.trim() !== '' ||
    minTimeMinutes.trim() !== '' ||
    maxTimeMinutes.trim() !== '';

  const sliderMaxRewardValue =
    maxRewardLocal.trim() !== '' && !Number.isNaN(Number(maxRewardLocal))
      ? Math.min(bounds.maxReward, Math.max(0, Number(maxRewardLocal)))
      : bounds.maxReward;

  const sliderMaxTimeValue =
    maxTimeMinutes.trim() !== '' && !Number.isNaN(Number(maxTimeMinutes))
      ? Math.min(bounds.maxTime, Math.max(1, Number(maxTimeMinutes)))
      : bounds.maxTime;

  return (
    <div className="space-y-8 text-slate-900">
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
            Earn Across East Africa with Creator Campaigns, Surveys &amp; Micro Tasks
          </h1>

          <p className="text-slate-600 text-sm md:text-base leading-relaxed max-w-xl">
            Exclusively built for remote earners and content creators across East Africa. Only 1 task drops daily at exactly 08:00 AM EAT with rewards set by each task&apos;s merchant — get paid for product Reels, Videos, Texts, Surveys &amp; Micro Tasks via PayPal.
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => onSelectCategory('creator-campaign')}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-sm whitespace-nowrap"
            >
              Explore Creator Campaigns
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
              View Your Wallet ({formatCurrencyFromUsd(userStats.balance, selectedCountry)}) →
            </button>
          </div>
        </div>

        {/* Hero Visual Asset */}
        <div className="lg:col-span-5 h-full">
          <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md aspect-video lg:aspect-auto lg:h-72 bg-slate-900">
            <img
              src={heroWorkforceImg}
              alt="Global Workforce Collaboration"
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-slate-950/45 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent flex items-end p-4">
              <div className="text-white text-xs">
                <span className="font-bold block">East Africa Exclusive · 8 Nations</span>
                <span className="text-slate-300 text-[11px]">KE · UG · TZ · RW · BI · SS · ET · SO · PayPal Payouts</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Proof & KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-3 text-center border-r border-slate-100 last:border-r-0">
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrencyFromUsd(totalPaidToContributors, selectedCountry)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Paid to Contributors</div>
        </div>
        <div className="p-3 text-center border-r border-slate-100 last:border-r-0">
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            08:00 AM EAT
          </div>
          <div className="text-xs text-slate-500 mt-0.5">1 Daily Task Drop</div>
        </div>
        <div className="p-3 text-center border-r border-slate-100 last:border-r-0">
          <div className="text-xl md:text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Min Withdrawal + ID KYC</div>
        </div>
        <div className="p-3 text-center">
          <div className="text-xl md:text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            PayPal Only
          </div>
          <div className="text-xs text-slate-500 mt-0.5">Verified Payout Rail</div>
        </div>
      </div>

      {/* Interactive Filter Bar */}
      <div className="space-y-4 pt-2">
        {/* Category Segmented Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelectCategory(cat.id)}
                className={`px-4 py-2 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-950 text-white border border-blue-300/50 shadow-sm'
                    : 'bg-white text-slate-700 hover:text-blue-900 border border-blue-200 hover:border-white'
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
              aria-label="Filter by difficulty"
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
              aria-label="Sort tasks"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 outline-hidden focus:border-indigo-500"
            >
              <option value="highest-reward">Highest Bounty</option>
              <option value="lowest-reward">Lowest Bounty</option>
              <option value="quickest">Quickest (Min Time)</option>
              <option value="most-spots">Most Spots Left</option>
            </select>
          </div>
        </div>

        {/* Real-Time Reward Range & Completion Time Filter Panel */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 md:p-5 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
              <SlidersHorizontal className="w-4 h-4 text-blue-700" />
              <span>Real-Time Reward &amp; Completion Time Filters</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-semibold text-slate-600 tabular-nums">
                {filteredCount} / {totalCount} tasks matching
              </span>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={onResetFilters}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-semibold transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Reward Range Controls */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Reward Range ({selectedCountry.symbol})</span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-emerald-700 tabular-nums">
                  {minRewardLocal ? `${selectedCountry.symbol} ${Number(minRewardLocal).toLocaleString()}` : `${selectedCountry.symbol} ${bounds.minReward.toLocaleString()}`}
                  {' – '}
                  {maxRewardLocal ? `${selectedCountry.symbol} ${Number(maxRewardLocal).toLocaleString()}` : `${selectedCountry.symbol} ${bounds.maxReward.toLocaleString()}`}
                </span>
              </div>

              {/* Quick Reward Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'All Rewards', min: '', max: '' },
                  { id: 'low', label: `Up to ${formatCurrencyFromKes(35, selectedCountry)}`, min: '', max: String(kes35) },
                  { id: 'mid', label: `${formatCurrencyFromKes(36, selectedCountry)}–${formatCurrencyFromKes(75, selectedCountry)}`, min: String(kes36), max: String(kes75) },
                  { id: 'high', label: `${formatCurrencyFromKes(76, selectedCountry)}+`, min: String(kes76), max: '' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onMinRewardChange(preset.min);
                      onMaxRewardChange(preset.max);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                      activeRewardPreset === preset.id
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Min / Max Reward Inputs + Live Max Slider */}
              <div className="grid grid-cols-12 gap-2.5 items-center pt-1">
                <div className="col-span-4">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Min ({selectedCountry.symbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={bounds.maxReward}
                    value={minRewardLocal}
                    onChange={(e) => onMinRewardChange(e.target.value)}
                    placeholder={String(bounds.minReward)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-hidden tabular-nums"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Max ({selectedCountry.symbol})
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={bounds.maxReward * 2}
                    value={maxRewardLocal}
                    onChange={(e) => onMaxRewardChange(e.target.value)}
                    placeholder={String(bounds.maxReward)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 outline-hidden tabular-nums"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Max Cap Slider
                  </label>
                  <input
                    type="range"
                    aria-label="Maximum reward slider"
                    min={bounds.minReward}
                    max={bounds.maxReward}
                    step={Math.max(1, Math.round((bounds.maxReward - bounds.minReward) / 20))}
                    value={sliderMaxRewardValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onMaxRewardChange(val >= bounds.maxReward ? '' : String(val));
                    }}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Completion Time Estimate Controls */}
            <div className="space-y-3 lg:border-l lg:border-slate-100 lg:pl-6">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  <span>Completion Time Estimate (Mins)</span>
                </span>
                <span className="font-mono text-[11px] font-semibold text-blue-700 tabular-nums">
                  {minTimeMinutes || bounds.minTime}–{maxTimeMinutes || bounds.maxTime} mins
                </span>
              </div>

              {/* Quick Time Presets */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Any Time', min: '', max: '' },
                  { id: 'express', label: 'Quick ≤ 2 mins', min: '', max: '2' },
                  { id: 'short', label: '3–5 mins', min: '3', max: '5' },
                  { id: 'medium', label: '6–10 mins', min: '6', max: '10' },
                  { id: 'long', label: '11+ mins', min: '11', max: '' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onMinTimeChange(preset.min);
                      onMaxTimeChange(preset.max);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer border ${
                      activeTimePreset === preset.id
                        ? 'bg-blue-700 text-white border-blue-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Custom Min / Max Time Inputs + Live Max Slider */}
              <div className="grid grid-cols-12 gap-2.5 items-center pt-1">
                <div className="col-span-4">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Min Mins
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={bounds.maxTime}
                    value={minTimeMinutes}
                    onChange={(e) => onMinTimeChange(e.target.value)}
                    placeholder={String(bounds.minTime)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 outline-hidden tabular-nums"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Max Mins
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={maxTimeMinutes}
                    onChange={(e) => onMaxTimeChange(e.target.value)}
                    placeholder={String(bounds.maxTime)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-600 outline-hidden tabular-nums"
                  />
                </div>
                <div className="col-span-4">
                  <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
                    Max Time Slider
                  </label>
                  <input
                    type="range"
                    aria-label="Maximum completion time slider"
                    min={bounds.minTime}
                    max={bounds.maxTime}
                    step={1}
                    value={sliderMaxTimeValue}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      onMaxTimeChange(val >= bounds.maxTime ? '' : String(val));
                    }}
                    className="w-full accent-blue-700 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
