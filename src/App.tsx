/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { TaskProvider, useTasks } from './context/TaskContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RegionProvider, useRegion } from './context/RegionContext';
import {
  convertUsdToLocal,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
  WITHDRAWAL_THRESHOLD_USD,
} from './lib/eastAfrica';
import { Navbar } from './components/Navbar';
import { HeroMarketplace } from './components/HeroMarketplace';
import { TaskCard } from './components/TaskCard';
import { SurveyWorkspaceModal } from './components/SurveyWorkspaceModal';
import { AnnotationWorkspaceModal } from './components/AnnotationWorkspaceModal';
import { DataEntryWorkspaceModal } from './components/DataEntryWorkspaceModal';
import { WritingWorkspaceModal } from './components/WritingWorkspaceModal';
import { MicroTaskWorkspaceModal } from './components/MicroTaskWorkspaceModal';
import { CreatorCampaignWorkspaceModal } from './components/CreatorCampaignWorkspaceModal';
import { MemeStudioView } from './components/MemeStudioView';
import { LeaderboardView } from './components/LeaderboardView';
import { WalletModal } from './components/WalletModal';
import { NotificationToast } from './components/NotificationToast';
import { Footer } from './components/Footer';
import { GeminiChatbot } from './components/GeminiChatbot';
import { TaskHistoryView } from './components/TaskHistoryView';
import { CustomerDashboard } from './components/CustomerDashboard';
import { InvestmentsView } from './components/InvestmentsView';
import { AuctionsView } from './components/AuctionsView';
import { PayPerViewView } from './components/PayPerViewView';
import { TestimonialsView } from './components/TestimonialsView';
import { EmployerPortal } from './components/EmployerPortal';

