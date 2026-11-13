/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useMemo } from 'react';
import { TaskProvider, useTasks } from './context/TaskContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { HeroMarketplace } from './components/HeroMarketplace';
import { TaskCard } from './components/TaskCard';
import { SurveyWorkspaceModal } from './components/SurveyWorkspaceModal';
import { AnnotationWorkspaceModal } from './components/AnnotationWorkspaceModal';
import { DataEntryWorkspaceModal } from './components/DataEntryWorkspaceModal';
import { WritingWorkspaceModal } from './components/WritingWorkspaceModal';
import { MicroTaskWorkspaceModal } from './components/MicroTaskWorkspaceModal';
import { MemeStudioView } from './components/MemeStudioView';
import { LeaderboardView } from './components/LeaderboardView';
import { EmployerPortal } from './components/EmployerPortal';
import { WalletModal } from './components/WalletModal';
import { NotificationToast } from './components/NotificationToast';
import { Footer } from './components/Footer';
import { GeminiChatbot } from './components/GeminiChatbot';
import { AudioTranscriber } from './components/AudioTranscriber';
import { AIMediaStudio } from './components/AIMediaStudio';
import { ThreeGlobeHub } from './components/ThreeGlobeHub';
import { TaskRushGame } from './components/TaskRushGame';
import { GoogleMapsExplorer } from './components/GoogleMapsExplorer';
import { TaskHistoryView } from './components/TaskHistoryView';
import { PackagesModal } from './components/PackagesModal';
import { DailyStreakModal } from './components/DailyStreakModal';
import { ReferralDashboard } from './components/ReferralDashboard';
import { PublisherModal } from './components/PublisherModal';
import { DarajaMpesaModal } from './components/DarajaMpesaModal';
import { IntasendModal } from './components/IntasendModal';
import { PayPalModal } from './components/PayPalModal';
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
import { Inbox, Globe, Gamepad2, History, Zap, Sparkles, Flame, Users } from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { isOwner } = useAuth();
  const {
    tasks,
    activeTab,
    setActiveTab,
    selectedTask,
    setSelectedTask,
    activePackage,
    packagesModalOpen,
    setPackagesModalOpen,
    streakModalOpen,
    setStreakModalOpen,
    userStats,
    publisherModalOpen,
    setPublisherModalOpen,
    darajaModalOpen,
    setDarajaModalOpen,
    intasendModalOpen,
    setIntasendModalOpen,
    paypalModalOpen,
    setPaypalModalOpen,
    privacyTermsModalOpen,
    setPrivacyTermsModalOpen,
    privacyTermsTab,
    openPrivacyTerms
  } = useTasks();

  // Marketplace filter states
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('highest-reward');
  const [requiredCategoryPrompt, setRequiredCategoryPrompt] = useState<string | undefined>(undefined);

  // Sub-view toggle for 3D Globe vs Game
  const [interactiveMode, setInteractiveMode] = useState<'globe' | 'game'>('globe');

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
    // Check if worker has an active package that unlocks this category
    if (!activePackage || !activePackage.unlockedCategories.includes(task.category)) {
      setRequiredCategoryPrompt(`${task.category.toUpperCase().replace('-', ' ')}`);
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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between selection:bg-brand-600 selection:text-white">
      <div>
        <Navbar />

        <main className="max-w-7xl mx-auto px-4 md:px-6 pt-6 md:pt-8">
          {/* Active Package Banner & Task History Prompt */}
          <div className="mb-6 p-4 bg-gradient-to-r from-slate-900 to-brand-950 text-white rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-600 flex items-center justify-center font-bold shrink-0 transition-colors">
                <Zap className="w-4 h-4 text-emerald-400" />
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>Pass Tier: {activePackage?.name || 'Active Contributor'} (${activePackage?.price || 5})</span>
                  <span className="text-emerald-400 font-mono text-[11px] font-semibold">· M-PESA & Wise Verified</span>
                </div>
                <div className="text-[11px] text-slate-300">
                  {activePackage?.taskAllowance} · Minimum withdrawal: <strong className="text-white font-mono">$100.00</strong>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => setStreakModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 fill-current text-amber-400" />
                <span>{userStats.streakDays}-Day Streak ({userStats.streakDays >= 7 ? '+20%' : '+10%'})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('task-history')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold transition-colors"
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
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-lg text-xs font-bold transition-colors shadow-sm"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Worker Passes ($2, $5, $10)</span>
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
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition-colors"
                  >
                    Contributor Passes ($2, $5, $10) →
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
                <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Showing {filteredTasks.length} Available Global Tasks</span>
                  <span className="font-mono">Withdrawals start from $100.00</span>
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

          {/* 2. TASK HISTORY VIEW */}
          {activeTab === 'task-history' && <TaskHistoryView />}

          {/* 3. REFERRAL PARTNER DASHBOARD */}
          {activeTab === 'referrals' && <ReferralDashboard />}

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
          {activeTab === 'meme-studio' && <MemeStudioView />}

          {/* 5. AI MEDIA & VOICE */}
          {activeTab === 'ai-media' && (
            <div className="space-y-10">
              <AIMediaStudio />
              <div className="max-w-7xl mx-auto px-4 md:px-0">
                <AudioTranscriber />
              </div>
            </div>
          )}

          {/* 6. THREE.JS 3D GLOBE & GAME */}
          {(activeTab === 'three-globe' || activeTab === 'game') && (
            <div className="space-y-6">
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

              {interactiveMode === 'globe' ? <ThreeGlobeHub /> : <TaskRushGame />}
            </div>
          )}

          {/* 7. GOOGLE MAPS EXPLORER */}
          {activeTab === 'maps-explorer' && <GoogleMapsExplorer />}

          {/* 8. LEADERBOARD */}
          {activeTab === 'leaderboard' && <LeaderboardView />}

          {/* 9. EMPLOYER PORTAL */}
          {activeTab === 'employer' && <EmployerPortal />}

          {/* 10. ABOUT US & CORPORATE GOVERNANCE */}
          {activeTab === 'about' && <AboutUsView />}

          {/* 11. CONTACT US & DEDICATED SUPPORT */}
          {activeTab === 'contact' && <ContactUsView />}

          {/* 12. IN-DEPTH CONTRIBUTOR GUIDES & KNOWLEDGE BASE */}
          {activeTab === 'guides' && <GuidesView />}

          {/* 13. FREQUENTLY ASKED QUESTIONS */}
          {activeTab === 'faq' && <FAQView />}

          {/* 14. DEDICATED PRIVACY POLICY PAGE (ADSENSE & GDPR) */}
          {activeTab === 'privacy' && <PrivacyPolicyView />}

          {/* 15. DEDICATED TERMS OF SERVICE PAGE */}
          {activeTab === 'terms' && <TermsOfServiceView />}

          {/* 16. DEDICATED EARNINGS & ADVERTISING DISCLAIMER PAGE */}
          {activeTab === 'disclaimer' && <DisclaimerView />}

          {/* 17. DEDICATED HTML SITEMAP & DIRECTORY */}
          {activeTab === 'sitemap' && <HTMLSitemapView />}
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

          <PayPalModal
            isOpen={paypalModalOpen}
            onClose={() => setPaypalModalOpen(false)}
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

      {/* Toast notifications */}
      <NotificationToast />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <TaskProvider>
        <MainAppContent />
      </TaskProvider>
    </AuthProvider>
  );
}
