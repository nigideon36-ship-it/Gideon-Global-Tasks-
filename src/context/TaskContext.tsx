import React, { createContext, useContext, useState, useEffect } from 'react';
import { Task, PayoutRecord, MemeItem, LeaderboardUser, TaskHistoryRecord, TaskPackage, ReferralRecord, ReferralStats } from '../types/tasks';
import { INITIAL_TASKS, INITIAL_MEMES, INITIAL_LEADERBOARD } from '../data/mockTasks';
import confetti from 'canvas-confetti';
import { auth } from '../lib/firebase';

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
    price: 2.00,
    description: 'Entry-level pass to begin completing verified paid surveys and fast micro tasks.',
    taskAllowance: '25 Tasks / Day',
    unlockedCategories: ['survey', 'micro'],
    features: [
      'Access to Market Research Surveys',
      'Micro Tasks & Instant Usability Polls',
      'Standard Verification Queue',
      'Community Meme Voting & Feed'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Tasker Pass',
    price: 5.00,
    isPopular: true,
    description: 'Unlocks AI Computer Vision Annotation, Receipt Digitization, and Meme Bounties.',
    taskAllowance: '75 Tasks / Day',
    unlockedCategories: ['survey', 'annotation', 'data-entry', 'meme-content', 'micro'],
    features: [
      'Everything in Starter',
      'Autonomous Driving Bounding Box Annotation',
      'Receipt & Invoice OCR Extraction Suite',
      'Gideon Meme Studio Bounty Publishing',
      '2x Daily Streak Multiplier Bonus'
    ]
  },
  {
    id: 'vip',
    name: 'VIP Taskmaster Pass',
    price: 10.00,
    description: 'Full platform access with unlimited daily tasks, high-paying copywriting, and zero fees.',
    taskAllowance: 'Unlimited Daily Tasks',
    unlockedCategories: ['survey', 'annotation', 'data-entry', 'writing', 'meme-content', 'micro'],
    features: [
      'Everything in Pro',
      'High-Paying Writing & Copywriting ($5–$15+)',
      'Unlimited Daily Task Quota',
      '0% Fee Guarantee on $100+ Withdrawals',
      'Instant M-PESA STK & Wise Priority Disbursement',
      'Dedicated 24/7 AI Taskmaster Support'
    ]
  }
];

const INITIAL_TASK_HISTORY: TaskHistoryRecord[] = [
  {
    id: 'hist-1',
    taskId: 'task-anno-101',
    taskTitle: 'Autonomous Driving CV: Tag Vehicles & Pedestrians',
    category: 'annotation',
    reward: 4.50,
    status: 'Approved',
    completedAt: 'Today at 08:35 AM',
    accuracyScore: 99.4,
    transactionRef: 'TXN-984102'
  },
  {
    id: 'hist-2',
    taskId: 'task-entry-201',
    taskTitle: 'Apex Tech Retail Receipt Digitization & Extraction',
    category: 'data-entry',
    reward: 3.40,
    status: 'Approved',
    completedAt: 'Yesterday at 04:15 PM',
    accuracyScore: 100.0,
    transactionRef: 'TXN-983210'
  },
  {
    id: 'hist-3',
    taskId: 'task-surv-301',
    taskTitle: 'Global Remote Work & AI Tooling Survey 2026',
    category: 'survey',
    reward: 2.80,
    status: 'Approved',
    completedAt: '2 days ago',
    accuracyScore: 98.8,
    transactionRef: 'TXN-981045'
  },
  {
    id: 'hist-4',
    taskId: 'task-write-501',
    taskTitle: 'Product Copywriting: "HyperCharge 140W GaN Hub"',
    category: 'writing',
    reward: 5.50,
    status: 'Approved',
    completedAt: '3 days ago',
    accuracyScore: 99.1,
    transactionRef: 'TXN-979920'
  },
  {
    id: 'hist-5',
    taskId: 'task-micro-601',
    taskTitle: 'Rapid A/B Usability Poll: Fintech Dark Mode Button',
    category: 'micro',
    reward: 0.75,
    status: 'Approved',
    completedAt: '4 days ago',
    accuracyScore: 100.0,
    transactionRef: 'TXN-976451'
  }
];

