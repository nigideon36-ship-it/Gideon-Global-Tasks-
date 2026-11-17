import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Task, PayoutRecord, MemeItem, LeaderboardUser, TaskHistoryRecord, TaskPackage, ReferralRecord, ReferralStats } from '../types/tasks';
import { INITIAL_TASKS, INITIAL_MEMES, INITIAL_LEADERBOARD } from '../data/mockTasks';
import confetti from 'canvas-confetti';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError, isPermissionError } from '../lib/firebase';
import { OWNER_EMAIL, useAuth } from './AuthContext';
import { useRegion } from './RegionContext';
import {
  evaluateTaskEligibility,
  getQuotaRuleForPackageId,
  getTodayDateKey,
  PassQuotaRule,
  TaskEligibilityResult,
} from '../lib/passQuotas';
import {
  MAX_TASK_REWARD_KES,
  MAX_TASK_REWARD_USD,
  WITHDRAWAL_THRESHOLD_USD,
  VIP_PASS_KES,
  convertKesToUsd,
  formatCurrencyFromKes,
  formatCurrencyFromUsd,
} from '../lib/eastAfrica';

export interface CustomerPassProofItem {
  id: string;
  packageId: 'starter' | 'pro' | 'vip';
  packageName: string;
  amountKes: number;
  payToNumber: '0758727558';
  senderPhone: string;
  mpesaCode: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Banned';
  ownerApprovalDetails?: string;
  rejectionOrBanReason?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface UserStatsType {
  balance: number;
  pendingBalance: number;
  lifetimeEarned: number;
  completedTasksCount: number;
  qualityScore: number;
  streakDays: number;
  lastLoginDate: string; // YYYY-MM-DD
  streakBonusMultiplier: number;
  sevenDayBonusAwarded: boolean;
  tier: 'Diamond' | 'Gold' | 'Silver' | 'Bronze';
  completedTaskIds: string[];
  payoutHistory: PayoutRecord[];
}

export const AVAILABLE_PACKAGES: TaskPackage[] = [
  {
    id: 'starter',
    name: 'Starter Contributor Pass',
    price: convertKesToUsd(50),
    priceKes: 50,
    description: 'Entry Worker Pass (50 Shillings): Complete up to 2 paid tasks daily with payout not exceeding 50 shillings per task.',
    taskAllowance: '2 Tasks Daily · Max 50 Shillings',
    unlockedCategories: ['survey', 'micro'],
    features: [
      'Up to 2 Paid Tasks Daily',
      'Task Reward Cap: Not exceeding 50 shillings',
      'Access to Starter Surveys & Micro Tasks',
      'Standard Verification Queue'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Tasker Pass (2nd Pass)',
    price: convertKesToUsd(100),
    priceKes: 100,
    isPopular: true,
    description: 'Second Worker Pass (100 Shillings): Complete up to 3 tasks daily with payout not exceeding 50 shillings per task across campaigns & annotations.',
    taskAllowance: '3 Tasks Daily · Max 50 Shillings',
    unlockedCategories: ['survey', 'annotation', 'data-entry', 'meme-content', 'creator-campaign', 'micro'],
    features: [
      'Up to 3 Paid Tasks Daily',
      'Task Reward Cap: Not exceeding 50 shillings',
      'Creator Campaigns (FB, IG, TikTok & WhatsApp)',
      'Autonomous Driving Annotation & Receipt OCR',
      'Community Meme Studio Bounties'
    ]
  },
  {
    id: 'vip',
    name: 'VIP Taskmaster Pass',
    price: convertKesToUsd(200),
    priceKes: 200,
    description: 'Top-tier VIP Pass (200 Shillings): Complete up to 4 paid surveys daily with payout not exceeding 50 shillings per survey.',
    taskAllowance: '4 Surveys Daily · Max 50 Shillings',
    unlockedCategories: ['survey', 'annotation', 'data-entry', 'writing', 'meme-content', 'creator-campaign', 'micro'],
    features: [
      'Up to 4 Paid Surveys Daily',
      'Survey Reward Cap: Not exceeding 50 shillings',
      'Full Access to High-Value Market Surveys & Writing',
      '0% Fee Guarantee on Withdrawals',
      'Instant M-PESA & Mobile Money Priority Disbursement'
    ]
  }
];

const INITIAL_TASK_HISTORY: TaskHistoryRecord[] = [];

const INITIAL_REFERRAL_HISTORY: ReferralRecord[] = [];

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://gideonglobal.com';

const INITIAL_REFERRAL_STATS: ReferralStats = {
  referralCode: 'GIDEON-EA-894',
  referralLink: `${APP_ORIGIN}/?ref=GIDEON-EA-894`,
  totalClicks: 0,
  totalSignups: 0,
  passesPurchasedCount: 0,
  totalCommissionEarned: 0.00,
  pendingCommission: 0.00,
  commissionPercentage: 20,
  vipTierBonusPercent: 5,
  vipReferralCount: 0
};

export type PlatformTab =
  | 'tasks'
  | 'dashboard'
  | 'task-history'
  | 'referrals'
  | 'investments'
  | 'testimonials'
  | 'meme-studio'
  | 'ai-media'
  | 'three-globe'
  | 'game'
  | 'maps-explorer'
  | 'leaderboard'
  | 'employer'
  | 'wallet'
  | 'packages'
  | 'about'
  | 'contact'
  | 'guides'
  | 'faq'
  | 'privacy'
  | 'terms'
  | 'disclaimer'
  | 'sitemap';

export type ThemeColor = 'emerald' | 'cobalt' | 'violet' | 'amber' | 'rose';

interface TaskContextType {
  tasks: Task[];
  userStats: UserStatsType;
  taskHistory: TaskHistoryRecord[];
  referralHistory: ReferralRecord[];
  referralStats: ReferralStats;
  vipReferralCount: number;
  hasVipReferral: boolean;
  updateReferralCode: (newCode: string) => boolean;
  simulateReferralPurchase: (passTier?: 'starter' | 'pro' | 'vip', refereeName?: string, country?: string) => void;
  activePackage: TaskPackage | null;
  packagesModalOpen: boolean;
  setPackagesModalOpen: (open: boolean) => void;
  purchasePackage: (packageId: 'starter' | 'pro' | 'vip', method: 'M-PESA' | 'Mobile Money' | 'Card' | 'Paystack Page', accountOrPhone: string) => boolean;
  dailyQuotaStatus: {
    rule: PassQuotaRule;
    usedToday: number;
    surveysUsedToday: number;
    remainingToday: number;
    canDoTask: (task: Task) => TaskEligibilityResult;
  };
  passProofs: CustomerPassProofItem[];
  passBannedReason: string | null;
  refreshPassProofs: () => Promise<void>;
  submitManualPassProof: (params: {
    packageId: 'starter' | 'pro' | 'vip';
    senderPhone: string;
    mpesaCode: string;
    screenshotDataUrl: string;
    screenshotFileName?: string;
  }) => Promise<{ success: boolean; error?: string; proof?: CustomerPassProofItem }>;
  streakModalOpen: boolean;
  setStreakModalOpen: (open: boolean) => void;
  advanceDailyStreak: () => void;
  checkInDaily: () => void;
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  memes: MemeItem[];
  leaderboard: LeaderboardUser[];
  activeTab: PlatformTab;
  setActiveTab: (tab: PlatformTab) => void;
  workerMode: 'worker' | 'requester';
  setWorkerMode: (mode: 'worker' | 'requester') => void;
  selectedTask: Task | null;
  setSelectedTask: (task: Task | null) => void;
  walletOpen: boolean;
  setWalletOpen: (open: boolean) => void;
  postTaskModalOpen: boolean;
  setPostTaskModalOpen: (open: boolean) => void;
  completeTask: (taskId: string, rewardEarned: number, summaryTitle: string) => void;
  requestPayout: (amount: number, method: PayoutRecord['method'], details: string) => boolean;
  postTask: (newTask: Omit<Task, 'id' | 'createdAt' | 'spotsRemaining'>) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => boolean;
  deleteTask: (taskId: string) => boolean;
  upvoteMeme: (memeId: string) => void;
  tipMeme: (memeId: string, amount: number) => boolean;
  addMeme: (meme: Omit<MemeItem, 'id' | 'createdAt' | 'upvotes' | 'tipsEarned'>) => void;
  notification: string | null;
  showNotification: (msg: string) => void;
  clearNotification: () => void;
  publisherModalOpen: boolean;
  setPublisherModalOpen: (open: boolean) => void;
  darajaModalOpen: boolean;
  setDarajaModalOpen: (open: boolean) => void;
  intasendModalOpen: boolean;
  setIntasendModalOpen: (open: boolean) => void;
  paystackModalOpen: boolean;
  setPaystackModalOpen: (open: boolean) => void;
  privacyTermsModalOpen: boolean;
  setPrivacyTermsModalOpen: (open: boolean) => void;
  privacyTermsTab: 'privacy' | 'terms';
  openPrivacyTerms: (tab?: 'privacy' | 'terms') => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_STATS = 'gideon_global_user_stats_v2';
const LOCAL_STORAGE_KEY_TASKS = 'gideon_global_tasks';
const LOCAL_STORAGE_KEY_MEMES = 'gideon_global_memes';
const LOCAL_STORAGE_KEY_HISTORY = 'gideon_global_history_v2';
const LOCAL_STORAGE_KEY_PACKAGE = 'gideon_global_package_v2';
const LOCAL_STORAGE_KEY_DAILY_QUOTA = 'gideon_daily_task_usage_v1';
const LOCAL_STORAGE_KEY_PASS_PROOF_IDS = 'gideon_pass_proof_ids_v1';
const LOCAL_STORAGE_KEY_UNLOCKED_PROOFS = 'gideon_unlocked_proof_ids_v1';
const LOCAL_STORAGE_KEY_REF_HISTORY = 'gideon_global_ref_history_v2';
const LOCAL_STORAGE_KEY_REF_STATS = 'gideon_global_ref_stats_v2';
const LOCAL_STORAGE_KEY_LAST_STATE_UID = 'gideon_last_state_uid_v1';
const LOCAL_STORAGE_KEY_PENDING_REF_CODE = 'gideon_pending_ref_code_v1';

interface DailyUsageState {
  dateKey: string;
  count: number;
  surveyCount: number;
}

function readTodayUsage(): DailyUsageState {
  const today = getTodayDateKey();
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY_DAILY_QUOTA);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.dateKey === today) {
        return {
          dateKey: today,
          count: Math.max(0, Number(parsed.count) || 0),
          surveyCount: Math.max(0, Number(parsed.surveyCount) || 0),
        };
      }
    }
  } catch {}
  return { dateKey: today, count: 0, surveyCount: 0 };
}

