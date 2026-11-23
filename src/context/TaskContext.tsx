import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Task, PayoutRecord, MemeItem, LeaderboardUser, TaskHistoryRecord, ReferralRecord, ReferralStats } from '../types/tasks';
import { INITIAL_TASKS, INITIAL_MEMES, INITIAL_LEADERBOARD } from '../data/mockTasks';
import confetti from 'canvas-confetti';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, OperationType, handleFirestoreError, isPermissionError } from '../lib/firebase';
import { OWNER_EMAIL, useAuth } from './AuthContext';
import { useRegion } from './RegionContext';
import {
  evaluateTaskEligibility,
  formatCountdownHms,
  getDailyDroppedTaskId,
  getEatNowInfo,
  getTodayDateKey,
  OPEN_ACCESS_DAILY_LIMIT,
  OPEN_ACCESS_QUOTA_RULE,
  type QuotaRule,
  type TaskEligibilityResult,
} from '../lib/taskEligibility';
import {
  WITHDRAWAL_THRESHOLD_KES,
  WITHDRAWAL_THRESHOLD_USD,
  meetsWithdrawalThreshold,
  convertKesToUsd,
  formatCurrencyFromUsd,
} from '../lib/eastAfrica';
import { CANONICAL_PLATFORM_ORIGIN } from '../utils/platformUrl';

export type KycVerificationStatus = 'Not Submitted' | 'Pending' | 'Approved' | 'Rejected';

export interface KycRecordClient {
  uid: string;
  countryCode: string;
  idDocumentName: string;
  fullNameOnId: string;
  idNumber: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  status: Exclude<KycVerificationStatus, 'Not Submitted'>;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
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

const INITIAL_TASK_HISTORY: TaskHistoryRecord[] = [];
const INITIAL_REFERRAL_HISTORY: ReferralRecord[] = [];
const APP_ORIGIN = CANONICAL_PLATFORM_ORIGIN;

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
  vipReferralCount: 0,
};

export type PlatformTab =
  | 'tasks'
  | 'dashboard'
  | 'task-history'
  | 'referrals'
  | 'investments'
  | 'auctions'
  | 'pay-per-view'
  | 'testimonials'
  | 'meme-studio'
  | 'ai-media'
  | 'three-globe'
  | 'game'
  | 'maps-explorer'
  | 'leaderboard'
  | 'employer'
  | 'wallet'
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
  simulateReferralActivity: (refereeName?: string, country?: string) => void;
  dailyQuotaStatus: {
    rule: QuotaRule;
    usedToday: number;
    surveysUsedToday: number;
    remainingToday: number;
    canDoTask: (task: Task) => TaskEligibilityResult;
  };
  dailyDropInfo: {
    dateKey: string;
    isDropWindowOpen: boolean;
    msUntilNextDrop: number;
    countdownLabel: string;
    countdownHours: string;
    countdownMinutes: string;
    countdownSeconds: string;
    eatTimeLabel: string;
    nextDropLabel: string;
    droppedTaskId: string | null;
    droppedTask: Task | null;
    dropRefreshTick: number;
  };
  kycStatus: KycVerificationStatus;
  kycRecord: KycRecordClient | null;
  kycLoading: boolean;
  refreshKycStatus: () => Promise<void>;
  submitKycVerification: (params: {
    countryCode: string;
    fullNameOnId: string;
    idNumber: string;
    frontImageDataUrl: string;
    backImageDataUrl: string;
  }) => Promise<{ success: boolean; error?: string; message?: string }>;
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
  privacyTermsModalOpen: boolean;
  setPrivacyTermsModalOpen: (open: boolean) => void;
  privacyTermsTab: 'privacy' | 'terms';
  openPrivacyTerms: (tab?: 'privacy' | 'terms') => void;
  syncWalletFromServer: () => Promise<void>;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY_STATS = 'gideon_global_user_stats_v2';
const LOCAL_STORAGE_KEY_TASKS = 'gideon_global_tasks';
const LOCAL_STORAGE_KEY_MEMES = 'gideon_global_memes';
const LOCAL_STORAGE_KEY_HISTORY = 'gideon_global_history_v2';
const LOCAL_STORAGE_KEY_DAILY_QUOTA = 'gideon_daily_task_usage_v1';
const LOCAL_STORAGE_KEY_REF_HISTORY = 'gideon_global_ref_history_v2';
const LOCAL_STORAGE_KEY_REF_STATS = 'gideon_global_ref_stats_v2';
const LOCAL_STORAGE_KEY_LAST_STATE_UID = 'gideon_last_state_uid_v1';
const LOCAL_STORAGE_KEY_PENDING_REF_CODE = 'gideon_pending_ref_code_v1';
const LOCAL_STORAGE_KEY_KYC_PREFIX = 'gideon_kyc_backup_v1_';

interface KycLocalBackup {
  status: KycVerificationStatus;
  record: KycRecordClient | null;
  savedAt: string;
}

function readLocalKycBackup(uid?: string | null): KycLocalBackup | null {
  if (!uid) return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_KYC_PREFIX}${uid}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.status && parsed.status !== 'Not Submitted') {
      return parsed as KycLocalBackup;
    }
    return null;
  } catch {
    return null;
  }
}