const AudioTranscriber = lazy(() => import('./components/AudioTranscriber').then(m => ({ default: m.AudioTranscriber })));
const AIMediaStudio = lazy(() => import('./components/AIMediaStudio').then(m => ({ default: m.AIMediaStudio })));
const ThreeGlobeHub = lazy(() => import('./components/ThreeGlobeHub').then(m => ({ default: m.ThreeGlobeHub })));
const TaskRushGame = lazy(() => import('./components/TaskRushGame').then(m => ({ default: m.TaskRushGame })));
const GoogleMapsExplorer = lazy(() => import('./components/GoogleMapsExplorer').then(m => ({ default: m.GoogleMapsExplorer })));
import { DailyStreakModal } from './components/DailyStreakModal';
import { ReferralDashboard } from './components/ReferralDashboard';
import { PublisherModal } from './components/PublisherModal';
import { RegionGateModal } from './components/RegionGateModal';
import { AuthModal } from './components/AuthModal';
import { CustomerProfileModal } from './components/CustomerProfileModal';
import { TwoFactorModal } from './components/TwoFactorModal';
import { PrivacyTermsModal } from './components/PrivacyTermsModal';
import { AdSenseBanner } from './components/AdSenseBanner';
import { TaskAlertSubscriptionBanner } from './components/TaskAlertSubscriptionBanner';
import { PlatformOverviewLanding } from './components/PlatformOverviewLanding';
import { AboutUsView } from './components/AboutUsView';
import { ContactUsView } from './components/ContactUsView';
import { GuidesView } from './components/GuidesView';
import { FAQView } from './components/FAQView';
import { PrivacyPolicyView } from './components/PrivacyPolicyView';
import { TermsOfServiceView } from './components/TermsOfServiceView';
import { DisclaimerView } from './components/DisclaimerView';
import { HTMLSitemapView } from './components/HTMLSitemapView';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { MonetagInitializer } from './components/MonetagInitializer';
import { Task } from './types/tasks';
import { Inbox, Globe, Video, History, Zap, ShieldCheck, Flame, Users, LayoutDashboard, Gamepad2 } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { isOwner } = useAuth();
  const { selectedCountry } = useRegion();
  const {
    tasks,
    activeTab,
    setActiveTab,
    selectedTask,
    setSelectedTask,
    kycStatus,
    dailyQuotaStatus,
    dailyDropInfo,
    showNotification,
    streakModalOpen,
    setStreakModalOpen,
    userStats,
    publisherModalOpen,
    setPublisherModalOpen,
    privacyTermsModalOpen,
    setPrivacyTermsModalOpen,
    privacyTermsTab,
    openPrivacyTerms
  } = useTasks();

  // Marketplace filter states
  const [selectedCategory, setSelectedCategory] = useState<string>(() => {
    if (typeof window === 'undefined') return 'all';
    const cat = new URLSearchParams(window.location.search).get('category');
    return cat || 'all';
  });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('highest-reward');
  const [minRewardLocal, setMinRewardLocal] = useState<string>('');
  const [maxRewardLocal, setMaxRewardLocal] = useState<string>('');
  const [minTimeMinutes, setMinTimeMinutes] = useState<string>('');
  const [maxTimeMinutes, setMaxTimeMinutes] = useState<string>('');

  const prevCountryCodeRef = useRef<string>(selectedCountry.code);
  useEffect(() => {
    if (prevCountryCodeRef.current !== selectedCountry.code) {
      prevCountryCodeRef.current = selectedCountry.code;
      setMinRewardLocal('');
      setMaxRewardLocal('');
    }
  }, [selectedCountry.code]);

  const handleResetMarketplaceFilters = () => {
    setSelectedCategory('all');
    setSearchQuery('');
    setDifficultyFilter('all');
    setMinRewardLocal('');
    setMaxRewardLocal('');
    setMinTimeMinutes('');
    setMaxTimeMinutes('');
  };

  // Sub-view toggle for 3D Globe vs Game
  const [interactiveMode, setInteractiveMode] = useState<'globe' | 'game'>('globe');

  const sharedTaskHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || tasks.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const sharedTaskId = (params.get('task') || '').trim();
    const paypalStatus = (params.get('paypal_status') || '').trim().toLowerCase();

    if (paypalStatus) {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.delete('paypal_status');
      nextUrl.searchParams.delete('pkg');
      window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search + nextUrl.hash);
      if (paypalStatus === 'success') {
        showNotification(
          'PayPal payment step completed! Return to your workspace to confirm your PayPal Transaction ID.'
        );
      } else if (paypalStatus === 'cancelled') {
        showNotification('PayPal checkout was cancelled. You can retry anytime via PayPal.');
      }
    }

    if (sharedTaskId && sharedTaskHandledRef.current !== sharedTaskId) {
      const matched = tasks.find((t) => t.id === sharedTaskId);
      if (matched) {
        sharedTaskHandledRef.current = sharedTaskId;
        setActiveTab('tasks');
        setSelectedCategory(matched.category);
        setSearchQuery(matched.title);
        showNotification(`Shared task loaded: "${matched.title}"`);
      }
    }
  }, [tasks, setActiveTab, showNotification]);

  const filteredTasks = useMemo(() => {
    const parsedMinReward = minRewardLocal.trim() !== '' ? Number(minRewardLocal) : null;
    const parsedMaxReward = maxRewardLocal.trim() !== '' ? Number(maxRewardLocal) : null;
    const parsedMinTime = minTimeMinutes.trim() !== '' ? Number(minTimeMinutes) : null;
    const parsedMaxTime = maxTimeMinutes.trim() !== '' ? Number(maxTimeMinutes) : null;

    return tasks
      .filter((task) => {
        if (userStats.completedTaskIds.includes(task.id)) {
          return false;
        }
        if (selectedCategory !== 'all' && task.category !== selectedCategory) {
          return false;
        }
        if (difficultyFilter !== 'all' && task.difficulty !== difficultyFilter) {
          return false;
        }
        const taskLocalReward = convertUsdToLocal(task.reward, selectedCountry);
        if (parsedMinReward !== null && !Number.isNaN(parsedMinReward) && taskLocalReward < parsedMinReward) {
          return false;
        }
        if (parsedMaxReward !== null && !Number.isNaN(parsedMaxReward) && taskLocalReward > parsedMaxReward) {
          return false;
        }
        if (parsedMinTime !== null && !Number.isNaN(parsedMinTime) && task.estimatedMinutes < parsedMinTime) {
          return false;
        }
        if (parsedMaxTime !== null && !Number.isNaN(parsedMaxTime) && task.estimatedMinutes > parsedMaxTime) {
          return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = task.title.toLowerCase().includes(q);
          const matchDesc = task.description.toLowerCase().includes(q);
          const matchReq = task.requesterName.toLowerCase().includes(q);
          const matchTags = task.tags.some((t) => t.toLowerCase().includes(q));
          if (!matchTitle && !matchDesc && !matchReq && !matchTags) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (dailyDropInfo.droppedTaskId) {
          if (a.id === dailyDropInfo.droppedTaskId && b.id !== dailyDropInfo.droppedTaskId) return -1;
          if (b.id === dailyDropInfo.droppedTaskId && a.id !== dailyDropInfo.droppedTaskId) return 1;
        }
        if (sortBy === 'highest-reward') return b.reward - a.reward;
        if (sortBy === 'lowest-reward') return a.reward - b.reward;
        if (sortBy === 'quickest') return a.estimatedMinutes - b.estimatedMinutes;
        if (sortBy === 'most-spots') return b.spotsRemaining - a.spotsRemaining;
        return 0;
      });
  }, [
    tasks,
    userStats.completedTaskIds,
    dailyDropInfo.droppedTaskId,
    selectedCategory,
    difficultyFilter,
    searchQuery,
    sortBy,
    selectedCountry,
    minRewardLocal,
    maxRewardLocal,
    minTimeMinutes,
    maxTimeMinutes,
  ]);

  const handleSelectTask = (task: Task) => {
    const eligibility = dailyQuotaStatus.canDoTask(task);
    if (!eligibility.allowed) {
      if (eligibility.reason) {
        showNotification(eligibility.reason);
      }
      return;
    }

    if (task.category === 'meme-content') {
      setActiveTab('meme-studio');
    } else {
      setSelectedTask(task);
    }
  };

  return (
    <div className="min-h-screen bg-blue-700 bg-gradient-to-b from-blue-600 via-blue-700 to-blue-800 flex flex-col justify-between selection:bg-blue-300 selection:text-blue-950">
      <div>
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
          {/* Open Free Task Access, 150 KSh PayPal Payouts & Strict KYC Banner */}
          <div className="mb-6 p-4 bg-blue-950 bg-gradient-to-r from-blue-950 to-blue-900 border border-blue-400/30 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold shrink-0 transition-colors">
                <Zap className="w-4 h-4 text-sky-200" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
                  <span>
                    {isOwner
                      ? 'Owner Console Access · Open Marketplace'
                      : '100% Free Tasks · 1 Task Drops Daily at Exactly 08:00 AM EAT'}
                  </span>
                  <span className="text-sky-300 font-mono text-[11px] font-semibold">
                    · {dailyDropInfo.isDropWindowOpen ? `Today's Drop Live (${dailyQuotaStatus.usedToday}/1 used)` : `Drops in ${dailyDropInfo.countdownLabel}`}
                  </span>
                </div>
                <div className="text-[11px] text-blue-100">
                  Task rewards depend on the task &amp; merchant · Withdrawals start at{' '}
                  <strong className="text-emerald-300 font-bold">
                    {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}
                  </strong>{' '}
                  via <strong className="text-sky-200 font-bold">PayPal Only</strong> · Strict KYC Required (Front &amp; Back of {selectedCountry.idDocumentName})
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStreakModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 fill-current text-amber-300" />
                <span>{userStats.streakDays}-Day Streak ({userStats.streakDays >= 7 ? '+20%' : '+10%'})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
              >
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Customer Dashboard</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('task-history')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-800 hover:bg-blue-700 text-blue-100 border border-blue-500/40 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <History className="w-3.5 h-3.5" />
                <span>View Task History</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('dashboard')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer ${
                  kycStatus === 'Approved'
                    ? 'bg-emerald-100 text-emerald-950 hover:bg-emerald-200'
                    : 'bg-white text-blue-950 hover:bg-blue-50'
                }`}
              >
                <ShieldCheck className={`w-3.5 h-3.5 ${kycStatus === 'Approved' ? 'text-emerald-700' : 'text-blue-600'}`} />
                <span>
                  {kycStatus === 'Approved' ? 'National ID KYC: Approved' : `Verify National ID KYC (${kycStatus})`}
                </span>
              </button>
            </div>
          </div>

          {/* 1. TASKS MARKETPLACE */}
          {activeTab === 'tasks' && (
            <div className="space-y-10">
              <HeroMarketplace
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                difficultyFilter={difficultyFilter}
                onDifficultyChange={setDifficultyFilter}
                sortBy={sortBy}
                onSortChange={setSortBy}
                minRewardLocal={minRewardLocal}
                maxRewardLocal={maxRewardLocal}
                onMinRewardChange={setMinRewardLocal}
                onMaxRewardChange={setMaxRewardLocal}
                minTimeMinutes={minTimeMinutes}
                maxTimeMinutes={maxTimeMinutes}
                onMinTimeChange={setMinTimeMinutes}
                onMaxTimeChange={setMaxTimeMinutes}
                onResetFilters={handleResetMarketplaceFilters}
                filteredCount={filteredTasks.length}
                totalCount={tasks.length}
              />

              {/* Quick Jump Bar */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 flex flex-wrap items-center justify-between gap-4 shadow-xs">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <span className="font-bold text-slate-800">Platform Workspaces:</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5" />
                    <span>Customer Dashboard &amp; KYC →</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('task-history')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Task History Ledger →
                  </button>
                  <button
                    onClick={() => setActiveTab('referrals')}
                    className="px-3 py-1.5 bg-brand-50 hover:bg-brand-100 text-brand-900 border border-brand-200/80 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5"
                  >
                    <Users className="w-3.5 h-3.5 text-brand-600" />
                    <span>Referrals (Earn 20%) →</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('investments')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Invest Pools ({formatCurrencyFromKes(50, selectedCountry)}+) →
                  </button>
                  <button
                    onClick={() => setActiveTab('auctions')}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Product Auctions →
                  </button>
                  <button
                    onClick={() => setActiveTab('pay-per-view')}
                    className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <Video className="w-3.5 h-3.5" />
                    <span>Pay-Per-View (Free · 5 KSh/View) →</span>
                  </button>
                  <button
                    onClick={() => setActiveTab('testimonials')}
                    className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Customer Testimonials →
                  </button>
                  <button
                    onClick={() => setActiveTab('ai-media')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    AI Media Studio & Voice →
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('three-globe');
                      setInteractiveMode('globe');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    3D Global Earth →
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('three-globe');
                      setInteractiveMode('game');
                    }}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Task Rush Game →
                  </button>
                  <button
                    onClick={() => setActiveTab('maps-explorer')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Google Maps Field Tasks →
                  </button>
                </div>
              </div>

              {/* High-Reward Task Email Alert Subscriptions */}
              <TaskAlertSubscriptionBanner />

              {/* Daily 8:00 AM EAT Task Drop — Real-Time Countdown & Instant Open Task Reveal */}
              {(() => {
                const isDroppedTaskCompleted = Boolean(
                  dailyDropInfo.droppedTask &&
                    userStats.completedTaskIds.includes(dailyDropInfo.droppedTask.id)
                );
                const canOpenDropNow = Boolean(
                  dailyDropInfo.droppedTask &&
                    (dailyDropInfo.isDropWindowOpen || isOwner) &&
                    !isDroppedTaskCompleted
                );

                return (
                  <div className="bg-white rounded-2xl border border-blue-200/90 p-5 md:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-sm font-extrabold text-slate-900">
                        <span
                          className={`inline-block w-2.5 h-2.5 rounded-full ${
                            dailyDropInfo.isDropWindowOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`}
                        />
                        <span>Daily 8:00 AM EAT Task Drop</span>
                        <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-50 text-blue-800 border border-blue-200">
                          {dailyDropInfo.eatTimeLabel}
                        </span>
                        {dailyDropInfo.isDropWindowOpen && !isDroppedTaskCompleted && (
                          <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            LIVE NOW
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed">
                        {isDroppedTaskCompleted
                          ? `Today's 8:00 AM Task Drop is completed and removed from your active queue. View your payout in Task History. Next task drops tomorrow at 08:00 AM EAT.`
                          : dailyDropInfo.isDropWindowOpen
                          ? dailyDropInfo.droppedTask
                            ? `Today's 08:00 AM EAT task is live: "${dailyDropInfo.droppedTask.title}" (${formatCurrencyFromUsd(
                                dailyDropInfo.droppedTask.reward,
                                selectedCountry
                              )} merchant reward). Only 1 task drops daily.`
                            : 'Today’s 08:00 AM EAT drop is live! Rewards depend on each task and merchant budget.'
                          : `Keep time! Only 1 task drops every day at exactly 08:00 AM EAT. When this countdown hits 00:00:00, the Open Task button unlocks automatically.`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3.5 shrink-0">
                      <div className="flex items-center gap-1.5 bg-slate-950 text-white px-3.5 py-2.5 rounded-xl border border-slate-800 shadow-xs">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mr-1.5">
                          {dailyDropInfo.isDropWindowOpen ? 'Next Drop' : 'Drops In'}
                        </span>
                        <div className="flex items-center gap-1 font-mono tabular-nums">
                          <div className="bg-slate-800 px-2 py-1 rounded-md text-center min-w-[38px]">
                            <div className="text-sm font-extrabold text-emerald-300 leading-none">
                              {dailyDropInfo.countdownHours}
                            </div>
                            <div className="text-[8px] text-slate-400 uppercase mt-0.5">Hrs</div>
                          </div>
                          <span className="text-slate-500 font-bold">:</span>
                          <div className="bg-slate-800 px-2 py-1 rounded-md text-center min-w-[38px]">
                            <div className="text-sm font-extrabold text-emerald-300 leading-none">
                              {dailyDropInfo.countdownMinutes}
                            </div>
                            <div className="text-[8px] text-slate-400 uppercase mt-0.5">Min</div>
                          </div>
                          <span className="text-slate-500 font-bold">:</span>
                          <div className="bg-slate-800 px-2 py-1 rounded-md text-center min-w-[38px]">
                            <div className="text-sm font-extrabold text-amber-300 leading-none">
                              {dailyDropInfo.countdownSeconds}
                            </div>
                            <div className="text-[8px] text-slate-400 uppercase mt-0.5">Sec</div>
                          </div>
                        </div>
                      </div>

                      {canOpenDropNow && dailyDropInfo.droppedTask && (
                        <button
                          type="button"
                          onClick={() => handleSelectTask(dailyDropInfo.droppedTask!)}
                          className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold transition-colors shadow-sm cursor-pointer whitespace-nowrap"
                        >
                          Open Task ({formatCurrencyFromUsd(dailyDropInfo.droppedTask.reward, selectedCountry)}) →
                        </button>
                      )}

                      {isDroppedTaskCompleted && (
                        <button
                          type="button"
                          onClick={() => setActiveTab('task-history')}
                          className="px-4 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition-colors cursor-pointer whitespace-nowrap"
                        >
                          Completed Today · View History →
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Task Cards Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-blue-100 font-medium">
                  <span>Showing {filteredTasks.length} Available East Africa Tasks (Completed tasks clear automatically · 1 Drop Daily at 08:00 AM EAT)</span>
                  <span className="font-mono">Min PayPal withdrawal: {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</span>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      {tasks.length > 0 && tasks.every((t) => userStats.completedTaskIds.includes(t.id))
                        ? 'All available tasks completed!'
                        : 'No matching active tasks found'}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Completed tasks automatically disappear from your active feed and move to Task History. Clear filters or check back at the next 08:00 AM EAT drop.
                    </p>
                    <button
                      type="button"
                      onClick={handleResetMarketplaceFilters}
                      className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isDailyDrop={dailyDropInfo.droppedTaskId === task.id}
                        onSelect={handleSelectTask}
                      />
                    ))}
                  </div>
                )}

                {/* Google AdSense Contextual Placement */}
                <AdSenseBanner
                  className="mt-8"
                  onOpenPublisherHub={isOwner ? () => setPublisherModalOpen(true) : undefined}
                />

                {/* Public Platform Overview & SEO Landing Content */}
                <PlatformOverviewLanding />
              </div>
            </div>
          )}

          {/* 1b. CUSTOMER DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <CustomerDashboard />
            </div>
          )}

          {/* 2. TASK HISTORY VIEW */}
          {activeTab === 'task-history' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <TaskHistoryView />
            </div>
          )}

          {/* 3. REFERRAL PARTNER DASHBOARD */}
          {activeTab === 'referrals' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <ReferralDashboard />
            </div>
          )}

          {/* 3b. DEPOSIT-ONLY INVESTMENTS (KES 50+ MINIMUM) */}
          {activeTab === 'investments' && (
            <div className="bg-slate-50 rounded-3xl p-4 md:p-6 shadow-xl border border-blue-300/30 text-slate-900">
              <InvestmentsView />
            </div>
          )}

          {/* 3b2. CUSTOMER PRODUCT AUCTIONS */}
          {activeTab === 'auctions' && (
            <div className="bg-slate-50 rounded-3xl p-4 md:p-6 shadow-xl border border-blue-300/30 text-slate-900">
              <AuctionsView />
            </div>
          )}

          {/* 3b3. FREE PAY-PER-VIEW STATUS FEED (5 SHILLINGS/VIEW · AUTO-PAID IN 24H) */}
          {activeTab === 'pay-per-view' && (
            <div className="bg-slate-50 rounded-3xl p-4 md:p-6 shadow-xl border border-blue-300/30 text-slate-900">
              <PayPerViewView />
            </div>
          )}

          {/* 3c. CUSTOMER TESTIMONIALS & REVIEWS */}
          {activeTab === 'testimonials' && (
            <div className="bg-slate-50 rounded-3xl p-4 md:p-6 shadow-xl border border-blue-300/30 text-slate-900">
              <TestimonialsView />
            </div>
          )}

          {/* 4. MEME STUDIO */}
          {activeTab === 'meme-studio' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <MemeStudioView />
            </div>
          )}

          {/* 5. AI MEDIA & VOICE */}
          {activeTab === 'ai-media' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading AI Media Studio...</div>}>
                <div className="space-y-10">
                  <AIMediaStudio />
                  <div className="max-w-7xl mx-auto px-4 md:px-0">
                    <AudioTranscriber />
                  </div>
                </div>
              </Suspense>
            </div>
          )}

          {/* 6. THREE.JS 3D GLOBE & GAME */}
          {(activeTab === 'three-globe' || activeTab === 'game') && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900 space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">
                    Interactive 3D Hub & Arcade
                  </h2>
                  <p className="text-xs text-slate-500">
                    Explore the procedural Three.js 3D global telemetry Earth or play the 60fps Taskmaster Rush arcade game.
                  </p>
                </div>
                <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setInteractiveMode('globe')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      interactiveMode === 'globe'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>3D Earth Scene</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setInteractiveMode('game')}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                      interactiveMode === 'game'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Gamepad2 className="w-3.5 h-3.5" />
                    <span>Task Rush Game</span>
                  </button>
                </div>
              </div>

              <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading interactive 3D workspace...</div>}>
                {interactiveMode === 'globe' ? <ThreeGlobeHub /> : <TaskRushGame />}
              </Suspense>
            </div>
          )}

          {/* 7. GOOGLE MAPS EXPLORER */}
          {activeTab === 'maps-explorer' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <Suspense fallback={<div className="p-8 text-center text-sm text-slate-500">Loading Maps Explorer...</div>}>
                <GoogleMapsExplorer />
              </Suspense>
            </div>
          )}

          {/* 8. LEADERBOARD */}
          {activeTab === 'leaderboard' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <LeaderboardView />
            </div>
          )}

          {/* 9. EMPLOYER PORTAL */}
          {activeTab === 'employer' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <EmployerPortal />
            </div>
          )}

          {/* 10. ABOUT US & CORPORATE GOVERNANCE */}
          {activeTab === 'about' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <AboutUsView />
            </div>
          )}

          {/* 11. CONTACT US & DEDICATED SUPPORT */}
          {activeTab === 'contact' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <ContactUsView />
            </div>
          )}

          {/* 12. IN-DEPTH CONTRIBUTOR GUIDES & KNOWLEDGE BASE */}
          {activeTab === 'guides' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <GuidesView />
            </div>
          )}

          {/* 13. FREQUENTLY ASKED QUESTIONS */}
          {activeTab === 'faq' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <FAQView />
            </div>
          )}

          {/* 14. DEDICATED PRIVACY POLICY PAGE (ADSENSE & GDPR) */}
          {activeTab === 'privacy' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <PrivacyPolicyView />
            </div>
          )}

          {/* 15. DEDICATED TERMS OF SERVICE PAGE */}
          {activeTab === 'terms' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <TermsOfServiceView />
            </div>
          )}

          {/* 16. DEDICATED EARNINGS & ADVERTISING DISCLAIMER PAGE */}
          {activeTab === 'disclaimer' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <DisclaimerView />
            </div>
          )}

          {/* 17. DEDICATED HTML SITEMAP & DIRECTORY */}
          {activeTab === 'sitemap' && (
            <div className="bg-white/95 rounded-3xl p-6 md:p-8 shadow-xl border border-blue-300/30 text-slate-900">
              <HTMLSitemapView />
            </div>
          )}
        </main>
      </div>

      <Footer />

      {/* Task Workspaces */}
      {selectedTask && selectedTask.category === 'survey' && (
        <SurveyWorkspaceModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {selectedTask && selectedTask.category === 'annotation' && (
        <AnnotationWorkspaceModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {selectedTask && selectedTask.category === 'data-entry' && (
        <DataEntryWorkspaceModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {selectedTask && selectedTask.category === 'writing' && (
        <WritingWorkspaceModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {selectedTask && selectedTask.category === 'micro' && (
        <MicroTaskWorkspaceModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {selectedTask && selectedTask.category === 'creator-campaign' && (
        <CreatorCampaignWorkspaceModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}

      {/* Global Wallet Modal */}
      <WalletModal />

      {/* Daily Streak Modal */}
      <DailyStreakModal
        isOpen={streakModalOpen}
        onClose={() => setStreakModalOpen(false)}
      />

      {/* Owner-Only Administration Modal (Strictly nigideon36@gmail.com) */}
      {isOwner && (
        <PublisherModal
          isOpen={publisherModalOpen}
          onClose={() => setPublisherModalOpen(false)}
          onOpenPrivacyTerms={openPrivacyTerms}
        />
      )}

      {/* AdSense Policy Compliant Legal & Privacy Modal */}
      <PrivacyTermsModal
        isOpen={privacyTermsModalOpen}
        initialTab={privacyTermsTab}
        onClose={() => setPrivacyTermsModalOpen(false)}
      />

      {/* Gemini AI Floating Assistant */}
      <GeminiChatbot />

      {/* Floating GDPR & AdSense Cookie Consent Banner */}
      <CookieConsentBanner />

      {/* East Africa Access & Country Gate */}
      <RegionGateModal />

      {/* Mobile Number + Optional Email Registration / Sign-In Modal */}
      <AuthModal />

      {/* Customer Profile Editor & Locked Registration / Payout Details Modal */}
      <CustomerProfileModal />

      {/* Two-Factor Authentication (SMS / Authenticator App) Modal */}
      <TwoFactorModal />

      {/* Toast notifications */}
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RegionProvider>
        <TaskProvider>
          <MonetagInitializer />
          <MainAppContent />
        </TaskProvider>
      </RegionProvider>
    </AuthProvider>
  );
}