function readStoredIds(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function appendStoredId(key: string, id: string) {
  try {
    const current = readStoredIds(key);
    if (!current.includes(id)) {
      localStorage.setItem(key, JSON.stringify([id, ...current].slice(0, 30)));
    }
  } catch {}
}

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
      if (!saved) return INITIAL_TASKS;
      const parsed: Task[] = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_TASKS;
      // Sync built-in tasks with updated tier reward caps while keeping spotsRemaining & custom Owner tasks
      const savedById = new Map(parsed.map((t) => [t.id, t]));
      const builtInIds = new Set(INITIAL_TASKS.map((t) => t.id));
      const syncedBuiltIns = INITIAL_TASKS.map((builtIn) => {
        const cached = savedById.get(builtIn.id);
        return cached
          ? {
              ...builtIn,
              reward: Math.min(builtIn.reward, MAX_TASK_REWARD_USD),
              spotsRemaining: cached.spotsRemaining ?? builtIn.spotsRemaining,
            }
          : builtIn;
      });
      const customTasks = parsed
        .filter((t) => !builtInIds.has(t.id))
        .map((t) => ({ ...t, reward: Math.min(Number(t.reward) || 0, MAX_TASK_REWARD_USD) }));
      return [...syncedBuiltIns, ...customTasks];
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [userStats, setUserStats] = useState<UserStatsType>(() => {
    try {
      // Clear legacy pre-funded $114.50 demo wallet cache once
      localStorage.removeItem('gideon_global_user_stats');
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_STATS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    return {
      balance: 0.00,
      pendingBalance: 0.00,
      lifetimeEarned: 0.00,
      completedTasksCount: 0,
      qualityScore: 100.0,
      streakDays: 0,
      lastLoginDate: '',
      streakBonusMultiplier: 0,
      sevenDayBonusAwarded: false,
      tier: 'Bronze' as const,
      completedTaskIds: [] as string[],
      payoutHistory: [] as PayoutRecord[]
    };
  });

  const [taskHistory, setTaskHistory] = useState<TaskHistoryRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : INITIAL_TASK_HISTORY;
    } catch {
      return INITIAL_TASK_HISTORY;
    }
  });

  const [activePackage, setActivePackage] = useState<TaskPackage | null>(() => {
    try {
      // Clear legacy auto-unlocked default pass cache once so Owner approval gate applies
      localStorage.removeItem('gideon_global_package');
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PACKAGE);
      if (saved) {
        const parsed = JSON.parse(saved);
        return AVAILABLE_PACKAGES.find((p) => p.id === parsed?.id) || null;
      }
      return null; // Worker Passes stay locked until paid and Owner-approved
    } catch {
      return null;
    }
  });
  const [dailyUsage, setDailyUsage] = useState<DailyUsageState>(() => readTodayUsage());
  const [passProofs, setPassProofs] = useState<CustomerPassProofItem[]>([]);
  const [passBannedReason, setPassBannedReason] = useState<string | null>(null);

  const [memes, setMemes] = useState<MemeItem[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_MEMES);
      return saved ? JSON.parse(saved) : INITIAL_MEMES;
    } catch {
      return INITIAL_MEMES;
    }
  });

  const [referralHistory, setReferralHistory] = useState<ReferralRecord[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_REF_HISTORY);
      return saved ? JSON.parse(saved) : INITIAL_REFERRAL_HISTORY;
    } catch {
      return INITIAL_REFERRAL_HISTORY;
    }
  });

  const [referralStats, setReferralStats] = useState<ReferralStats>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_REF_STATS);
      return saved ? JSON.parse(saved) : INITIAL_REFERRAL_STATS;
    } catch {
      return INITIAL_REFERRAL_STATS;
    }
  });

  const [themeColor, setThemeColor] = useState<ThemeColor>(() => {
    try {
      const saved = localStorage.getItem('gideon_theme_color');
      if (saved && ['emerald', 'cobalt', 'violet', 'amber', 'rose'].includes(saved)) {
        return saved as ThemeColor;
      }
    } catch {}
    return 'cobalt'; // Default theme color set to Ocean Cobalt Blue
  });

  useEffect(() => {
    try {
      localStorage.setItem('gideon_theme_color', themeColor);
      document.documentElement.setAttribute('data-theme', themeColor);
    } catch {}
  }, [themeColor]);

  const [leaderboard] = useState<LeaderboardUser[]>(INITIAL_LEADERBOARD);
  
  const getTabFromLocation = (): PlatformTab => {
    if (typeof window === 'undefined') return 'tasks';
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const hash = window.location.hash.replace(/^#+/, '').toLowerCase();
    const target = path || hash;
    if (target === 'about') return 'about';
    if (target === 'contact') return 'contact';
    if (target === 'guides') return 'guides';
    if (target === 'faq') return 'faq';
    if (target === 'privacy' || target === 'privacy-policy') return 'privacy';
    if (target === 'terms' || target === 'terms-of-service') return 'terms';
    if (target === 'disclaimer') return 'disclaimer';
    if (target === 'sitemap') return 'sitemap';
    if (target === 'dashboard') return 'dashboard';
    if (target === 'task-history') return 'task-history';
    if (target === 'referrals') return 'referrals';
    if (target === 'investments') return 'investments';
    if (target === 'testimonials') return 'testimonials';
    if (target === 'packages') return 'packages';
    if (target === 'meme-studio') return 'meme-studio';
    if (target === 'ai-media') return 'ai-media';
    if (target === 'three-globe') return 'three-globe';
    if (target === 'game') return 'game';
    if (target === 'maps-explorer') return 'maps-explorer';
    if (target === 'leaderboard') return 'leaderboard';
    if (target === 'employer') return 'employer';
    return 'tasks';
  };

  const [activeTab, setActiveTabRaw] = useState<PlatformTab>(getTabFromLocation);

  const setActiveTab = (tab: PlatformTab) => {
    setActiveTabRaw(tab);
    if (typeof window !== 'undefined') {
      const newPath = tab === 'tasks' ? '/' : `/${tab}`;
      if (window.location.pathname !== newPath) {
        window.history.pushState({ tab }, '', newPath);
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      setActiveTabRaw(getTabFromLocation());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const { activeToken, isOwner, user, customerProfile } = useAuth();
  const { selectedCountry } = useRegion();

  const hydratedTokenRef = useRef<string | null>(null);
  const currentUid = user?.uid || customerProfile?.uid || null;

  // Capture referral code from URL (?ref=...) and keep in localStorage for registration
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref')?.trim().toUpperCase();
      if (ref && ref.length >= 3) {
        localStorage.setItem(LOCAL_STORAGE_KEY_PENDING_REF_CODE, ref);
      }
    } catch {}
  }, []);

  // Persist daily usage cleanly and roll over automatically when date changes
  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_DAILY_QUOTA, JSON.stringify(dailyUsage));
    } catch {}
  }, [dailyUsage]);

  const currentRule = useMemo(
    () => getQuotaRuleForPackageId(activePackage?.id || null),
    [activePackage?.id]
  );

  const normalizedDailyUsage = useMemo(() => {
    const today = getTodayDateKey();
    return dailyUsage.dateKey === today ? dailyUsage : { dateKey: today, count: 0, surveyCount: 0 };
  }, [dailyUsage]);

  const dailyQuotaStatus = useMemo(() => {
    const usedToday = normalizedDailyUsage.count;
    const surveysUsedToday = normalizedDailyUsage.surveyCount;
    const remainingToday = Math.max(0, currentRule.dailyLimit - usedToday);

    const canDoTask = (task: Task): TaskEligibilityResult =>
      evaluateTaskEligibility({
        packageId: activePackage?.id || null,
        unlockedCategories: activePackage?.unlockedCategories,
        taskReward: task.reward,
        taskCategory: task.category,
        completedTodayCount: usedToday,
        surveysCompletedTodayCount: surveysUsedToday,
        isOwner,
        country: selectedCountry,
      });

    return {
      rule: currentRule,
      usedToday,
      surveysUsedToday,
      remainingToday,
      canDoTask,
    };
  }, [activePackage?.id, activePackage?.unlockedCategories, currentRule, normalizedDailyUsage, isOwner, selectedCountry]);

  const vipReferralCount = useMemo(() => {
    const fromHistory = referralHistory.filter(
      (r) =>
        r.packageId === 'vip' ||
        String(r.passPurchased || '').toLowerCase().includes('vip')
    ).length;
    return Math.max(referralStats.vipReferralCount || 0, fromHistory);
  }, [referralHistory, referralStats.vipReferralCount]);

  const hasVipReferral = vipReferralCount >= 1;

  const [workerMode, setWorkerMode] = useState<'worker' | 'requester'>('worker');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [packagesModalOpen, setPackagesModalOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [postTaskModalOpen, setPostTaskModalOpen] = useState(false);
  const [publisherModalOpen, setPublisherModalOpen] = useState(false);
  const [darajaModalOpen, setDarajaModalOpen] = useState(false);
  const [intasendModalOpen, setIntasendModalOpen] = useState(false);
  const [paystackModalOpen, setPaystackModalOpen] = useState(false);
  const [privacyTermsModalOpen, setPrivacyTermsModalOpen] = useState(false);

  const recordPlatformTransaction = (payload: {
    id?: string;
    kind: 'withdrawal' | 'pass_purchase' | 'task_reward' | 'referral_commission' | 'investment_deposit';
    title: string;
    customerLabel?: string;
    gatewayOrMethod: string;
    currency?: string;
    amountLocal?: number;
    amountUsd: number;
    status?: 'Completed' | 'Processing' | 'Pending' | 'Rejected' | 'Failed';
    reference?: string;
    metadata?: Record<string, string | number | boolean | undefined>;
  }) => {
    fetch('/api/transactions/record', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ea-country': selectedCountry.code,
        'x-ea-verified': 'true',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      },
      body: JSON.stringify({
        ...payload,
        countryCode: selectedCountry.code,
      }),
    }).catch(() => {});
  };

  // Sync locally-queued Processing withdrawals to the server-side Owner approval queue
  useEffect(() => {
    const pendingItems = userStats.payoutHistory.filter((p) => p.status === 'Processing');
    if (pendingItems.length === 0) return;

    pendingItems.forEach((p) => {
      fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          id: p.id,
          amountUsd: p.amount,
          method: p.method,
          accountDetails: p.accountDetails,
          countryCode: selectedCountry.code,
          mpesaReceipt: p.mpesaReceipt,
        }),
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const remote = data?.withdrawal;
          if (!remote || remote.status === p.status) return;
          setUserStats((prev) => {
            let refunded = 0;
            const updatedHistory = prev.payoutHistory.map((item) => {
              if (item.id !== remote.id) return item;
              if (item.status === 'Processing' && remote.status === 'Rejected') {
                refunded += item.amount;
              }
              return {
                ...item,
                status: remote.status,
                mpesaReceipt: remote.mpesaReceipt || item.mpesaReceipt,
              };
            });
            return {
              ...prev,
              balance: +(prev.balance + refunded).toFixed(2),
              payoutHistory: updatedHistory,
            };
          });
        })
        .catch(() => {});
    });
  }, [activeToken, walletOpen, activeTab]);

  // Sync live Owner withdrawal approvals/rejections whenever Wallet opens
  useEffect(() => {
    if (!walletOpen || !activeToken) return;
    fetch('/api/withdrawals/my', {
      headers: { Authorization: `Bearer ${activeToken}` }
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const list = data?.withdrawals;
        if (!Array.isArray(list) || list.length === 0) return;
        const statusById = new Map<string, any>(list.map((w: any) => [w.id, w]));
        setUserStats((prev) => {
          let refunded = 0;
          let changed = false;
          const updatedHistory = prev.payoutHistory.map((item) => {
            const remote = statusById.get(item.id);
            if (!remote) return item;
            if (remote.status !== item.status) {
              changed = true;
              if (item.status === 'Processing' && remote.status === 'Rejected') {
                refunded += item.amount;
              }
              return {
                ...item,
                status: remote.status,
                mpesaReceipt: remote.mpesaReceipt || item.mpesaReceipt,
              };
            }
            return item;
          });
          if (!changed) return prev;
          return {
            ...prev,
            balance: +(prev.balance + refunded).toFixed(2),
            payoutHistory: updatedHistory,
          };
        });
      })
      .catch(() => {});
  }, [walletOpen, activeToken]);
  const [privacyTermsTab, setPrivacyTermsTab] = useState<'privacy' | 'terms'>('privacy');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 5500);
  }, []);

  const refreshPassProofs = useCallback(async () => {
    try {
      const trackedIds = readStoredIds(LOCAL_STORAGE_KEY_PASS_PROOF_IDS);
      if (!activeToken && trackedIds.length === 0) {
        setPassProofs([]);
        return;
      }
      const query = trackedIds.length > 0 ? `?ids=${encodeURIComponent(trackedIds.join(','))}` : '';
      const res = await fetch(`/api/packages/my-proofs${query}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.proofs)) {
        setPassProofs(data.proofs);
      }
      if (data?.deactivated) {
        setPassBannedReason(
          data.deactivatedReason ||
            'Your account has been temporarily deactivated by Platform Owner. Contact Support (+254712727558) to restore access.'
        );
        setActivePackage(null);
        return;
      }

      if (data?.banned) {
        setPassBannedReason(
          data.bannedReason ||
            'Permanently banned 🚫 forever (no second chance) for violating M-PESA Worker Pass proof rules.'
        );
        setActivePackage(null);
        return;
      } else {
        setPassBannedReason(null);
      }

      if (data?.adminAssignedPass === 'free') {
        setActivePackage(null);
        return;
      }

      if (data?.adminAssignedPass && ['starter', 'pro', 'vip'].includes(data.adminAssignedPass)) {
        const assignedPkg = AVAILABLE_PACKAGES.find((p) => p.id === data.adminAssignedPass) || null;
        if (assignedPkg) {
          setActivePackage(assignedPkg);
        }
      }

      if (data?.approvedPackageId && data?.latestApprovedProof) {
        const approvedProof: CustomerPassProofItem = data.latestApprovedProof;
        const pkg = AVAILABLE_PACKAGES.find((p) => p.id === data.approvedPackageId) || null;
        if (pkg) {
          const alreadyUnlocked = readStoredIds(LOCAL_STORAGE_KEY_UNLOCKED_PROOFS).includes(approvedProof.id);
          if (!alreadyUnlocked) {
            appendStoredId(LOCAL_STORAGE_KEY_UNLOCKED_PROOFS, approvedProof.id);
            setActivePackage(pkg);
            try {
              confetti({ particleCount: 75, spread: 65, origin: { y: 0.6 } });
            } catch {}
            showNotification(
              `Owner Approved Your ${pkg.name}! ${approvedProof.ownerApprovalDetails || `M-PESA ${approvedProof.mpesaCode} confirmed. Tasks are now unlocked!`}`
            );
          } else {
            setActivePackage((curr) => curr || pkg);
          }
        }
      }
    } catch {
      // non-blocking network fallback
    }
  }, [activeToken, showNotification]);

  const submitManualPassProof: TaskContextType['submitManualPassProof'] = useCallback(
    async ({ packageId, senderPhone, mpesaCode, screenshotDataUrl, screenshotFileName }) => {
      try {
        const res = await fetch('/api/packages/manual-proof', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ea-country': selectedCountry.code,
            'x-ea-verified': 'true',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          body: JSON.stringify({
            packageId,
            senderPhone,
            mpesaCode,
            screenshotDataUrl,
            screenshotFileName,
            countryCode: selectedCountry.code,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          if (res.status === 403) {
            setPassBannedReason(data?.error || 'Account permanently banned 🚫 forever.');
            setActivePackage(null);
          }
          return {
            success: false,
            error: data?.error || 'Could not submit M-PESA Worker Pass proof.',
          };
        }
        if (data?.proof?.id) {
          appendStoredId(LOCAL_STORAGE_KEY_PASS_PROOF_IDS, data.proof.id);
        }
        await refreshPassProofs();
        showNotification(
          `M-PESA code ${mpesaCode.trim().toUpperCase()} & screenshot submitted! Worker Pass stays locked until the Owner verifies 0758727558 and sends approval details.`
        );
        return { success: true, proof: data.proof };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Network error submitting M-PESA proof.',
        };
      }
    },
    [activeToken, selectedCountry.code, refreshPassProofs, showNotification]
  );

  useEffect(() => {
    void refreshPassProofs();
  }, [refreshPassProofs]);

  useEffect(() => {
    const hasPending = passProofs.some((p) => p.status === 'Pending');
    if (!packagesModalOpen && !hasPending) return;
    const timer = window.setInterval(() => {
      void refreshPassProofs();
    }, 12000);
    return () => window.clearInterval(timer);
  }, [packagesModalOpen, passProofs, refreshPassProofs]);

  const openPrivacyTerms = (tab: 'privacy' | 'terms' = 'privacy') => {
    setPrivacyTermsTab(tab);
    setPrivacyTermsModalOpen(true);
  };

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_STATS, JSON.stringify(userStats));
    } catch (e) {
      console.error('Error saving user stats', e);
    }
  }, [userStats]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Error saving tasks', e);
    }
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(taskHistory));
    } catch (e) {
      console.error('Error saving task history', e);
    }
  }, [taskHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_PACKAGE, JSON.stringify(activePackage));
    } catch (e) {
      console.error('Error saving package', e);
    }
  }, [activePackage]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MEMES, JSON.stringify(memes));
    } catch (e) {
      console.error('Error saving memes', e);
    }
  }, [memes]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_REF_HISTORY, JSON.stringify(referralHistory));
    } catch (e) {
      console.error('Error saving referral history', e);
    }
  }, [referralHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_REF_STATS, JSON.stringify(referralStats));
    } catch (e) {
      console.error('Error saving referral stats', e);
    }
  }, [referralStats]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/user/tasks', {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          if (res.ok) {
            const dbTasks = await res.json();
            if (Array.isArray(dbTasks) && dbTasks.length > 0) {
              setTaskHistory((prev) => {
                const existingRefs = new Set(prev.map(p => p.transactionRef));
                const newItems: TaskHistoryRecord[] = dbTasks
                  .filter((d: any) => !existingRefs.has(d.transactionRef))
                  .map((d: any) => ({
                    id: `db-${d.id}`,
                    taskId: d.taskId,
                    taskTitle: d.taskTitle,
                    category: d.category,
                    reward: Math.min(Number(d.reward), MAX_TASK_REWARD_USD),
                    status: d.status,
                    completedAt: d.completedAt ? new Date(d.completedAt).toLocaleDateString() : 'Recent',
                    accuracyScore: Number(d.accuracyScore),
                    transactionRef: d.transactionRef
                  }));
                return [...newItems, ...prev];
              });
            }
          }
        } catch (err) {
          console.warn('Failed to fetch user tasks from Cloud SQL:', err);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Hydrate persistent server state on login/reload & prevent empty overwrites (Zero-Reset Guarantee)
  useEffect(() => {
    if (!activeToken) {
      hydratedTokenRef.current = null;
      return;
    }

    let cancelled = false;
    const tokenForReq = activeToken;

    fetch('/api/user/state', {
      headers: { Authorization: `Bearer ${tokenForReq}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data?.state) return;
        const remote = data.state;
        const remoteUid = String(remote.uid || currentUid || '');
        const lastUid = (() => {
          try {
            return localStorage.getItem(LOCAL_STORAGE_KEY_LAST_STATE_UID);
          } catch {
            return null;
          }
        })();
        const isSwitchingDifferentAccount = Boolean(lastUid && remoteUid && lastUid !== remoteUid);

        if (remoteUid) {
          try {
            localStorage.setItem(LOCAL_STORAGE_KEY_LAST_STATE_UID, remoteUid);
          } catch {}
        }

        const remoteStats = remote.userStats || {};
        setUserStats((prev) => {
          const mergedCompletedIds = isSwitchingDifferentAccount
            ? Array.from(new Set((remoteStats.completedTaskIds || []).filter(Boolean)))
            : Array.from(
                new Set([...(prev.completedTaskIds || []), ...(remoteStats.completedTaskIds || [])].filter(Boolean))
              );

          const payoutMap = new Map<string, PayoutRecord>();
          const rank = (s: string) => (s === 'Completed' ? 3 : s === 'Rejected' ? 2 : 1);
          const payoutSources = isSwitchingDifferentAccount
            ? remoteStats.payoutHistory || []
            : [...(prev.payoutHistory || []), ...(remoteStats.payoutHistory || [])];
          for (const p of payoutSources) {
            if (!p?.id) continue;
            const ex = payoutMap.get(p.id);
            if (!ex || rank(p.status) >= rank(ex.status)) {
              payoutMap.set(p.id, p);
            }
          }
          const mergedPayouts = Array.from(payoutMap.values());

          return {
            balance: isSwitchingDifferentAccount
              ? +(Number(remoteStats.balance) || 0).toFixed(4)
              : +Math.max(prev.balance, Number(remoteStats.balance) || 0).toFixed(4),
            pendingBalance: isSwitchingDifferentAccount
              ? +(Number(remoteStats.pendingBalance) || 0).toFixed(4)
              : +Math.max(prev.pendingBalance, Number(remoteStats.pendingBalance) || 0).toFixed(4),
            lifetimeEarned: isSwitchingDifferentAccount
              ? +(Number(remoteStats.lifetimeEarned) || 0).toFixed(4)
              : +Math.max(prev.lifetimeEarned, Number(remoteStats.lifetimeEarned) || 0).toFixed(4),
            completedTasksCount: isSwitchingDifferentAccount
              ? Number(remoteStats.completedTasksCount) || mergedCompletedIds.length
              : Math.max(prev.completedTasksCount, Number(remoteStats.completedTasksCount) || 0, mergedCompletedIds.length),
            qualityScore: Number(remoteStats.qualityScore || prev.qualityScore || 100),
            streakDays: isSwitchingDifferentAccount
              ? Number(remoteStats.streakDays) || 0
              : Math.max(prev.streakDays, Number(remoteStats.streakDays) || 0),
            lastLoginDate: remoteStats.lastLoginDate || prev.lastLoginDate || '',
            streakBonusMultiplier: Math.max(prev.streakBonusMultiplier || 0, Number(remoteStats.streakBonusMultiplier) || 0),
            sevenDayBonusAwarded: Boolean(
              isSwitchingDifferentAccount
                ? remoteStats.sevenDayBonusAwarded
                : prev.sevenDayBonusAwarded || remoteStats.sevenDayBonusAwarded
            ),
            tier: remoteStats.tier || prev.tier || 'Bronze',
            completedTaskIds: mergedCompletedIds as string[],
            payoutHistory: mergedPayouts,
          };
        });

        if (Array.isArray(remote.taskHistory)) {
          setTaskHistory((prev) => {
            const byKey = new Map<string, TaskHistoryRecord>();
            const source = isSwitchingDifferentAccount
              ? remote.taskHistory
              : [...prev, ...remote.taskHistory];
            for (const item of source) {
              if (!item?.taskId) continue;
              const k = item.id || `${item.taskId}::${item.completedAt}`;
              if (!byKey.has(k)) {
                byKey.set(k, {
                  ...item,
                  reward: Math.min(Number(item.reward) || 0, MAX_TASK_REWARD_USD),
                });
              }
            }
            return Array.from(byKey.values());
          });
        }

        if (Array.isArray(remote.referralHistory)) {
          setReferralHistory((prev) => {
            const byId = new Map<string, ReferralRecord>();
            const source = isSwitchingDifferentAccount
              ? remote.referralHistory
              : [...prev, ...remote.referralHistory];
            for (const r of source) {
              if (!r?.id) continue;
              const ex = byId.get(r.id);
              if (!ex || (Number(r.commissionEarned) || 0) >= (Number(ex.commissionEarned) || 0)) {
                byId.set(r.id, r);
              }
            }
            return Array.from(byId.values());
          });
        }

        if (remote.referralStats || typeof remote.vipReferralCount === 'number') {
          const rs = remote.referralStats || {};
          const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gideonglobal.com';
          setReferralStats((prev) => {
            const code = (rs.referralCode || prev.referralCode || 'GIDEON-EA-894').toUpperCase();
            return {
              ...prev,
              referralCode: code,
              referralLink: `${origin}/?ref=${code}`,
              totalClicks: isSwitchingDifferentAccount
                ? Number(rs.totalClicks) || 0
                : Math.max(prev.totalClicks, Number(rs.totalClicks) || 0),
              totalSignups: isSwitchingDifferentAccount
                ? Number(rs.totalSignups) || 0
                : Math.max(prev.totalSignups, Number(rs.totalSignups) || 0),
              passesPurchasedCount: isSwitchingDifferentAccount
                ? Number(rs.passesPurchasedCount) || 0
                : Math.max(prev.passesPurchasedCount, Number(rs.passesPurchasedCount) || 0),
              totalCommissionEarned: isSwitchingDifferentAccount
                ? +(Number(rs.totalCommissionEarned) || 0).toFixed(4)
                : +Math.max(prev.totalCommissionEarned, Number(rs.totalCommissionEarned) || 0).toFixed(4),
              pendingCommission: isSwitchingDifferentAccount
                ? +(Number(rs.pendingCommission) || 0).toFixed(4)
                : Math.max(prev.pendingCommission, Number(rs.pendingCommission) || 0),
              vipReferralCount: isSwitchingDifferentAccount
                ? Math.max(Number(remote.vipReferralCount) || 0, Number(rs.vipReferralCount) || 0)
                : Math.max(
                    prev.vipReferralCount || 0,
                    Number(remote.vipReferralCount) || 0,
                    Number(rs.vipReferralCount) || 0
                  ),
            };
          });
        }

        if (remote.dailyUsage) {
          const today = getTodayDateKey();
          if (remote.dailyUsage.dateKey === today) {
            setDailyUsage((prev) => {
              const prevCount = prev.dateKey === today ? prev.count : 0;
              const prevSurveys = prev.dateKey === today ? prev.surveyCount : 0;
              return {
                dateKey: today,
                count: isSwitchingDifferentAccount
                  ? Number(remote.dailyUsage.completedTodayCount) || 0
                  : Math.max(prevCount, Number(remote.dailyUsage.completedTodayCount) || 0),
                surveyCount: isSwitchingDifferentAccount
                  ? Number(remote.dailyUsage.surveysCompletedTodayCount) || 0
                  : Math.max(prevSurveys, Number(remote.dailyUsage.surveysCompletedTodayCount) || 0),
              };
            });
          }
        }

        if (remote.activePackageId) {
          const pkg = AVAILABLE_PACKAGES.find((p) => p.id === remote.activePackageId) || null;
          if (pkg) {
            setActivePackage((prev) => (isSwitchingDifferentAccount ? pkg : prev || pkg));
          }
        } else if (isSwitchingDifferentAccount) {
          setActivePackage(null);
        }

        hydratedTokenRef.current = tokenForReq;
      })
      .catch(() => {
        hydratedTokenRef.current = tokenForReq;
      });

    return () => {
      cancelled = true;
    };
  }, [activeToken, currentUid]);

  // Debounced background sync to persistent server ledger after hydration
  useEffect(() => {
    if (!activeToken || hydratedTokenRef.current !== activeToken) return;

    const timer = window.setTimeout(() => {
      fetch('/api/user/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          userStats,
          taskHistory,
          referralHistory,
          referralStats,
          dailyUsage: {
            dateKey: normalizedDailyUsage.dateKey,
            completedTodayCount: normalizedDailyUsage.count,
            surveysCompletedTodayCount: normalizedDailyUsage.surveyCount,
            earnedTodayUsd: 0,
          },
          activePackageId: activePackage?.id || null,
          vipReferralCount,
        }),
      }).catch(() => {});
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    activeToken,
    selectedCountry.code,
    userStats,
    taskHistory,
    referralHistory,
    referralStats,
    normalizedDailyUsage,
    activePackage?.id,
    vipReferralCount,
  ]);

  const clearNotification = () => setNotification(null);

  const processStreakAdvancement = (newDate: string) => {
    setUserStats((prev) => {
      const nextStreak = prev.streakDays + 1;
      let newBalance = prev.balance;
      let newLifetime = prev.lifetimeEarned;
      let newMultiplier = 0.10;
      let sevenDayAwarded = prev.sevenDayBonusAwarded;
      let bonusMessage = '';

      if (nextStreak === 7) {
        // 7-Day Streak Milestone Reward: Grant 5-unit bonus + 20% earnings multiplier!
        const bonusAmount = 5.0;
        newBalance = +(newBalance + bonusAmount).toFixed(4);
        newLifetime = +(newLifetime + bonusAmount).toFixed(4);
        newMultiplier = 0.20;
        sevenDayAwarded = true;
        bonusMessage = ` 🔥 7-DAY STREAK MILESTONE REACHED! Granted ${formatCurrencyFromUsd(bonusAmount, selectedCountry)} bonus + 20% earnings multiplier on all tasks!`;
        try {
          confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 } });
        } catch {}
      } else if (nextStreak > 7) {
        newMultiplier = 0.20;
        bonusMessage = ` 🔥 Streak extended to ${nextStreak} Days! (20% bonus active).`;
      } else {
        newMultiplier = 0.10;
        bonusMessage = ` Day ${nextStreak} logged in! Reach Day 7 to earn your ${formatCurrencyFromUsd(5.0, selectedCountry)} bonus!`;
      }

      showNotification(`Daily Streak Updated!${bonusMessage}`);

      return {
        ...prev,
        streakDays: nextStreak,
        balance: newBalance,
        lifetimeEarned: newLifetime,
        streakBonusMultiplier: newMultiplier,
        sevenDayBonusAwarded: sevenDayAwarded,
        lastLoginDate: newDate
      };
    });
  };

  const checkInDaily = () => {
    const today = new Date().toISOString().split('T')[0];
    if (userStats.lastLoginDate === today) {
      showNotification(`Already checked in today! Current Streak: ${userStats.streakDays} Days 🔥`);
      return;
    }
    processStreakAdvancement(today);
  };

  const advanceDailyStreak = () => {
    const nextDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    processStreakAdvancement(nextDate);
  };

  const purchasePackage = (
    packageId: 'starter' | 'pro' | 'vip',
    method: 'M-PESA' | 'Mobile Money' | 'Card' | 'Paystack Page',
    accountOrPhone: string
  ): boolean => {
    const pkg = AVAILABLE_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return false;

    if (String(method).toLowerCase().includes('wallet')) {
      showNotification(
        'Worker Passes must be purchased strictly by deposit (M-PESA 0758727558, Paystack STK, Card, or Mobile Money) — Wallet balance cannot be used.'
      );
      return false;
    }

    setActivePackage(pkg);
    recordPlatformTransaction({
      id: `PASS-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      kind: 'pass_purchase',
      title: `${pkg.name} (${formatCurrencyFromKes(pkg.priceKes, selectedCountry)})`,
      customerLabel: accountOrPhone || auth.currentUser?.email || 'East Africa Contributor',
      gatewayOrMethod: method,
      currency: selectedCountry.currency,
      amountLocal: pkg.priceKes,
      amountUsd: pkg.price,
      status: 'Completed',
      reference: `${method.toUpperCase()}-${pkg.id.toUpperCase()}`,
      metadata: { packageId: pkg.id, accountOrPhone },
    });
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {}

    showNotification(
      `Congratulations! ${pkg.name} (${formatCurrencyFromKes(pkg.priceKes, selectedCountry)}) activated via ${method} (${accountOrPhone}). Tasks unlocked!`
    );
    return true;
  };

  const completeTask = (taskId: string, rewardEarned: number, summaryTitle: string) => {
    const taskItem = tasks.find((t) => t.id === taskId);
    const taskCategory = taskItem?.category || 'micro';

    const eligibility = evaluateTaskEligibility({
      packageId: activePackage?.id || null,
      unlockedCategories: activePackage?.unlockedCategories,
      taskReward: rewardEarned,
      taskCategory,
      completedTodayCount: normalizedDailyUsage.count,
      surveysCompletedTodayCount: normalizedDailyUsage.surveyCount,
      isOwner,
      country: selectedCountry,
    });

    if (!eligibility.allowed) {
      showNotification(eligibility.reason || 'Daily task limit or tier cap reached. Upgrade your Worker Pass!');
      setPackagesModalOpen(true);
      return;
    }

    // 7-day streak grants a 20% bonus; normal streak grants 10% (strictly capped at 50 shillings / MAX_TASK_REWARD_USD)
    const bonusMultiplier = userStats.streakDays >= 7 ? 0.20 : userStats.streakDays > 0 ? 0.10 : 0;
    const finalBonusAmount = +(rewardEarned * bonusMultiplier).toFixed(4);
    const rawTotal = +(rewardEarned + finalBonusAmount).toFixed(4);
    const totalAward = isOwner
      ? rawTotal
      : +Math.min(rawTotal, eligibility.rule.maxAmountUsd, MAX_TASK_REWARD_USD).toFixed(4);

    const todayKey = getTodayDateKey();
    setDailyUsage((prev) => {
      const base = prev.dateKey === todayKey ? prev : { dateKey: todayKey, count: 0, surveyCount: 0 };
      return {
        dateKey: todayKey,
        count: base.count + 1,
        surveyCount: base.surveyCount + (taskCategory === 'survey' ? 1 : 0),
      };
    });

    // Append to Task History Record table
    const newHistoryRecord: TaskHistoryRecord = {
      id: `hist-${Date.now()}`,
      taskId,
      taskTitle: summaryTitle,
      category: taskCategory,
      reward: totalAward,
      status: 'Approved',
      completedAt: 'Just now',
      accuracyScore: 99.4,
      transactionRef: `TXN-${Math.floor(100000 + Math.random() * 900000)}`
    };

    setTaskHistory((prev) => [newHistoryRecord, ...prev]);

    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance + totalAward).toFixed(4),
      lifetimeEarned: +(prev.lifetimeEarned + totalAward).toFixed(4),
      completedTasksCount: prev.completedTasksCount + 1,
      completedTaskIds: [...prev.completedTaskIds, taskId]
    }));

    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? { ...t, spotsRemaining: Math.max(0, t.spotsRemaining - 1) }
          : t
      )
    );

    recordPlatformTransaction({
      id: newHistoryRecord.transactionRef,
      kind: 'task_reward',
      title: summaryTitle,
      customerLabel: auth.currentUser?.displayName || auth.currentUser?.email || 'East Africa Contributor',
      gatewayOrMethod: taskCategory.replace('-', ' ').toUpperCase(),
      currency: selectedCountry.currency,
      amountUsd: totalAward,
      status: 'Completed',
      reference: newHistoryRecord.transactionRef,
      metadata: { taskId, category: taskCategory, accuracyScore: 99.4 },
    });

    // Persist completed task record to Cloud SQL and Firestore if user is authenticated
    if (auth.currentUser) {
      const currentUid = auth.currentUser.uid;
      if (auth.currentUser.emailVerified) {
        const fsTaskId = `ct_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const fsPath = `completed_tasks/${fsTaskId}`;
        setDoc(doc(db, 'completed_tasks', fsTaskId), {
          userUid: currentUid.slice(0, 128),
          taskId: String(taskId).slice(0, 128),
          taskTitle: String(summaryTitle).slice(0, 200),
          category: String(taskCategory).slice(0, 64),
          reward: totalAward,
          status: 'Approved',
          completedAt: serverTimestamp()
        }).catch((err) => {
          if (isPermissionError(err)) {
            try {
              handleFirestoreError(err, OperationType.CREATE, fsPath);
            } catch (logged) {
              console.warn('Firestore completed task permission check:', logged);
            }
          } else {
            console.warn('Firestore completed task sync deferred (network):', (err as any)?.message || err);
          }
        });
      }

      auth.currentUser.getIdToken().then((token) => {
        fetch('/api/user/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            taskId,
            taskTitle: summaryTitle,
            category: taskCategory,
            reward: totalAward,
            packageId: activePackage?.id || 'free',
            status: 'Approved',
            accuracyScore: 99.4,
            transactionRef: newHistoryRecord.transactionRef
          })
        }).catch((err) => console.warn('Cloud SQL task record sync deferred:', err));
      }).catch((err) => console.warn('Could not get auth token for Cloud SQL sync:', err));
    } else {
      try {
        const customerToken = localStorage.getItem('gideon_customer_token_v1');
        if (customerToken) {
          fetch('/api/user/tasks', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${customerToken}`
            },
            body: JSON.stringify({
              taskId,
              taskTitle: summaryTitle,
              category: taskCategory,
              reward: totalAward,
              packageId: activePackage?.id || 'free',
              status: 'Approved',
              accuracyScore: 99.4,
              transactionRef: newHistoryRecord.transactionRef
            })
          }).catch(() => {});
        }
      } catch {}
    }

    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } catch {}

    const cappedNotice =
      !isOwner && totalAward < rawTotal
        ? ` (Capped at ${formatCurrencyFromKes(MAX_TASK_REWARD_KES, selectedCountry)} / 50 shillings max)`
        : '';
    showNotification(
      `Task Approved! Earned ${formatCurrencyFromUsd(totalAward, selectedCountry)}${cappedNotice} for ${summaryTitle}`
    );
  };

  const requestPayout = (amount: number, method: PayoutRecord['method'], details: string): boolean => {
    const minLocal = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
    if (amount < WITHDRAWAL_THRESHOLD_USD) {
      showNotification(`Withdrawals start from ${minLocal}. Continue completing tasks to reach ${minLocal}.`);
      return false;
    }

    if (amount > userStats.balance + 1e-4) {
      showNotification(
        `Payout failed: Requested amount exceeds available balance (${formatCurrencyFromUsd(userStats.balance, selectedCountry)}).`
      );
      return false;
    }

    if (!isOwner && !hasVipReferral) {
      showNotification(
        `Any of your referrals must have purchased the VIP Worker Pass of ${formatCurrencyFromKes(VIP_PASS_KES, selectedCountry)} before requesting a withdrawal.`
      );
      return false;
    }

    const isMpesa = method === 'M-PESA';
    const mpesaReceipt = isMpesa ? `MP${Math.random().toString(36).substring(2, 9).toUpperCase()}` : undefined;

    const newRecord: PayoutRecord = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: +amount.toFixed(4),
      method,
      accountDetails: details,
      status: 'Processing',
      timestamp: 'Just now',
      mpesaReceipt
    };

    setUserStats((prev) => ({
      ...prev,
      balance: +Math.max(0, prev.balance - amount).toFixed(4),
      payoutHistory: [newRecord, ...prev.payoutHistory]
    }));

    // Submit withdrawal to server-side Owner approval queue
    fetch('/api/withdrawals/request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-ea-country': selectedCountry.code,
        'x-ea-verified': 'true',
        ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
      },
      body: JSON.stringify({
        id: newRecord.id,
        amountUsd: amount,
        method,
        accountDetails: details,
        countryCode: selectedCountry.code,
        mpesaReceipt,
      }),
    }).catch(() => {});

    if (auth.currentUser?.emailVerified) {
      const wId = `wd_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const wPath = `withdrawals/${wId}`;
      const safeDetails = String(details || '').trim();
      const paddedDetails = (safeDetails.length >= 3 ? safeDetails : `${safeDetails || method} payout`).slice(0, 200);
      setDoc(doc(db, 'withdrawals', wId), {
        userUid: auth.currentUser.uid.slice(0, 128),
        amount: Number(amount),
        method,
        details: paddedDetails,
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }).catch((err) => {
        if (isPermissionError(err)) {
          try {
            handleFirestoreError(err, OperationType.CREATE, wPath);
          } catch (logged) {
            console.warn('Firestore withdrawal permission check:', logged);
          }
        } else {
          console.warn('Firestore withdrawal sync deferred (network):', (err as any)?.message || err);
        }
      });
    }

    showNotification(
      `Withdrawal of ${formatCurrencyFromUsd(amount, selectedCountry)} via ${method} initiated! ${isMpesa ? `(M-PESA confirmation code: ${mpesaReceipt})` : 'Processing queued.'}`
    );
    return true;
  };

  const postTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'spotsRemaining'>) => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (currentEmail !== OWNER_EMAIL || !auth.currentUser?.emailVerified) {
      showNotification(`Forbidden: Only ${OWNER_EMAIL} has authority to create or edit website tasks.`);
      return;
    }

    const created: Task = {
      ...newTaskData,
      id: `task-custom-${Date.now()}`,
      spotsRemaining: newTaskData.totalSpots,
      createdAt: 'Just now',
      requesterVerified: true
    };

    setTasks((prev) => [created, ...prev]);
    showNotification(`Task "${created.title}" published! Available to global contributors.`);
  };

  const updateTask = (taskId: string, updates: Partial<Task>): boolean => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (currentEmail !== OWNER_EMAIL || !auth.currentUser?.emailVerified) {
      showNotification(`Forbidden: Only ${OWNER_EMAIL} can edit platform tasks.`);
      return false;
    }
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t))
    );
    showNotification(`Task updated successfully.`);
    return true;
  };

  const deleteTask = (taskId: string): boolean => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (currentEmail !== OWNER_EMAIL || !auth.currentUser?.emailVerified) {
      showNotification(`Forbidden: Only ${OWNER_EMAIL} can delete platform tasks.`);
      return false;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showNotification(`Task permanently removed from marketplace.`);
    return true;
  };

  const upvoteMeme = (memeId: string) => {
    setMemes((prev) =>
      prev.map((m) => {
        if (m.id === memeId) {
          const isUpvoted = m.userUpvoted;
          return {
            ...m,
            upvotes: isUpvoted ? m.upvotes - 1 : m.upvotes + 1,
            userUpvoted: !isUpvoted
          };
        }
        return m;
      })
    );
  };

  const tipMeme = (memeId: string, amount: number): boolean => {
    if (userStats.balance < amount) {
      showNotification('Insufficient wallet balance to send tip.');
      return false;
    }

    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance - amount).toFixed(4)
    }));

    setMemes((prev) =>
      prev.map((m) =>
        m.id === memeId
          ? { ...m, tipsEarned: +(m.tipsEarned + amount).toFixed(4) }
          : m
      )
    );

    showNotification(`Sent ${formatCurrencyFromUsd(amount, selectedCountry)} micro-tip to meme creator!`);
    return true;
  };

  const addMeme = (newMeme: Omit<MemeItem, 'id' | 'createdAt' | 'upvotes' | 'tipsEarned'>) => {
    const createdMeme: MemeItem = {
      ...newMeme,
      id: `meme-${Date.now()}`,
      upvotes: 1,
      tipsEarned: 0,
      createdAt: 'Just now',
      userUpvoted: true
    };

    setMemes((prev) => [createdMeme, ...prev]);
    showNotification('Your meme has been published to the global community feed!');
  };

  const updateReferralCode = (newCode: string): boolean => {
    const cleaned = newCode.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!cleaned || cleaned.length < 3) {
      showNotification('Referral code must be at least 3 alphanumeric characters.');
      return false;
    }
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://gideonglobal.com';
    const newLink = `${origin}/?ref=${cleaned}`;
    setReferralStats((prev) => ({
      ...prev,
      referralCode: cleaned,
      referralLink: newLink
    }));
    showNotification(`Referral code updated to "${cleaned}"! Your unique link is ready to share.`);
    return true;
  };

  const simulateReferralPurchase = (
    passTier: 'starter' | 'pro' | 'vip' = 'pro',
    refereeName?: string,
    country?: string
  ) => {
    const CANDIDATES = [
      { name: 'David Kimani', email: 'da***ni@gmail.com', country: 'Kenya', method: 'M-PESA' as const },
      { name: 'Grace Namukasa', email: 'gr***sa@gmail.com', country: 'Uganda', method: 'Card' as const },
      { name: 'Asha Mwinyi', email: 'as***yi@gmail.com', country: 'Tanzania', method: 'M-PESA' as const },
      { name: 'Jean-Paul Habimana', email: 'jp***na@gmail.com', country: 'Rwanda', method: 'Card' as const },
      { name: 'Chantal Niyonkuru', email: 'ch***ru@gmail.com', country: 'Burundi', method: 'Card' as const },
      { name: 'Faith Wanjiku', email: 'fa***ku@yahoo.com', country: 'Kenya', method: 'M-PESA' as const },
      { name: 'Deng Kuol', email: 'de***ol@gmail.com', country: 'South Sudan', method: 'M-PESA' as const }
    ];

    const pick = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
    const chosenName = refereeName || pick.name;
    const chosenCountry = country || pick.country;
    const chosenEmail = pick.email;

    const passInfo =
      passTier === 'starter'
        ? { title: `Starter Contributor Pass (${formatCurrencyFromKes(50, selectedCountry)})`, price: convertKesToUsd(50), method: pick.method }
        : passTier === 'vip'
        ? { title: `VIP Taskmaster Pass (${formatCurrencyFromKes(200, selectedCountry)})`, price: convertKesToUsd(200), method: 'Card' as const }
        : { title: `Pro Tasker Pass (${formatCurrencyFromKes(100, selectedCountry)})`, price: convertKesToUsd(100), method: 'M-PESA' as const };

    // Standard 20% commission on worker passes purchased by referred users
    const rate = referralStats.commissionPercentage / 100;
    const earned = +(passInfo.price * rate).toFixed(4);

    // Instant credit to user's wallet and lifetime earnings!
    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance + earned).toFixed(4),
      lifetimeEarned: +(prev.lifetimeEarned + earned).toFixed(4)
    }));

    const newRecord: ReferralRecord = {
      id: `ref-tx-${Date.now()}`,
      packageId: passTier,
      refereeName: chosenName,
      refereeEmailMasked: chosenEmail,
      refereeCountry: chosenCountry,
      dateJoined: 'Just now',
      passPurchased: passInfo.title,
      passPrice: passInfo.price,
      commissionRate: rate,
      commissionEarned: earned,
      paymentMethod: passInfo.method,
      status: 'Credited',
      transactionId: `${passInfo.method}-REF-${Math.floor(10000 + Math.random() * 90000)}`
    };

    setReferralHistory((prev) => [newRecord, ...prev]);

    setReferralStats((prev) => ({
      ...prev,
      totalSignups: prev.totalSignups + 1,
      passesPurchasedCount: prev.passesPurchasedCount + 1,
      totalCommissionEarned: +(prev.totalCommissionEarned + earned).toFixed(4),
      vipReferralCount: (prev.vipReferralCount || 0) + (passTier === 'vip' ? 1 : 0)
    }));

    recordPlatformTransaction({
      id: newRecord.transactionId,
      kind: 'referral_commission',
      title: `20% Referral Commission · ${passInfo.title}`,
      customerLabel: `${chosenName} (${chosenCountry})`,
      gatewayOrMethod: passInfo.method,
      currency: selectedCountry.currency,
      amountUsd: earned,
      status: 'Completed',
      reference: newRecord.transactionId,
      metadata: { passTier, refereeCountry: chosenCountry },
    });

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {}

    showNotification(
      `🎉 Referral Commission! ${chosenName} bought a ${passInfo.title}. +${formatCurrencyFromUsd(earned, selectedCountry)} added directly to your wallet!`
    );
  };

  return (
    <TaskContext.Provider
      value={{
        tasks,
        userStats,
        taskHistory,
        referralHistory,
        referralStats,
        vipReferralCount,
        hasVipReferral,
        updateReferralCode,
        simulateReferralPurchase,
        activePackage,
        packagesModalOpen,
        setPackagesModalOpen,
        purchasePackage,
        dailyQuotaStatus,
        passProofs,
        passBannedReason,
        refreshPassProofs,
        submitManualPassProof,
        streakModalOpen,
        setStreakModalOpen,
        advanceDailyStreak,
        checkInDaily,
        themeColor,
        setThemeColor,
        memes,
        leaderboard,
        activeTab,
        setActiveTab,
        workerMode,
        setWorkerMode,
        selectedTask,
        setSelectedTask,
        walletOpen,
        setWalletOpen,
        postTaskModalOpen,
        setPostTaskModalOpen,
        completeTask,
        requestPayout,
        postTask,
        updateTask,
        deleteTask,
        upvoteMeme,
        tipMeme,
        addMeme,
        notification,
        showNotification,
        clearNotification,
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
      }}
    >
      {children}
    </TaskContext.Provider>
  );
};

export const useTasks = () => {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error('useTasks must be used within a TaskProvider');
  }
  return context;
};