function writeLocalKycBackup(
  uid: string | null | undefined,
  status: KycVerificationStatus,
  record: KycRecordClient | null
) {
  if (!uid || status === 'Not Submitted') return;
  try {
    const existing = readLocalKycBackup(uid);
    const mergedRecord = record
      ? {
          ...record,
          frontImageDataUrl: record.frontImageDataUrl || existing?.record?.frontImageDataUrl || '',
          backImageDataUrl: record.backImageDataUrl || existing?.record?.backImageDataUrl || '',
        }
      : existing?.record || null;
    const payload: KycLocalBackup = {
      status,
      record: mergedRecord,
      savedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${LOCAL_STORAGE_KEY_KYC_PREFIX}${uid}`, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

async function computeSha256HexClient(text: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoded = new TextEncoder().encode(text);
      const buf = await crypto.subtle.digest('SHA-256', encoded);
      return Array.from(new Uint8Array(buf))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {}
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${Math.abs(hash).toString(16).padStart(8, '0')}_${text.length}`.padEnd(32, '0');
}

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

export const TaskProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_TASKS);
      if (!saved) return INITIAL_TASKS;
      const parsed: Task[] = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_TASKS;
      const savedById = new Map(parsed.map((t) => [t.id, t]));
      const builtInIds = new Set(INITIAL_TASKS.map((t) => t.id));
      const syncedBuiltIns = INITIAL_TASKS.map((builtIn) => {
        const cached = savedById.get(builtIn.id);
        return cached
          ? {
              ...builtIn,
              reward: builtIn.reward,
              spotsRemaining: cached.spotsRemaining ?? builtIn.spotsRemaining,
            }
          : builtIn;
      });
      const customTasks = parsed
        .filter((t) => !builtInIds.has(t.id))
        .map((t) => ({ ...t, reward: Math.max(0.01, Number(t.reward) || 0.25) }));
      return [...syncedBuiltIns, ...customTasks];
    } catch {
      return INITIAL_TASKS;
    }
  });

  const [userStats, setUserStats] = useState<UserStatsType>(() => {
    try {
      localStorage.removeItem('gideon_global_user_stats');
      localStorage.removeItem('gideon_global_package');
      localStorage.removeItem('gideon_global_package_v2');
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY_STATS);
      if (saved) return JSON.parse(saved);
    } catch {}
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

  const [dailyUsage, setDailyUsage] = useState<DailyUsageState>(() => readTodayUsage());
  const [kycStatus, setKycStatus] = useState<KycVerificationStatus>('Not Submitted');
  const [kycRecord, setKycRecord] = useState<KycRecordClient | null>(null);
  const [kycLoading, setKycLoading] = useState(false);

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
    return 'cobalt';
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
    const target = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
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
    if (target === 'auctions') return 'auctions';
    if (target === 'pay-per-view' || target === 'ppv') return 'pay-per-view';
    if (target === 'testimonials') return 'testimonials';
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

  const { activeToken, getFreshToken, isOwner, user, customerProfile, loading: authLoading } = useAuth();
  const { selectedCountry } = useRegion();

  const hydratedTokenRef = useRef<string | null>(null);
  const currentUid = user?.uid || customerProfile?.uid || null;

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref')?.trim().toUpperCase();
      if (ref && ref.length >= 3) {
        localStorage.setItem(LOCAL_STORAGE_KEY_PENDING_REF_CODE, ref);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_DAILY_QUOTA, JSON.stringify(dailyUsage));
    } catch {}
  }, [dailyUsage]);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [dropRefreshTick, setDropRefreshTick] = useState<number>(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNowMs(Date.now());
    }, 500);
    return () => window.clearInterval(timer);
  }, []);

  const currentEatDate = useMemo(() => new Date(nowMs), [nowMs]);
  const eatInfo = useMemo(() => getEatNowInfo(currentEatDate), [currentEatDate]);

  const droppedTaskId = useMemo(
    () => getDailyDroppedTaskId(tasks, currentEatDate),
    [tasks, eatInfo.dateKey, dropRefreshTick]
  );

  const droppedTask = useMemo(
    () => (droppedTaskId ? tasks.find((t) => t.id === droppedTaskId) || null : null),
    [tasks, droppedTaskId]
  );

  const countdownParts = useMemo(() => {
    const formatted = formatCountdownHms(eatInfo.msUntilNextDrop);
    const [hours = '00', minutes = '00', seconds = '00'] = formatted.split(':');
    return { formatted, hours, minutes, seconds };
  }, [eatInfo.msUntilNextDrop]);

  const dailyDropInfo = useMemo(
    () => ({
      dateKey: eatInfo.dateKey,
      isDropWindowOpen: eatInfo.isDropWindowOpen,
      msUntilNextDrop: eatInfo.msUntilNextDrop,
      countdownLabel: countdownParts.formatted,
      countdownHours: countdownParts.hours,
      countdownMinutes: countdownParts.minutes,
      countdownSeconds: countdownParts.seconds,
      eatTimeLabel: eatInfo.eatTimeLabel,
      nextDropLabel: eatInfo.nextDropLabel,
      droppedTaskId,
      droppedTask,
      dropRefreshTick,
    }),
    [eatInfo, countdownParts, droppedTaskId, droppedTask, dropRefreshTick]
  );

  const normalizedDailyUsage = useMemo(() => {
    const today = eatInfo.dateKey;
    return dailyUsage.dateKey === today ? dailyUsage : { dateKey: today, count: 0, surveyCount: 0 };
  }, [dailyUsage, eatInfo.dateKey]);

  const dailyQuotaStatus = useMemo(() => {
    const usedToday = normalizedDailyUsage.count;
    const surveysUsedToday = normalizedDailyUsage.surveyCount;
    const remainingToday = Math.max(0, OPEN_ACCESS_DAILY_LIMIT - usedToday);

    const canDoTask = (task: Task): TaskEligibilityResult =>
      evaluateTaskEligibility({
        taskId: task.id,
        droppedTaskId,
        now: currentEatDate,
        taskReward: task.reward,
        taskCategory: task.category,
        completedTodayCount: usedToday,
        isOwner,
        country: selectedCountry,
      });

    return {
      rule: OPEN_ACCESS_QUOTA_RULE,
      usedToday,
      surveysUsedToday,
      remainingToday,
      canDoTask,
    };
  }, [normalizedDailyUsage, droppedTaskId, currentEatDate, isOwner, selectedCountry]);

  const [workerMode, setWorkerMode] = useState<'worker' | 'requester'>('worker');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [streakModalOpen, setStreakModalOpen] = useState(false);
  const [postTaskModalOpen, setPostTaskModalOpen] = useState(false);
  const [publisherModalOpen, setPublisherModalOpen] = useState(false);
  const [privacyTermsModalOpen, setPrivacyTermsModalOpen] = useState(false);
  const [privacyTermsTab, setPrivacyTermsTab] = useState<'privacy' | 'terms'>('privacy');
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification((curr) => (curr === msg ? null : curr));
    }, 5500);
  }, []);

  // Automatic UI & quota refresh the exact instant the Daily 8:00 AM EAT countdown hits 00:00:00
  const prevDropWindowRef = useRef<{ isOpen: boolean; dateKey: string }>({
    isOpen: eatInfo.isDropWindowOpen,
    dateKey: eatInfo.dateKey,
  });

  useEffect(() => {
    const prev = prevDropWindowRef.current;
    const hitZeroToOpen = !prev.isOpen && eatInfo.isDropWindowOpen;
    const rolledDate = prev.dateKey !== eatInfo.dateKey;

    if (hitZeroToOpen || rolledDate) {
      prevDropWindowRef.current = {
        isOpen: eatInfo.isDropWindowOpen,
        dateKey: eatInfo.dateKey,
      };
      setDropRefreshTick((t) => t + 1);

      if (rolledDate) {
        setDailyUsage({ dateKey: eatInfo.dateKey, count: 0, surveyCount: 0 });
      }

      fetch('/api/user/quota', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      }).catch(() => {});

      if (hitZeroToOpen) {
        showNotification(
          '08:00 AM EAT Task Drop is NOW LIVE! Click "Open Task" to start today\'s dropped task.'
        );
      }
    }
  }, [eatInfo.isDropWindowOpen, eatInfo.dateKey, activeToken, showNotification]);

  // Immediately hydrate KYC from durable local backup on uid change so UI never resets to Not Submitted
  useEffect(() => {
    if (!currentUid) {
      if (!authLoading && !activeToken) {
        setKycStatus('Not Submitted');
        setKycRecord(null);
      }
      return;
    }
    const backup = readLocalKycBackup(currentUid);
    if (backup) {
      setKycStatus(backup.status);
      setKycRecord(backup.record);
    }
  }, [currentUid, authLoading, activeToken]);

  const kycRank = (s: KycVerificationStatus) =>
    s === 'Approved' ? 4 : s === 'Rejected' ? 3 : s === 'Pending' ? 2 : 0;

  const refreshKycStatus = useCallback(async () => {
    if (!activeToken && !currentUid) {
      if (!authLoading) {
        setKycStatus('Not Submitted');
        setKycRecord(null);
      }
      return;
    }
    if (!activeToken) return;

    setKycLoading(true);
    try {
      const freshToken = (await getFreshToken()) || activeToken;
      const localBackup = readLocalKycBackup(currentUid);

      const serverPromise = fetch(
        `/api/kyc/status?countryCode=${encodeURIComponent(selectedCountry.code)}`,
        {
          headers: {
            Authorization: `Bearer ${freshToken}`,
            'x-ea-country': selectedCountry.code,
          },
        }
      )
        .then((res) => (res.ok ? res.json() : null))
        .catch(() => null);

      const firestorePromise =
        auth.currentUser && auth.currentUser.uid === currentUid && auth.currentUser.emailVerified
          ? getDoc(doc(db, 'kyc_verifications', auth.currentUser.uid))
              .then((snap) => (snap.exists() ? snap.data() : null))
              .catch(() => null)
          : Promise.resolve(null);

      const [data, fsDoc] = await Promise.all([serverPromise, firestorePromise]);

      const serverStatus: KycVerificationStatus = data?.kycStatus || 'Not Submitted';
      const serverSub: KycRecordClient | null = data?.submission || null;
      const fsStatus: KycVerificationStatus = fsDoc?.status || 'Not Submitted';

      let resolvedStatus: KycVerificationStatus = serverStatus;
      let resolvedRecord: KycRecordClient | null = serverSub;

      if (kycRank(fsStatus) > kycRank(resolvedStatus) && fsDoc) {
        resolvedStatus = fsStatus;
        resolvedRecord = {
          uid: String(fsDoc.uid || currentUid || ''),
          countryCode: String(fsDoc.countryCode || selectedCountry.code),
          idDocumentName: String(fsDoc.idDocumentName || selectedCountry.idDocumentName),
          fullNameOnId: String(fsDoc.fullNameOnId || ''),
          idNumber: String(fsDoc.idNumber || ''),
          frontImageDataUrl:
            resolvedRecord?.frontImageDataUrl || localBackup?.record?.frontImageDataUrl || '',
          backImageDataUrl:
            resolvedRecord?.backImageDataUrl || localBackup?.record?.backImageDataUrl || '',
          status: fsStatus as Exclude<KycVerificationStatus, 'Not Submitted'>,
          rejectionReason: fsDoc.rejectionReason,
          reviewedBy: fsDoc.reviewedBy,
          reviewedAt: fsDoc.reviewedAt,
          submittedAt: String(fsDoc.submittedAt || new Date().toISOString()),
          updatedAt: String(fsDoc.updatedAt || new Date().toISOString()),
        };
      }

      // Never downgrade submitted/pending/approved KYC back to Not Submitted when server cache cold-started
      if (resolvedStatus === 'Not Submitted' && localBackup && localBackup.status !== 'Not Submitted') {
        resolvedStatus = localBackup.status;
        resolvedRecord = localBackup.record;

        if (
          localBackup.record?.frontImageDataUrl &&
          localBackup.record?.backImageDataUrl &&
          localBackup.record.frontImageDataUrl !== localBackup.record.backImageDataUrl
        ) {
          fetch('/api/kyc/hydrate', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${freshToken}`,
              'x-ea-country': localBackup.record.countryCode || selectedCountry.code,
            },
            body: JSON.stringify({
              countryCode: localBackup.record.countryCode,
              fullNameOnId: localBackup.record.fullNameOnId,
              idNumber: localBackup.record.idNumber,
              frontImageDataUrl: localBackup.record.frontImageDataUrl,
              backImageDataUrl: localBackup.record.backImageDataUrl,
              submittedAt: localBackup.record.submittedAt,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((hData) => {
              if (hData?.success && hData?.kycStatus) {
                setKycStatus(hData.kycStatus as KycVerificationStatus);
                if (hData.submission) {
                  setKycRecord(hData.submission);
                  writeLocalKycBackup(currentUid, hData.kycStatus, hData.submission);
                }
              }
            })
            .catch(() => {});
        }
      }

      if (resolvedRecord && localBackup?.record) {
        resolvedRecord = {
          ...resolvedRecord,
          frontImageDataUrl:
            resolvedRecord.frontImageDataUrl || localBackup.record.frontImageDataUrl || '',
          backImageDataUrl:
            resolvedRecord.backImageDataUrl || localBackup.record.backImageDataUrl || '',
        };
      }

      if (resolvedStatus !== 'Not Submitted') {
        setKycStatus(resolvedStatus);
        setKycRecord(resolvedRecord);
        writeLocalKycBackup(currentUid, resolvedStatus, resolvedRecord);
      } else if (!localBackup) {
        setKycStatus('Not Submitted');
        setKycRecord(null);
      }
    } catch {
      // keep existing state instead of resetting on transient network error
    } finally {
      setKycLoading(false);
    }
  }, [activeToken, authLoading, currentUid, getFreshToken, selectedCountry.code, selectedCountry.idDocumentName]);

  useEffect(() => {
    void refreshKycStatus();
  }, [refreshKycStatus]);

  useEffect(() => {
    if (kycStatus !== 'Pending' && !walletOpen) return;
    const timer = window.setInterval(() => {
      void refreshKycStatus();
    }, 15000);
    return () => window.clearInterval(timer);
  }, [kycStatus, walletOpen, refreshKycStatus]);

  const submitKycVerification: TaskContextType['submitKycVerification'] = useCallback(
    async (params) => {
      const freshToken = (await getFreshToken()) || activeToken;
      if (!freshToken) {
        return { success: false, error: 'Please sign in first to submit your KYC identity documents.' };
      }
      try {
        const res = await fetch('/api/kyc/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-ea-country': params.countryCode || selectedCountry.code,
            'x-ea-verified': 'true',
            Authorization: `Bearer ${freshToken}`,
          },
          body: JSON.stringify(params),
        });
        const data = await res.json();
        if (!res.ok || !data?.success) {
          return {
            success: false,
            error: data?.error || 'Could not submit KYC documents.',
          };
        }
        const nextStatus = (data?.kycStatus || 'Pending') as KycVerificationStatus;
        const nextSub = (data?.submission || null) as KycRecordClient | null;
        setKycStatus(nextStatus);
        if (nextSub) {
          setKycRecord(nextSub);
        }
        writeLocalKycBackup(currentUid || nextSub?.uid, nextStatus, nextSub);

        if (auth.currentUser && auth.currentUser.emailVerified && nextSub) {
          Promise.all([
            computeSha256HexClient(params.frontImageDataUrl),
            computeSha256HexClient(params.backImageDataUrl),
          ])
            .then(([frontHash, backHash]) =>
              setDoc(doc(db, 'kyc_verifications', auth.currentUser!.uid), {
                uid: auth.currentUser!.uid,
                countryCode: nextSub.countryCode,
                idDocumentName: nextSub.idDocumentName,
                fullNameOnId: nextSub.fullNameOnId,
                idNumber: nextSub.idNumber,
                frontImageUploaded: true,
                backImageUploaded: true,
                frontImageSha256: frontHash,
                backImageSha256: backHash,
                status: 'Pending',
                submittedAt: nextSub.submittedAt,
                updatedAt: nextSub.updatedAt,
              })
            )
            .catch(() => {});
        }

        showNotification(
          data.message || 'National ID Front & Back photos submitted for KYC review!'
        );
        return { success: true, message: data.message };
      } catch (err: any) {
        return {
          success: false,
          error: err?.message || 'Network error while uploading KYC identity documents.',
        };
      }
    },
    [activeToken, currentUid, getFreshToken, selectedCountry.code, showNotification]
  );

  const recordPlatformTransaction = (payload: {
    id?: string;
    kind: 'withdrawal' | 'task_reward' | 'referral_commission' | 'investment_deposit';
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

  // Sync live Owner withdrawal approvals/rejections whenever Wallet opens
  useEffect(() => {
    if (!walletOpen || !activeToken) return;
    fetch('/api/withdrawals/my', {
      headers: { Authorization: `Bearer ${activeToken}` },
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
            balance: +(prev.balance + refunded).toFixed(4),
            payoutHistory: updatedHistory,
          };
        });
      })
      .catch(() => {});
  }, [walletOpen, activeToken]);

  const openPrivacyTerms = (tab: 'privacy' | 'terms' = 'privacy') => {
    setPrivacyTermsTab(tab);
    setPrivacyTermsModalOpen(true);
  };

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_STATS, JSON.stringify(userStats));
    } catch {}
  }, [userStats]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_TASKS, JSON.stringify(tasks));
    } catch {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_HISTORY, JSON.stringify(taskHistory));
    } catch {}
  }, [taskHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_MEMES, JSON.stringify(memes));
    } catch {}
  }, [memes]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_REF_HISTORY, JSON.stringify(referralHistory));
    } catch {}
  }, [referralHistory]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY_REF_STATS, JSON.stringify(referralStats));
    } catch {}
  }, [referralStats]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          const res = await fetch('/api/user/tasks', {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const dbTasks = await res.json();
            if (Array.isArray(dbTasks) && dbTasks.length > 0) {
              const dbCompletedIds = dbTasks.map((d: any) => String(d.taskId || '')).filter(Boolean);
              if (dbCompletedIds.length > 0) {
                setUserStats((prev) => ({
                  ...prev,
                  completedTaskIds: Array.from(new Set([...(prev.completedTaskIds || []), ...dbCompletedIds])),
                }));
              }
              setTaskHistory((prev) => {
                const existingRefs = new Set(prev.map((p) => p.transactionRef));
                const newItems: TaskHistoryRecord[] = dbTasks
                  .filter((d: any) => !existingRefs.has(d.transactionRef))
                  .map((d: any) => ({
                    id: `db-${d.id}`,
                    taskId: d.taskId,
                    taskTitle: d.taskTitle,
                    category: d.category,
                    reward: Math.max(0, Number(d.reward) || 0),
                    status: d.status,
                    completedAt: d.completedAt ? new Date(d.completedAt).toLocaleDateString() : 'Recent',
                    accuracyScore: Number(d.accuracyScore),
                    transactionRef: d.transactionRef,
                  }));
                return [...newItems, ...prev];
              });
            }
          }
        } catch {}
      }
    });
    return () => unsubscribe();
  }, []);

  // Hydrate persistent server + Firestore state on login/reload
  useEffect(() => {
    if (!activeToken) {
      hydratedTokenRef.current = null;
      return;
    }

    let cancelled = false;

    const hydrate = async () => {
      const freshToken = (await getFreshToken()) || activeToken;
      if (!freshToken || cancelled) return;

      const serverStatePromise = fetch('/api/user/state', {
        headers: { Authorization: `Bearer ${freshToken}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((d) => d?.state || null)
        .catch(() => null);

      const firestoreStatePromise =
        auth.currentUser && auth.currentUser.uid === currentUid && auth.currentUser.emailVerified
          ? getDoc(doc(db, 'customer_states', auth.currentUser.uid))
              .then((snap) => (snap.exists() ? snap.data() : null))
              .catch(() => null)
          : Promise.resolve(null);

      const [serverRemote, fsRemote] = await Promise.all([serverStatePromise, firestoreStatePromise]);
      if (cancelled) return;

      const fsHasMoreData =
        fsRemote &&
        (!serverRemote ||
          (Number(fsRemote?.userStats?.balance) || 0) > (Number(serverRemote?.userStats?.balance) || 0) ||
          (Number(fsRemote?.userStats?.lifetimeEarned) || 0) > (Number(serverRemote?.userStats?.lifetimeEarned) || 0) ||
          (Array.isArray(fsRemote?.taskHistory) ? fsRemote.taskHistory.length : 0) >
            (Array.isArray(serverRemote?.taskHistory) ? serverRemote.taskHistory.length : 0));

      const remote = fsHasMoreData ? { ...(serverRemote || {}), ...fsRemote } : serverRemote || fsRemote;

      if (fsHasMoreData && fsRemote) {
        fetch('/api/user/state', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'x-ea-country': selectedCountry.code,
            'x-ea-verified': 'true',
            Authorization: `Bearer ${freshToken}`,
          },
          body: JSON.stringify(fsRemote),
        }).catch(() => {});
      }

      if (!remote) {
        hydratedTokenRef.current = activeToken;
        return;
      }

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
            payoutMap.set(p.id, { ...p, method: 'PayPal' });
          }
        }

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
          payoutHistory: Array.from(payoutMap.values()),
        };
      });

      if (Array.isArray(remote.taskHistory)) {
        setTaskHistory((prev) => {
          const byKey = new Map<string, TaskHistoryRecord>();
          const source = isSwitchingDifferentAccount ? remote.taskHistory : [...prev, ...remote.taskHistory];
          for (const item of source) {
            if (!item?.taskId) continue;
            const k = item.id || `${item.taskId}::${item.completedAt}`;
            if (!byKey.has(k)) {
              byKey.set(k, {
                ...item,
                reward: Math.max(0, Number(item.reward) || 0),
              });
            }
          }
          return Array.from(byKey.values());
        });
      }

      if (Array.isArray(remote.referralHistory)) {
        setReferralHistory((prev) => {
          const byId = new Map<string, ReferralRecord>();
          const source = isSwitchingDifferentAccount ? remote.referralHistory : [...prev, ...remote.referralHistory];
          for (const r of source) {
            if (!r?.id) continue;
            const ex = byId.get(r.id);
            if (!ex || (Number(r.commissionEarned) || 0) >= (Number(ex.commissionEarned) || 0)) {
              byId.set(r.id, { ...r, paymentMethod: 'PayPal' });
            }
          }
          return Array.from(byId.values());
        });
      }

      if (remote.referralStats) {
        const rs = remote.referralStats;
        const origin = CANONICAL_PLATFORM_ORIGIN;
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
            vipReferralCount: 0,
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

      hydratedTokenRef.current = activeToken;
    };

    void hydrate().catch(() => {
      hydratedTokenRef.current = activeToken;
    });

    return () => {
      cancelled = true;
    };
  }, [activeToken, currentUid, getFreshToken, selectedCountry.code]);

  // Debounced background sync to persistent server ledger & Firestore after hydration
  useEffect(() => {
    if (!activeToken || hydratedTokenRef.current !== activeToken) return;

    const timer = window.setTimeout(async () => {
      const freshToken = (await getFreshToken()) || activeToken;
      if (!freshToken) return;

      const statePayload = {
        uid: currentUid || undefined,
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
        activePackageId: null,
        vipReferralCount: 0,
        updatedAt: new Date().toISOString(),
      };

      fetch('/api/user/state', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          Authorization: `Bearer ${freshToken}`,
        },
        body: JSON.stringify(statePayload),
      }).catch(() => {});

      if (auth.currentUser && auth.currentUser.uid === currentUid && auth.currentUser.emailVerified) {
        try {
          await setDoc(
            doc(db, 'customer_states', auth.currentUser.uid),
            JSON.parse(JSON.stringify({ ...statePayload, uid: auth.currentUser.uid })),
            { merge: true }
          );
        } catch {}
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    activeToken,
    currentUid,
    getFreshToken,
    selectedCountry.code,
    userStats,
    taskHistory,
    referralHistory,
    referralStats,
    normalizedDailyUsage,
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
        const bonusAmount = 5.0;
        newBalance = +(newBalance + bonusAmount).toFixed(4);
        newLifetime = +(newLifetime + bonusAmount).toFixed(4);
        newMultiplier = 0.20;
        sevenDayAwarded = true;
        bonusMessage = ` 7-DAY STREAK MILESTONE REACHED! Granted ${formatCurrencyFromUsd(bonusAmount, selectedCountry)} bonus + 20% earnings multiplier on all tasks!`;
        try {
          confetti({ particleCount: 110, spread: 80, origin: { y: 0.5 } });
        } catch {}
      } else if (nextStreak > 7) {
        newMultiplier = 0.20;
        bonusMessage = ` Streak extended to ${nextStreak} Days! (20% bonus active).`;
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
        lastLoginDate: newDate,
      };
    });
  };

  const checkInDaily = () => {
    const today = new Date().toISOString().split('T')[0];
    if (userStats.lastLoginDate === today) {
      showNotification(`Already checked in today! Current Streak: ${userStats.streakDays} Days`);
      return;
    }
    processStreakAdvancement(today);
  };

  const advanceDailyStreak = () => {
    const nextDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    processStreakAdvancement(nextDate);
  };

  const completeTask = (taskId: string, rewardEarned: number, summaryTitle: string) => {
    const taskItem = tasks.find((t) => t.id === taskId);
    const taskCategory = taskItem?.category || 'micro';

    const eligibility = evaluateTaskEligibility({
      taskId,
      droppedTaskId,
      now: currentEatDate,
      taskReward: rewardEarned,
      taskCategory,
      completedTodayCount: normalizedDailyUsage.count,
      isOwner,
      country: selectedCountry,
    });

    if (!eligibility.allowed) {
      showNotification(eligibility.reason || 'Daily 8:00 AM EAT task drop rule active.');
      return;
    }

    const bonusMultiplier = userStats.streakDays >= 7 ? 0.20 : userStats.streakDays > 0 ? 0.10 : 0;
    const finalBonusAmount = +(rewardEarned * bonusMultiplier).toFixed(4);
    const totalAward = +(rewardEarned + finalBonusAmount).toFixed(4);

    const todayKey = eatInfo.dateKey;
    setDailyUsage((prev) => {
      const base = prev.dateKey === todayKey ? prev : { dateKey: todayKey, count: 0, surveyCount: 0 };
      return {
        dateKey: todayKey,
        count: base.count + 1,
        surveyCount: base.surveyCount + (taskCategory === 'survey' ? 1 : 0),
      };
    });

    const newHistoryRecord: TaskHistoryRecord = {
      id: `hist-${Date.now()}`,
      taskId,
      taskTitle: summaryTitle,
      category: taskCategory,
      reward: totalAward,
      status: 'Approved',
      completedAt: 'Just now',
      accuracyScore: 99.4,
      transactionRef: `TXN-${Math.floor(100000 + Math.random() * 900000)}`,
    };

    setTaskHistory((prev) => [newHistoryRecord, ...prev]);

    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance + totalAward).toFixed(4),
      lifetimeEarned: +(prev.lifetimeEarned + totalAward).toFixed(4),
      completedTasksCount: prev.completedTasksCount + 1,
      completedTaskIds: [...prev.completedTaskIds, taskId],
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

    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      if (auth.currentUser.emailVerified) {
        const fsTaskId = `ct_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        const fsPath = `completed_tasks/${fsTaskId}`;
        setDoc(doc(db, 'completed_tasks', fsTaskId), {
          userUid: uid.slice(0, 128),
          taskId: String(taskId).slice(0, 128),
          taskTitle: String(summaryTitle).slice(0, 200),
          category: String(taskCategory).slice(0, 64),
          reward: totalAward,
          status: 'Approved',
          completedAt: serverTimestamp(),
        }).catch((err) => {
          if (isPermissionError(err)) {
            try {
              handleFirestoreError(err, OperationType.CREATE, fsPath);
            } catch {}
          }
        });
      }

      auth.currentUser.getIdToken().then((token) => {
        fetch('/api/user/tasks', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            taskId,
            taskTitle: summaryTitle,
            category: taskCategory,
            reward: totalAward,
            status: 'Approved',
            accuracyScore: 99.4,
            transactionRef: newHistoryRecord.transactionRef,
          }),
        }).catch(() => {});
      }).catch(() => {});
    } else if (activeToken) {
      fetch('/api/user/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${activeToken}`,
        },
        body: JSON.stringify({
          taskId,
          taskTitle: summaryTitle,
          category: taskCategory,
          reward: totalAward,
          status: 'Approved',
          accuracyScore: 99.4,
          transactionRef: newHistoryRecord.transactionRef,
        }),
      }).catch(() => {});
    }

    try {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
    } catch {}

    showNotification(
      `Task Approved! Earned ${formatCurrencyFromUsd(totalAward, selectedCountry)} (merchant reward${bonusMultiplier > 0 ? ' + streak bonus' : ''}) for ${summaryTitle}`
    );
  };

  const requestPayout = (amount: number, method: PayoutRecord['method'], details: string): boolean => {
    const minLocal = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
    if (method !== 'PayPal') {
      showNotification('Only PayPal withdrawals are supported on Gideon Global Tasks.');
      return false;
    }

    if (!meetsWithdrawalThreshold(amount)) {
      showNotification(
        `Minimum withdrawal is ${minLocal} (${WITHDRAWAL_THRESHOLD_KES} shillings). Continue completing free tasks to reach ${minLocal}.`
      );
      return false;
    }

    if (amount > userStats.balance + 1e-4) {
      showNotification(
        `Payout failed: Requested amount exceeds available balance (${formatCurrencyFromUsd(userStats.balance, selectedCountry)}).`
      );
      return false;
    }

    if (!isOwner && kycStatus !== 'Approved') {
      showNotification(
        kycStatus === 'Pending'
          ? `Your ${selectedCountry.idDocumentName} KYC verification is currently Pending Owner Approval.`
          : `Strict KYC Required: Upload BOTH Front & Back photos of your ${selectedCountry.idDocumentName} and wait for Owner approval before requesting a PayPal withdrawal.`
      );
      return false;
    }

    const cleanEmail = String(details || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showNotification('Please provide a valid PayPal email address for withdrawal.');
      return false;
    }

    const newRecord: PayoutRecord = {
      id: `PAY-${Math.floor(1000 + Math.random() * 9000)}`,
      amount: +amount.toFixed(4),
      method: 'PayPal',
      accountDetails: cleanEmail,
      status: 'Processing',
      timestamp: 'Just now',
    };

    setUserStats((prev) => ({
      ...prev,
      balance: +Math.max(0, prev.balance - amount).toFixed(4),
      payoutHistory: [newRecord, ...prev.payoutHistory],
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
        method: 'PayPal',
        accountDetails: cleanEmail,
        countryCode: selectedCountry.code,
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const errData = await res.json().catch(() => null);
          setUserStats((prev) => ({
            ...prev,
            balance: +(prev.balance + newRecord.amount).toFixed(4),
            payoutHistory: prev.payoutHistory.filter((p) => p.id !== newRecord.id),
          }));
          showNotification(errData?.error || 'Withdrawal request was rejected by server policy.');
          void refreshKycStatus();
        }
      })
      .catch(() => {});

    if (auth.currentUser?.emailVerified) {
      const wId = `wd_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
      const wPath = `withdrawals/${wId}`;
      setDoc(doc(db, 'withdrawals', wId), {
        userUid: auth.currentUser.uid.slice(0, 128),
        amount: Number(amount),
        method: 'PayPal',
        details: cleanEmail.slice(0, 200),
        status: 'Pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }).catch((err) => {
        if (isPermissionError(err)) {
          try {
            handleFirestoreError(err, OperationType.CREATE, wPath);
          } catch {}
        }
      });
    }

    showNotification(
      `PayPal withdrawal of ${formatCurrencyFromUsd(amount, selectedCountry)} queued for ${cleanEmail}! Owner verification in progress.`
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
      requesterVerified: true,
    };

    setTasks((prev) => [created, ...prev]);
    showNotification(`Task "${created.title}" published! Matching high-reward alert subscribers...`);

    void (async () => {
      try {
        const token = (await getFreshToken()) || activeToken;
        if (!token) return;
        const res = await fetch('/api/owner/tasks/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            id: created.id,
            title: created.title,
            category: created.category,
            reward: created.reward,
            description: created.description,
          }),
        });
        const data = await res.json();
        if (res.ok && data?.success && data.matchedCount > 0) {
          showNotification(
            `Task "${created.title}" published! Notified ${data.matchedCount} high-reward subscriber(s)${
              data.emailedCount > 0 ? ` (${data.emailedCount} SMTP emails sent)` : ' (queued in alert feed)'
            }.`
          );
        }
      } catch {}
    })();
  };

  const updateTask = (taskId: string, updates: Partial<Task>): boolean => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (currentEmail !== OWNER_EMAIL || !auth.currentUser?.emailVerified) {
      showNotification(`Forbidden: Only ${OWNER_EMAIL} can edit platform tasks.`);
      return false;
    }
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, ...updates } : t)));
    showNotification('Task updated successfully.');
    return true;
  };

  const deleteTask = (taskId: string): boolean => {
    const currentEmail = auth.currentUser?.email?.toLowerCase();
    if (currentEmail !== OWNER_EMAIL || !auth.currentUser?.emailVerified) {
      showNotification(`Forbidden: Only ${OWNER_EMAIL} can delete platform tasks.`);
      return false;
    }
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showNotification('Task permanently removed from marketplace.');
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
            userUpvoted: !isUpvoted,
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
      balance: +(prev.balance - amount).toFixed(4),
    }));
    setMemes((prev) =>
      prev.map((m) =>
        m.id === memeId ? { ...m, tipsEarned: +(m.tipsEarned + amount).toFixed(4) } : m
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
      userUpvoted: true,
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
    const origin = CANONICAL_PLATFORM_ORIGIN;
    const newLink = `${origin}/?ref=${cleaned}`;
    setReferralStats((prev) => ({
      ...prev,
      referralCode: cleaned,
      referralLink: newLink,
    }));
    showNotification(`Referral code updated to "${cleaned}"! Your unique link is ready to share.`);
    return true;
  };

  const simulateReferralActivity = (refereeName?: string, country?: string) => {
    const CANDIDATES = [
      { name: 'David Kimani', email: 'da***ni@gmail.com', country: 'Kenya' },
      { name: 'Grace Namukasa', email: 'gr***sa@gmail.com', country: 'Uganda' },
      { name: 'Asha Mwinyi', email: 'as***yi@gmail.com', country: 'Tanzania' },
      { name: 'Jean-Paul Habimana', email: 'jp***na@gmail.com', country: 'Rwanda' },
      { name: 'Faith Wanjiku', email: 'fa***ku@yahoo.com', country: 'Kenya' },
    ];
    const pick = CANDIDATES[Math.floor(Math.random() * CANDIDATES.length)];
    const chosenName = refereeName || pick.name;
    const chosenCountry = country || pick.country;

    const commissionKes = 30; // 20% commission on referred PayPal activity
    const earned = convertKesToUsd(commissionKes);

    setUserStats((prev) => ({
      ...prev,
      balance: +(prev.balance + earned).toFixed(4),
      lifetimeEarned: +(prev.lifetimeEarned + earned).toFixed(4),
    }));

    const newRecord: ReferralRecord = {
      id: `ref-tx-${Date.now()}`,
      refereeName: chosenName,
      refereeEmailMasked: pick.email,
      refereeCountry: chosenCountry,
      dateJoined: 'Just now',
      passPurchased: 'Verified Contributor Task Activity',
      passPrice: convertKesToUsd(150),
      commissionRate: 0.2,
      commissionEarned: earned,
      paymentMethod: 'PayPal',
      status: 'Credited',
      transactionId: `PAYPAL-REF-${Math.floor(10000 + Math.random() * 90000)}`,
    };

    setReferralHistory((prev) => [newRecord, ...prev]);
    setReferralStats((prev) => ({
      ...prev,
      totalSignups: prev.totalSignups + 1,
      passesPurchasedCount: prev.passesPurchasedCount + 1,
      totalCommissionEarned: +(prev.totalCommissionEarned + earned).toFixed(4),
    }));

    recordPlatformTransaction({
      id: newRecord.transactionId,
      kind: 'referral_commission',
      title: `20% Referral Commission · ${chosenName}`,
      customerLabel: `${chosenName} (${chosenCountry})`,
      gatewayOrMethod: 'PayPal',
      currency: selectedCountry.currency,
      amountUsd: earned,
      status: 'Completed',
      reference: newRecord.transactionId,
      metadata: { refereeCountry: chosenCountry },
    });

    try {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    } catch {}

    showNotification(
      `Referral Commission! ${chosenName} completed verified onboarding. +${formatCurrencyFromUsd(earned, selectedCountry)} added to your wallet!`
    );
  };

  const syncWalletFromServer = useCallback(async () => {
    try {
      const freshToken = (await getFreshToken()) || activeToken;
      if (!freshToken) return;
      const res = await fetch('/api/user/state', {
        headers: { Authorization: `Bearer ${freshToken}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const remoteStats = data?.state?.userStats;
      if (!remoteStats) return;
      setUserStats((prev) => ({
        ...prev,
        balance: +Math.max(prev.balance, Number(remoteStats.balance) || 0).toFixed(4),
        lifetimeEarned: +Math.max(prev.lifetimeEarned, Number(remoteStats.lifetimeEarned) || 0).toFixed(4),
      }));
    } catch {}
  }, [activeToken, getFreshToken]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        userStats,
        taskHistory,
        referralHistory,
        referralStats,
        updateReferralCode,
        simulateReferralActivity,
        dailyQuotaStatus,
        dailyDropInfo,
        kycStatus,
        kycRecord,
        kycLoading,
        refreshKycStatus,
        submitKycVerification,
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
        privacyTermsModalOpen,
        setPrivacyTermsModalOpen,
        privacyTermsTab,
        openPrivacyTerms,
        syncWalletFromServer,
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
