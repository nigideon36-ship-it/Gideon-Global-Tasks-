/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { TaskProvider, useTasks } from './context/TaskContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { RegionProvider, useRegion } from './context/RegionContext';
import {
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
  MAX_TASK_REWARD_KES,
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
import { TestimonialsView } from './components/TestimonialsView';
import { EmployerPortal } from './components/EmployerPortal';

const AudioTranscriber = lazy(() => import('./components/AudioTranscriber').then(m => ({ default: m.AudioTranscriber })));
const AIMediaStudio = lazy(() => import('./components/AIMediaStudio').then(m => ({ default: m.AIMediaStudio })));
const ThreeGlobeHub = lazy(() => import('./components/ThreeGlobeHub').then(m => ({ default: m.ThreeGlobeHub })));
const TaskRushGame = lazy(() => import('./components/TaskRushGame').then(m => ({ default: m.TaskRushGame })));
const GoogleMapsExplorer = lazy(() => import('./components/GoogleMapsExplorer').then(m => ({ default: m.GoogleMapsExplorer })));
import { PackagesModal } from './components/PackagesModal';
import { DailyStreakModal } from './components/DailyStreakModal';
import { ReferralDashboard } from './components/ReferralDashboard';
import { PublisherModal } from './components/PublisherModal';
import { DarajaMpesaModal } from './components/DarajaMpesaModal';
import { IntasendModal } from './components/IntasendModal';
import { PaystackModal } from './components/PaystackModal';
import { RegionGateModal } from './components/RegionGateModal';
import { AuthModal } from './components/AuthModal';
import { CustomerProfileModal } from './components/CustomerProfileModal';
import { TwoFactorModal } from './components/TwoFactorModal';
import { PrivacyTermsModal } from './components/PrivacyTermsModal';
import { AdSenseBanner } from './components/AdSenseBanner';
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
import { Task } from './types/tasks';
import { Inbox, Globe, Gamepad2, History, Zap, Sparkles, Flame, Users, LayoutDashboard } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { isOwner } = useAuth();
  const { selectedCountry } = useRegion();
  const {
    tasks,
    activeTab,
    setActiveTab,
    selectedTask,
    setSelectedTask,
    activePackage,
    packagesModalOpen,
    setPackagesModalOpen,
    purchasePackage,
    dailyQuotaStatus,
    showNotification,
    streakModalOpen,
    setStreakModalOpen,
    userStats,
    publisherModalOpen,
    setPublisherModalOpen,
    darajaModalOpen,
    setDarajaModalOpen,
    intasendModalOpen,
    setIntasendModalOpen,
    paystackModalOpen,
    setPaystackModalOpen,
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
  const [requiredCategoryPrompt, setRequiredCategoryPrompt] = useState<string | undefined>(undefined);

  // Sub-view toggle for 3D Globe vs Game
  const [interactiveMode, setInteractiveMode] = useState<'globe' | 'game'>('globe');
  const paystackRedirectHandledRef = useRef<string | null>(null);

  // Automatic verification when returning from a Paystack Payment Page or Paystack Card Checkout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const reference = (params.get('reference') || params.get('trxref') || '').trim();
    const pkgParam = (params.get('paystack_pkg') || '').trim().toLowerCase();

    if (!reference || paystackRedirectHandledRef.current === reference) return;
    paystackRedirectHandledRef.current = reference;

    const cleanUrlParams = () => {
      try {
        const nextUrl = new URL(window.location.href);
        nextUrl.searchParams.delete('reference');
        nextUrl.searchParams.delete('trxref');
        nextUrl.searchParams.delete('paystack_pkg');
        window.history.replaceState({}, document.title, nextUrl.pathname + nextUrl.search + nextUrl.hash);
      } catch {}
    };

    try {
      const raw = localStorage.getItem('gideon_verified_ps_refs');
      const verifiedRefs: string[] = raw ? JSON.parse(raw) : [];
      if (verifiedRefs.includes(reference)) {
        cleanUrlParams();
        return;
      }
    } catch {}

    showNotification(`Verifying your Paystack payment (${reference})...`);

    fetch(`/api/paystack/verify/${encodeURIComponent(reference)}`, {
      headers: {
        'x-ea-country': selectedCountry.code,
        'x-ea-verified': 'true',
      },
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        cleanUrlParams();
        if (!ok || data?.status !== 'success') {
          showNotification(
            data?.error ||
              `Paystack payment ${reference} status is "${data?.status || 'pending'}". Open Passes → Paystack Link to re-verify.`
          );
          return;
        }

        const pendingPkg = (() => {
          try {
            return localStorage.getItem('gideon_pending_paystack_pkg') || '';
          } catch {
            return '';
          }
        })();

        const resolvedCandidate = String(data.packageId || pkgParam || pendingPkg || 'pro').toLowerCase();
        const resolvedPkg: 'starter' | 'pro' | 'vip' =
          resolvedCandidate === 'starter' || resolvedCandidate === 'vip' ? resolvedCandidate : 'pro';

        try {
          const raw = localStorage.getItem('gideon_verified_ps_refs');
          const verifiedRefs: string[] = raw ? JSON.parse(raw) : [];
          if (!verifiedRefs.includes(reference)) {
            localStorage.setItem('gideon_verified_ps_refs', JSON.stringify([...verifiedRefs, reference]));
          }
          localStorage.removeItem('gideon_pending_paystack_pkg');
        } catch {}

        purchasePackage(
          resolvedPkg,
          'Paystack Page',
          `${data.customerEmail || selectedCountry.code} (Ref: ${reference})`
        );
      })
      .catch(() => {
        cleanUrlParams();
        showNotification(`Could not verify Paystack reference ${reference}. You can verify it inside Worker Passes → Paystack Link.`);
      });
  }, [selectedCountry.code, purchasePackage, showNotification]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        if (selectedCategory !== 'all' && task.category !== selectedCategory) {
          return false;
        }
        if (difficultyFilter !== 'all' && task.difficulty !== difficultyFilter) {
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
        if (sortBy === 'highest-reward') return b.reward - a.reward;
        if (sortBy === 'quickest') return a.estimatedMinutes - b.estimatedMinutes;
        if (sortBy === 'most-spots') return b.spotsRemaining - a.spotsRemaining;
        return 0;
      });
  }, [tasks, selectedCategory, difficultyFilter, searchQuery, sortBy]);

  const handleSelectTask = (task: Task) => {
    const eligibility = dailyQuotaStatus.canDoTask(task);
    if (!eligibility.allowed) {
      if (eligibility.reason) {
        showNotification(eligibility.reason);
      }
      setRequiredCategoryPrompt(`${task.category.toUpperCase().replace('-', ' ')} (${formatCurrencyFromUsd(task.reward, selectedCountry)})`);
      setPackagesModalOpen(true);
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
          {/* Active Package Banner & Task History Prompt */}
          <div className="mb-6 p-4 bg-blue-950 bg-gradient-to-r from-blue-950 to-blue-900 border border-blue-400/30 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center font-bold shrink-0 transition-colors">
                <Zap className="w-4 h-4 text-sky-200" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex flex-wrap items-center gap-2">
                  <span>
                    {activePackage
                      ? `Pass Tier: ${activePackage.name} (${formatCurrencyFromKes(activePackage.priceKes, selectedCountry)})`
                      : isOwner
                      ? 'Pass Tier: Owner Console Access'
                      : `Free Tier: Only 1 Free Task Daily (Max ${formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)})`}
                  </span>
                  <span className="text-sky-300 font-mono text-[11px] font-semibold">
                    · Today: {dailyQuotaStatus.usedToday}/{dailyQuotaStatus.rule.dailyLimit} used (Max {formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)}/task)
                  </span>
                </div>
                <div className="text-[11px] text-blue-100">
                  {activePackage
                    ? activePackage.taskAllowance
                    : `Starter ${formatCurrencyFromKes(50, selectedCountry)} (2/day) · 2nd Pass ${formatCurrencyFromKes(100, selectedCountry)} (3/day) · VIP ${formatCurrencyFromKes(200, selectedCountry)} (4 surveys/day) · Max ${formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)}/task`} · Pay Pass via M-PESA: <strong className="text-emerald-300 font-extrabold font-mono text-xs tracking-wide">0758727558</strong>
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
                onClick={() => {
                  setRequiredCategoryPrompt(undefined);
                  setPackagesModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-blue-50 text-blue-950 rounded-lg text-xs font-bold transition-colors shadow-sm cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  Worker Passes ({formatCurrencyFromKes(50, selectedCountry)}, {formatCurrencyFromKes(100, selectedCountry)}, {formatCurrencyFromKes(200, selectedCountry)})
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
                    <span>Customer Dashboard →</span>
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
                    onClick={() => setActiveTab('packages')}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Contributor Passes ({formatCurrencyFromKes(50, selectedCountry)}–{formatCurrencyFromKes(200, selectedCountry)}) →
                  </button>
                  <button
                    onClick={() => setActiveTab('investments')}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                  >
                    Invest Pools ({formatCurrencyFromKes(50, selectedCountry)}+) →
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

              {/* Task Cards Grid */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-blue-100 font-medium">
                  <span>Showing {filteredTasks.length} Available East Africa Tasks</span>
                  <span className="font-mono">Withdrawals start from {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}</span>
                </div>

                {filteredTasks.length === 0 ? (
                  <div className="py-16 text-center bg-white rounded-3xl border border-slate-200 p-8 space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                      <Inbox className="w-6 h-6" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800">
                      No matching tasks found
                    </h3>
                    <p className="text-xs text-slate-500 max-w-sm mx-auto">
                      Try clearing search terms or selecting another category to view more opportunities.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCategory('all');
                        setSearchQuery('');
                        setDifficultyFilter('all');
                      }}
                      className="mt-2 px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
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

          {/* 3c. CUSTOMER TESTIMONIALS & REVIEWS */}
          {activeTab === 'testimonials' && (
            <div className="bg-slate-50 rounded-3xl p-4 md:p-6 shadow-xl border border-blue-300/30 text-slate-900">
              <TestimonialsView />
            </div>
          )}

          {/* 4. TASK PACKAGES VIEW */}
          {activeTab === 'packages' && (
            <div className="space-y-8 animate-in fade-in duration-200">
              <PackagesModal
                isOpen={true}
                onClose={() => setActiveTab('tasks')}
                requiredForCategory={requiredCategoryPrompt}
              />
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

      {/* Packages Modal (when triggered via button or gating) */}
      {activeTab !== 'packages' && (
        <PackagesModal
          isOpen={packagesModalOpen}
          onClose={() => setPackagesModalOpen(false)}
          requiredForCategory={requiredCategoryPrompt}
        />
      )}

      {/* Owner-Only Administration & Payment Modals (Strictly nigideon36@gmail.com) */}
      {isOwner && (
        <>
          <PublisherModal
            isOpen={publisherModalOpen}
            onClose={() => setPublisherModalOpen(false)}
            onOpenPrivacyTerms={openPrivacyTerms}
          />

          <DarajaMpesaModal
            isOpen={darajaModalOpen}
            onClose={() => setDarajaModalOpen(false)}
          />

          <IntasendModal
            isOpen={intasendModalOpen}
            onClose={() => setIntasendModalOpen(false)}
          />

          <PaystackModal
            isOpen={paystackModalOpen}
            onClose={() => setPaystackModalOpen(false)}
          />
        </>
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
          <MainAppContent />
        </TaskProvider>
      </RegionProvider>
    </AuthProvider>
  );
}