const INITIAL_REFERRAL_HISTORY: ReferralRecord[] = [
  {
    id: 'ref-tx-101',
    refereeName: 'Kwame Mensah',
    refereeEmailMasked: 'kw***ah@gmail.com',
    refereeCountry: 'Ghana',
    dateJoined: 'Yesterday',
    passPurchased: 'Pro Tasker Pass ($5)',
    passPrice: 5.00,
    commissionRate: 0.20,
    commissionEarned: 1.00,
    paymentMethod: 'M-PESA',
    status: 'Credited',
    transactionId: 'MPESA-REF-71829'
  },
  {
    id: 'ref-tx-102',
    refereeName: 'Elena Rostova',
    refereeEmailMasked: 'el***va@proton.me',
    refereeCountry: 'Poland',
    dateJoined: '2 days ago',
    passPurchased: 'VIP Taskmaster Pass ($10)',
    passPrice: 10.00,
    commissionRate: 0.20,
    commissionEarned: 2.00,
    paymentMethod: 'Card',
    status: 'Credited',
    transactionId: 'CARD-REF-99214'
  },
  {
    id: 'ref-tx-103',
    refereeName: 'Brian Otieno',
    refereeEmailMasked: 'br***no@yahoo.com',
    refereeCountry: 'Kenya',
    dateJoined: '4 days ago',
    passPurchased: 'Starter Contributor Pass ($2)',
    passPrice: 2.00,
    commissionRate: 0.20,
    commissionEarned: 0.40,
    paymentMethod: 'M-PESA',
    status: 'Credited',
    transactionId: 'MPESA-REF-58319'
  },
  {
    id: 'ref-tx-104',
    refereeName: 'Sofia Ramos',
    refereeEmailMasked: 'so***os@hotmail.com',
    refereeCountry: 'Brazil',
    dateJoined: '5 days ago',
    passPurchased: 'Pro Tasker Pass ($5)',
    passPrice: 5.00,
    commissionRate: 0.20,
    commissionEarned: 1.00,
    paymentMethod: 'Card',
    status: 'Credited',
    transactionId: 'CARD-REF-34812'
  }
];

const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://gideonglobal.com';

const INITIAL_REFERRAL_STATS: ReferralStats = {
  referralCode: 'GIDEON-GLOBAL-894',
  referralLink: `${APP_ORIGIN}/?ref=GIDEON-GLOBAL-894`,
  totalClicks: 142,
  totalSignups: 19,
  passesPurchasedCount: 4,
  totalCommissionEarned: 4.40,
  pendingCommission: 0.00,
  commissionPercentage: 20,
  vipTierBonusPercent: 5
};

export type PlatformTab =
  | 'tasks'
  | 'task-history'
  | 'referrals'
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
  updateReferralCode: (newCode: string) => boolean;
  simulateReferralPurchase: (passTier?: 'starter' | 'pro' | 'vip', refereeName?: string, country?: string) => void;
  activePackage: TaskPackage | null;
  packagesModalOpen: boolean;
  setPackagesModalOpen: (open: boolean) => void;
  purchasePackage: (packageId: 'starter' | 'pro' | 'vip', method: 'M-PESA' | 'PayPal' | 'Card' | 'Wallet', accountOrPhone: string) => boolean;
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
  upvoteMeme: (memeId: string) => void;
  tipMeme: (memeId: string, amount: number) => boolean;
  addMeme: (meme: Omit<MemeItem, 'id' | 'createdAt' | 'upvotes' | 'tipsEarned'>) => void;
  notification: string | null;
  clearNotification: () => void;
  publisherModalOpen: boolean;
  setPublisherModalOpen: (open: boolean) => void;
  darajaModalOpen: boolean;
  setDarajaModalOpen: (open: boolean) => void;
  intasendModalOpen: boolean;
  setIntasendModalOpen: (open: boolean) => void;
  paypalModalOpen: boolean;
  setPaypalModalOpen: (open: boolean) => void;
  privacyTermsModalOpen: boolean;
  setPrivacyTermsModalOpen: (open: boolean) => void;
  privacyTermsTab: 'privacy' | 'terms';
  openPrivacyTerms: (tab?: 'privacy' | 'terms') => void;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_STATS = 'gideon_global_user_stats';
const LOCAL_STORAGE_KEY_TASKS = 'gideon_global_tasks';
const LOCAL_STORAGE_KEY_MEMES = 'gideon_global_memes';
const LOCAL_STORAGE_KEY_HISTORY = 'gideon_global_history';
const LOCAL_STORAGE_KEY_PACKAGE = 'gideon_global_package';
const LOCAL_STORAGE_KEY_REF_HISTORY = 'gideon_global_ref_history';
const LOCAL_STORAGE_KEY_REF_STATS = 'gideon_global_ref_stats';

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
      return saved ? JSON.parse(saved) : INITIAL_TASKS;
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [userStats, setUserStats] = useState<UserStatsType>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_STATS);
      if (saved) return JSON.parse(saved);
    } catch {
      // fallback
    }
    const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    return {
      balance: 114.50, // Starting above 100 so user can immediately test $100+ withdrawals!
      pendingBalance: 12.25,
      lifetimeEarned: 382.80,
      completedTasksCount: 37,
      qualityScore: 99.4,
      streakDays: 6, // Starting on day 6 so user can test advancing to Day 7 milestone!
      lastLoginDate: yesterdayStr,
      streakBonusMultiplier: 0.10,
      sevenDayBonusAwarded: false,
      tier: 'Gold' as const,
      completedTaskIds: [] as string[],
      payoutHistory: [
        {
          id: 'PAY-9418',
          amount: 120.00,
          method: 'M-PESA' as const,
          accountDetails: '+254 712 345 678',
          status: 'Completed' as const,
          timestamp: '2 days ago',
          mpesaReceipt: 'QJH89K2P0L'
        },
        {
          id: 'PAY-8310',
          amount: 100.00,
          method: 'Wise' as const,
          accountDetails: 'elena.rostova@wise.com',
          status: 'Completed' as const,
          timestamp: '1 week ago'
        }
      ] as PayoutRecord[]
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
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_PACKAGE);
      return saved ? JSON.parse(saved) : AVAILABLE_PACKAGES[2]; // default to VIP Taskmaster
    } catch {
      return AVAILABLE_PACKAGES[2];
    }
  });

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
    return 'emerald'; // Default theme color refreshed to Emerald Fintech
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
    if (target === 'task-history') return 'task-history';
    if (target === 'referrals') return 'referrals';
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

  const [workerMode, setWorkerMode] = useState<'worker' | 'requester'>('worker');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [packagesModalOpen, setPackagesModalOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [postTaskModalOpen, setPostTaskModalOpen] = useState(false);
  const [publisherModalOpen, setPublisherModalOpen] = useState(false);
  const [darajaModalOpen, setDarajaModalOpen] = useState(false);
  const [intasendModalOpen, setIntasendModalOpen] = useState(false);
  const [paypalModalOpen, setPaypalModalOpen] = useState(false);
  const [privacyTermsModalOpen, setPrivacyTermsModalOpen] = useState(false);
  const [privacyTermsTab, setPrivacyTermsTab] = useState<'privacy' | 'terms'>('privacy');
  const [notification, setNotification] = useState<string | null>(null);

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
                    reward: Number(d.reward),
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

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 4500);
  };

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
        // 7-Day Streak Milestone Reward: Grant $5.00 cash bonus + 20% earnings multiplier!
        const bonusAmount = 5.00;
        newBalance = +(newBalance + bonusAmount).toFixed(2);
        newLifetime = +(newLifetime + bonusAmount).toFixed(2);
        newMultiplier = 0.20;
        sevenDayAwarded = true;
        bonusMessage = ' 🔥 7-DAY STREAK MILESTONE REACHED! Granted $5.00 cash bonus + 20% earnings multiplier on all tasks!';
        try {
          confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 } });
        } catch {}
      } else if (nextStreak > 7) {
        newMultiplier = 0.20;
        bonusMessage = ` 🔥 Streak extended to ${nextStreak} Days! (20% bonus active).`;
      } else {
        newMultiplier = 0.10;
        bonusMessage = ` Day ${nextStreak} logged in! Reach Day 7 to earn your $5.00 bonus!`;
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

  const purchasePackage = (packageId: 'starter' | 'pro' | 'vip', method: 'M-PESA' | 'PayPal' | 'Card' | 'Wallet', accountOrPhone: string): boolean => {
    const pkg = AVAILABLE_PACKAGES.find((p) => p.id === packageId);
    if (!pkg) return false;

    if (method === 'Wallet') {
      if (userStats.balance < pkg.price) {
        showNotification(`Insufficient wallet balance ($${userStats.balance.toFixed(2)}) for $${pkg.price.toFixed(2)} pass.`);
        return false;
      }
      setUserStats((prev) => ({
        ...prev,
        balance: +(prev.balance - pkg.price).toFixed(2)
      }));
    }

    setActivePackage(pkg);
    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {}

    showNotification(
      `Congratulations! ${pkg.name} ($${pkg.price}) activated via ${method} (${accountOrPhone}). Tasks unlocked!`
    );
    return true;
  };

  const completeTask = (taskId: string, rewardEarned: number, summaryTitle: string) => {
    // 7-day streak grants a 20% bonus; normal streak grants 10%
    const bonusMultiplier = userStats.streakDays >= 7 ? 0.20 : userStats.streakDays > 0 ? 0.10 : 0;
    const finalBonusAmount = +(rewardEarned * bonusMultiplier).toFixed(2);
    const totalAward = +(rewardEarned + finalBonusAmount).toFixed(2);

    const taskItem = tasks.find((t) => t.id === taskId);
    const taskCategory = taskItem?.category || 'micro';

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
      balance: +(prev.balance + totalAward).toFixed(2),
      lifetimeEarned: +(prev.lifetimeEarned + totalAward).toFixed(2),
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

    // Persist completed task record to Cloud SQL if user is authenticated
    if (auth.currentUser) {
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
            status: 'Approved',
            accuracyScore: 99.4,
            transactionRef: newHistoryRecord.transactionRef
          })
        }).catch((err) => console.warn('Cloud SQL task record sync deferred:', err));
      }).catch((err) => console.warn('Could not get auth token for Cloud SQL sync:', err));
    }

    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } catch {}

    showNotification(
      `Task Approved! Earned $${totalAward.toFixed(2)} (${finalBonusAmount > 0 ? `includes $${finalBonusAmount.toFixed(2)} (${(bonusMultiplier * 100).toFixed(0)}% streak bonus)` : ''}) for ${summaryTitle}`
    );
  };

  const requestPayout = (amount: number, method: PayoutRecord['method'], details: string): boolean => {
    if (amount < 100) {
      showNotification('Withdrawals start from $100.00. Continue completing tasks to reach the $100 cash-out milestone!');
      return false;
    }

    if (amount > userStats.balance) {
      showNotification(`Payout failed: Requested amount exceeds available balance ($${userStats.balance.toFixed(2)}).`);
      return false;
    }

    const isMpesa = method === 'M-PESA';
    const mpesaReceipt = isMpesa ? `MP${Math.random().toString(36).substring(2, 9).toUpperCase()}` : undefined;

    const newRecord: PayoutRecord = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      amount,
      method,
      accountDetails: details,
      status: 'Processing',
      timestamp: 'Just now',
      mpesaReceipt
    };

    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance - amount).toFixed(2),
      payoutHistory: [newRecord, ...prev.payoutHistory]
    }));

    showNotification(
      `Withdrawal of $${amount.toFixed(2)} via ${method} initiated! ${isMpesa ? `(M-PESA confirmation code: ${mpesaReceipt})` : 'Processing queued.'}`
    );
    return true;
  };

  const postTask = (newTaskData: Omit<Task, 'id' | 'createdAt' | 'spotsRemaining'>) => {
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
      balance: +(prev.balance - amount).toFixed(2)
    }));

    setMemes((prev) =>
      prev.map((m) =>
        m.id === memeId
          ? { ...m, tipsEarned: +(m.tipsEarned + amount).toFixed(2) }
          : m
      )
    );

    showNotification(`Sent $${amount.toFixed(2)} micro-tip to meme creator!`);
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
      { name: 'Maria Santos', email: 'ma***os@gmail.com', country: 'Philippines', method: 'Card' as const },
      { name: 'Jean-Luc Dubois', email: 'jl***is@outlook.fr', country: 'France', method: 'Card' as const },
      { name: 'Ananya Sharma', email: 'an***ma@gmail.com', country: 'India', method: 'Card' as const },
      { name: 'Mateo Morales', email: 'ma***es@colombia.co', country: 'Colombia', method: 'Card' as const },
      { name: 'Faith Wanjiku', email: 'fa***ku@yahoo.com', country: 'Kenya', method: 'M-PESA' as const },
      { name: 'Amara Okafor', email: 'am***or@gmail.com', country: 'Nigeria', method: 'Card' as const }
    ];

    const pick = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
    const chosenName = refereeName || pick.name;
    const chosenCountry = country || pick.country;
    const chosenEmail = pick.email;

    const passInfo =
      passTier === 'starter'
        ? { title: 'Starter Contributor Pass ($2)', price: 2.00, method: pick.method }
        : passTier === 'vip'
        ? { title: 'VIP Taskmaster Pass ($10)', price: 10.00, method: 'Card' as const }
        : { title: 'Pro Tasker Pass ($5)', price: 5.00, method: 'M-PESA' as const };

    // Standard 20% commission on worker passes purchased by referred users
    const rate = referralStats.commissionPercentage / 100;
    const earned = +(passInfo.price * rate).toFixed(2);

    // Instant credit to user's wallet and lifetime earnings!
    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance + earned).toFixed(2),
      lifetimeEarned: +(prev.lifetimeEarned + earned).toFixed(2)
    }));

    const newRecord: ReferralRecord = {
      id: `ref-tx-${Date.now()}`,
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
      totalCommissionEarned: +(prev.totalCommissionEarned + earned).toFixed(2)
    }));

    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });
    } catch {}

    showNotification(
      `🎉 Referral Commission! ${chosenName} bought a ${passInfo.title}. +$${earned.toFixed(2)} added directly to your wallet!`
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
        updateReferralCode,
        simulateReferralPurchase,
        activePackage,
        packagesModalOpen,
        setPackagesModalOpen,
        purchasePackage,
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
        upvoteMeme,
        tipMeme,
        addMeme,
        notification,
        clearNotification,
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
