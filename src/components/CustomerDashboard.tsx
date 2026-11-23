import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { getTodayDateKey } from '../lib/taskEligibility';
import {
  WITHDRAWAL_THRESHOLD_USD,
  meetsWithdrawalThreshold,
  convertUsdToLocal,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
} from '../lib/eastAfrica';
import { WithdrawalEligibilityGate } from './WithdrawalEligibilityGate';
import { KycVerificationPanel } from './KycVerificationPanel';
import { type AuctionItem, resolveAuctionImageUrl } from './AuctionsView';
import {
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Wallet,
  TrendingUp,
  Users,
  ShieldCheck,
  Download,
  Search,
  Copy,
  Check,
  ArrowUpRight,
  RefreshCw,
  Lock,
  Flame,
  AlertCircle,
  Send,
  Zap,
  Award,
  User as UserIcon,
  Calendar,
  Gavel,
} from 'lucide-react';

type DashboardSubTab =
  | 'overview'
  | 'tasks'
  | 'withdrawals'
  | 'auctions'
  | 'analytics'
  | 'referrals'
  | 'account-kyc';

interface ServerWithdrawalItem {
  id: string;
  amountUsd: number;
  amountLocal?: number;
  currency?: string;
  method: string;
  accountDetails: string;
  status: 'Processing' | 'Completed' | 'Rejected';
  gatewayReceipt?: string;
  gatewayProvider?: string;
  gatewayMode?: string;
  rejectedReason?: string;
  createdAt: string;
  reviewedAt?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  survey: 'Surveys',
  annotation: 'AI Annotation',
  'data-entry': 'Data Entry',
  writing: 'Writing & Copy',
  'meme-content': 'Meme Content',
  'creator-campaign': 'Creator Campaigns',
  micro: 'Micro Tasks',
};

function formatDateShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function toDayKey(dateInput: Date | string): string {
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return '';
  return getTodayDateKey(d);
}

export const CustomerDashboard: React.FC = () => {
  const {
    userStats,
    taskHistory,
    referralHistory,
    referralStats,
    updateReferralCode,
    dailyQuotaStatus,
    kycStatus,
    refreshKycStatus,
    setActiveTab,
    setWalletOpen,
    setStreakModalOpen,
  } = useTasks();

  const {
    user,
    customerProfile,
    activeToken,
    isAuthenticated,
    setAuthModalOpen,
    setSecurityModalOpen,
    openMyAccount,
  } = useAuth();
  const { selectedCountry } = useRegion();

  const [subTab, setSubTab] = useState<DashboardSubTab>('overview');

  // Task history filter states
  const [taskSearch, setTaskSearch] = useState('');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState('all');
  const [taskStatusFilter, setTaskStatusFilter] = useState('all');

  // Withdrawals server sync states
  const [serverWithdrawals, setServerWithdrawals] = useState<ServerWithdrawalItem[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalsError, setWithdrawalsError] = useState<string | null>(null);
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState<'all' | 'Processing' | 'Completed' | 'Rejected'>('all');

  // Referral helpers
  const [copiedRef, setCopiedRef] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [codeDraft, setCodeDraft] = useState(referralStats.referralCode);
  const [exportedCsv, setExportedCsv] = useState(false);
  const [refreshingData, setRefreshingData] = useState(false);
  const [investmentsSummary, setInvestmentsSummary] = useState<{
    count: number;
    totalKes: number;
    expectedKes: number;
  }>({ count: 0, totalKes: 0, expectedKes: 0 });
  const [auctionsList, setAuctionsList] = useState<AuctionItem[]>([]);

  const loadServerWithdrawals = useCallback(async () => {
    if (!activeToken) {
      setServerWithdrawals([]);
      return;
    }
    setWithdrawalsLoading(true);
    setWithdrawalsError(null);
    try {
      const res = await fetch('/api/withdrawals/my', {
        headers: { Authorization: `Bearer ${activeToken}` },
      });
      if (!res.ok) {
        if (res.status !== 401) {
          setWithdrawalsError('Could not refresh live withdrawal status from server.');
        }
        return;
      }
      const data = await res.json();
      if (Array.isArray(data?.withdrawals)) {
        setServerWithdrawals(data.withdrawals);
      }
    } catch {
      setWithdrawalsError('Network issue checking live payout status. Showing saved history.');
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [activeToken]);

  const loadInvestmentsSummary = useCallback(async () => {
    try {
      let trackedIds: string[] = [];
      try {
        const raw = localStorage.getItem('gideon_investment_ids_v1');
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) trackedIds = parsed.map(String).filter(Boolean);
      } catch {}
      if (!activeToken && trackedIds.length === 0) return;
      const query = trackedIds.length > 0 ? `?ids=${encodeURIComponent(trackedIds.join(','))}` : '';
      const res = await fetch(`/api/investments/my${query}`, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      const list = Array.isArray(data?.investments) ? data.investments : [];
      const activeOrPending = list.filter((i: any) => i.status !== 'Rejected');
      setInvestmentsSummary({
        count: list.length,
        totalKes: activeOrPending.reduce((s: number, i: any) => s + (Number(i.amountKes) || 0), 0),
        expectedKes: activeOrPending.reduce((s: number, i: any) => s + (Number(i.expectedReturnKes) || 0), 0),
      });
    } catch {}
  }, [activeToken]);

  const loadAuctionsSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/auctions');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.auctions)) {
        setAuctionsList(data.auctions);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void loadServerWithdrawals();
    void loadInvestmentsSummary();
    void loadAuctionsSummary();
  }, [loadServerWithdrawals, loadInvestmentsSummary, loadAuctionsSummary]);

  const handleRefreshAll = async () => {
    setRefreshingData(true);
    await Promise.all([
      loadServerWithdrawals(),
      loadInvestmentsSummary(),
      loadAuctionsSummary(),
      refreshKycStatus(),
    ]);
    setRefreshingData(false);
  };

  // Merge server withdrawals with local payoutHistory cleanly
  const combinedWithdrawals = useMemo(() => {
    const map = new Map<string, ServerWithdrawalItem>();

    for (const sw of serverWithdrawals) {
      map.set(sw.id, sw);
    }

    for (const lp of userStats.payoutHistory) {
      if (!map.has(lp.id)) {
        map.set(lp.id, {
          id: lp.id,
          amountUsd: lp.amount,
          method: lp.method,
          accountDetails: lp.accountDetails,
          status: lp.status,
          createdAt: lp.timestamp,
          gatewayReceipt: lp.mpesaReceipt,
        });
      }
    }

    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [serverWithdrawals, userStats.payoutHistory]);

  const filteredWithdrawals = useMemo(() => {
    return combinedWithdrawals.filter((w) =>
      withdrawalStatusFilter === 'all' ? true : w.status === withdrawalStatusFilter
    );
  }, [combinedWithdrawals, withdrawalStatusFilter]);

  const filteredTasks = useMemo(() => {
    return taskHistory.filter((item) => {
      if (taskCategoryFilter !== 'all' && item.category !== taskCategoryFilter) return false;
      if (taskStatusFilter !== 'all' && item.status !== taskStatusFilter) return false;
      if (taskSearch.trim()) {
        const q = taskSearch.toLowerCase();
        if (
          !item.taskTitle.toLowerCase().includes(q) &&
          !item.transactionRef.toLowerCase().includes(q) &&
          !item.category.toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [taskHistory, taskCategoryFilter, taskStatusFilter, taskSearch]);

  // Analytics calculations (all grounded in real task/payout/referral state)
  const analytics = useMemo(() => {
    const approvedTasks = taskHistory.filter((t) => t.status === 'Approved');
    const totalFromTasks = approvedTasks.reduce((sum, t) => sum + t.reward, 0);
    const totalTasksCount = taskHistory.length;
    const avgReward = totalTasksCount > 0 ? totalFromTasks / totalTasksCount : 0;
    const highestReward = taskHistory.reduce((max, t) => (t.reward > max ? t.reward : max), 0);
    const avgAccuracy =
      totalTasksCount > 0
        ? taskHistory.reduce((sum, t) => sum + (t.accuracyScore || 100), 0) / totalTasksCount
        : userStats.qualityScore || 100;

    // Build last 14 days series
    const dayBuckets = new Map<string, { dateKey: string; label: string; earned: number; count: number }>();
    const today = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = getTodayDateKey(d);
      dayBuckets.set(key, {
        dateKey: key,
        label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        earned: 0,
        count: 0,
      });
    }

    for (const item of taskHistory) {
      const k = toDayKey(item.completedAt);
      const bucket = dayBuckets.get(k);
      if (bucket) {
        bucket.earned = +(bucket.earned + item.reward).toFixed(2);
        bucket.count += 1;
      }
    }

    const dailySeries14 = Array.from(dayBuckets.values());
    const dailySeries7 = dailySeries14.slice(-7);
    const maxDailyEarned14 = Math.max(0.5, ...dailySeries14.map((d) => d.earned));
    const maxDailyEarned7 = Math.max(0.5, ...dailySeries7.map((d) => d.earned));

    // Category breakdown
    const catMap = new Map<string, { category: string; label: string; count: number; totalUsd: number; accuracySum: number }>();
    for (const item of taskHistory) {
      const existing = catMap.get(item.category) || {
        category: item.category,
        label: CATEGORY_LABELS[item.category] || item.category,
        count: 0,
        totalUsd: 0,
        accuracySum: 0,
      };
      existing.count += 1;
      existing.totalUsd = +(existing.totalUsd + item.reward).toFixed(2);
      existing.accuracySum += item.accuracyScore || 100;
      catMap.set(item.category, existing);
    }

    const categoryRows = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        avgReward: c.count > 0 ? +(c.totalUsd / c.count).toFixed(2) : 0,
        avgAccuracy: c.count > 0 ? +(c.accuracySum / c.count).toFixed(1) : 100,
        sharePct: totalFromTasks > 0 ? Math.round((c.totalUsd / totalFromTasks) * 100) : 0,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd);

    const totalWithdrawnCompleted = combinedWithdrawals
      .filter((w) => w.status === 'Completed')
      .reduce((sum, w) => sum + w.amountUsd, 0);
    const totalPendingWithdrawals = combinedWithdrawals
      .filter((w) => w.status === 'Processing')
      .reduce((sum, w) => sum + w.amountUsd, 0);

    const estimatedTaskRewardUsd = avgReward > 0 ? avgReward : 0.45;
    const maxDailyPotential = +(
      dailyQuotaStatus.rule.dailyLimit * estimatedTaskRewardUsd
    ).toFixed(2);
    const remainingTo20 = meetsWithdrawalThreshold(userStats.balance)
      ? 0
      : Math.max(0, WITHDRAWAL_THRESHOLD_USD - userStats.balance);
    const estDaysToCashout =
      remainingTo20 === 0
        ? 0
        : maxDailyPotential > 0
        ? Math.ceil(remainingTo20 / maxDailyPotential)
        : 0;

    return {
      totalFromTasks: +totalFromTasks.toFixed(2),
      avgReward: +avgReward.toFixed(2),
      highestReward: +highestReward.toFixed(2),
      avgAccuracy: +avgAccuracy.toFixed(1),
      dailySeries14,
      dailySeries7,
      maxDailyEarned14,
      maxDailyEarned7,
      categoryRows,
      totalWithdrawnCompleted: +totalWithdrawnCompleted.toFixed(2),
      totalPendingWithdrawals: +totalPendingWithdrawals.toFixed(2),
      maxDailyPotential,
      remainingTo20: +remainingTo20.toFixed(2),
      estDaysToCashout,
    };
  }, [taskHistory, userStats.qualityScore, userStats.balance, combinedWithdrawals, dailyQuotaStatus.rule]);

  // Combined Recent Activity Timeline
  const recentActivity = useMemo(() => {
    const events: {
      id: string;
      kind: 'task' | 'withdrawal' | 'referral';
      title: string;
      meta: string;
      amountLabel: string;
      status: string;
      timestamp: number;
      dateText: string;
    }[] = [];

    for (const t of taskHistory.slice(0, 8)) {
      events.push({
        id: `t-${t.id}`,
        kind: 'task',
        title: t.taskTitle,
        meta: `${CATEGORY_LABELS[t.category] || t.category} · ${t.transactionRef}`,
        amountLabel: `+${formatCurrencyFromUsd(t.reward, selectedCountry)}`,
        status: t.status,
        timestamp: new Date(t.completedAt).getTime() || 0,
        dateText: formatDateShort(t.completedAt),
      });
    }

    for (const w of combinedWithdrawals.slice(0, 6)) {
      events.push({
        id: `w-${w.id}`,
        kind: 'withdrawal',
        title: `Withdrawal via ${w.method}`,
        meta: `${w.accountDetails} · ${w.gatewayReceipt || w.id}`,
        amountLabel: `-${formatCurrencyFromUsd(w.amountUsd, selectedCountry)}`,
        status: w.status,
        timestamp: new Date(w.createdAt).getTime() || 0,
        dateText: formatDateShort(w.createdAt),
      });
    }

    for (const r of referralHistory.slice(0, 5)) {
      events.push({
        id: `r-${r.id}`,
        kind: 'referral',
        title: `Referral Bonus (${r.refereeName})`,
        meta: `${r.passPurchased} · ${r.transactionId}`,
        amountLabel: `+${formatCurrencyFromUsd(r.commissionEarned, selectedCountry)}`,
        status: r.status,
        timestamp: new Date(r.dateJoined).getTime() || 0,
        dateText: formatDateShort(r.dateJoined),
      });
    }

    return events.sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  }, [taskHistory, combinedWithdrawals, referralHistory, selectedCountry]);

  const handleExportActivityCsv = () => {
    const headers = ['Type', 'Reference', 'Description', 'Category/Method', `Amount (${selectedCountry.currency})`, 'Status', 'Date'];
    const rows: string[][] = [
      ...taskHistory.map((t) => [
        'Task Reward',
        t.transactionRef,
        `"${t.taskTitle.replace(/"/g, '""')}"`,
        t.category,
        String(convertUsdToLocal(t.reward, selectedCountry)),
        t.status,
        t.completedAt,
      ]),
      ...combinedWithdrawals.map((w) => [
        'Withdrawal',
        w.gatewayReceipt || w.id,
        `"Payout to ${w.accountDetails.replace(/"/g, '""')}"`,
        w.method,
        `-${convertUsdToLocal(w.amountUsd, selectedCountry)}`,
        w.status,
        w.createdAt,
      ]),
      ...referralHistory.map((r) => [
        'Referral Commission',
        r.transactionId,
        `"${r.refereeName} (${r.passPurchased})"`,
        r.paymentMethod,
        String(convertUsdToLocal(r.commissionEarned, selectedCountry)),
        r.status,
        r.dateJoined,
      ]),
    ];

    const csv = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', `gideon_customer_activity_${getTodayDateKey()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setExportedCsv(true);
    setTimeout(() => setExportedCsv(false), 2400);
  };

  const handleCopyReferralLink = () => {
    navigator.clipboard.writeText(referralStats.referralLink);
    setCopiedRef(true);
    setTimeout(() => setCopiedRef(false), 2200);
  };

  const handleSaveReferralCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (updateReferralCode(codeDraft)) {
      setEditingCode(false);
    }
  };

  const displayName =
    customerProfile?.displayName ||
    user?.displayName ||
    customerProfile?.phone ||
    'East Africa Contributor';

  const localBalance = formatCurrencyFromUsd(userStats.balance, selectedCountry);
  const thresholdFormatted = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
  const progressTo20 = Math.min(100, Math.round((userStats.balance / WITHDRAWAL_THRESHOLD_USD) * 100));
  const dailyQuotaPct = Math.min(
    100,
    Math.round((dailyQuotaStatus.usedToday / Math.max(1, dailyQuotaStatus.rule.dailyLimit)) * 100)
  );

  const currentUid = customerProfile?.uid || user?.uid || '';
  const myUploadedAuctions = useMemo(
    () => (currentUid ? auctionsList.filter((a) => a.sellerUid === currentUid) : []),
    [auctionsList, currentUid]
  );
  const myBidAuctions = useMemo(
    () => (currentUid ? auctionsList.filter((a) => a.bids?.some((b) => b.bidderUid === currentUid)) : []),
    [auctionsList, currentUid]
  );

  const SUB_TABS: { id: DashboardSubTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'tasks', label: `Tasks History (${taskHistory.length})` },
    { id: 'withdrawals', label: `Withdrawals (${combinedWithdrawals.length})` },
    { id: 'auctions', label: `Auctions (${myUploadedAuctions.length + myBidAuctions.length})` },
    { id: 'analytics', label: 'Analytics' },
    { id: 'referrals', label: `Referrals (${referralHistory.length})` },
    { id: 'account-kyc', label: `Account & KYC (${kycStatus})` },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Top Bar Breadcrumb & Primary Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 font-medium">
            <span className="inline-flex items-center gap-1.5 text-slate-700 font-semibold">
              <LayoutDashboard className="w-3.5 h-3.5 text-brand-600" />
              <span>Customer Dashboard</span>
            </span>
            <span aria-hidden="true">/</span>
            <span>{displayName}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono">{selectedCountry.name} ({selectedCountry.currency})</span>
            <span aria-hidden="true">·</span>
            <span>100% Free Access · KYC: {kycStatus}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Contributor Activity &amp; Earnings Hub
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => void handleRefreshAll()}
            disabled={refreshingData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshingData ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          <button
            type="button"
            onClick={handleExportActivityCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            {exportedCsv ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5 text-slate-500" />}
            <span>{exportedCsv ? 'CSV Exported' : 'Export Activity CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('investments')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              Invest {formatCurrencyFromKes(50, selectedCountry)}+
              {investmentsSummary.count > 0 ? ` (${formatCurrencyFromKes(investmentsSummary.totalKes, selectedCountry)})` : ''}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('auctions')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Gavel className="w-3.5 h-3.5 text-blue-700" />
            <span>Product Auctions ({auctionsList.filter((a) => a.status === 'Live').length} Live)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('testimonials')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Post Testimonial</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Browse Tasks</span>
          </button>

          <button
            type="button"
            onClick={() => (isAuthenticated ? openMyAccount('withdraw') : setWalletOpen(true))}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <span>Withdraw ({localBalance})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Sign-in / Account Alerts */}
      {!isAuthenticated && (
        <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 text-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <strong className="font-bold text-slate-900">Sign in to sync your cloud ledger &amp; PayPal withdrawals across devices.</strong>{' '}
            Tasks are 100% free with no Worker Pass needed; verified customers complete National ID KYC to unlock PayPal withdrawals from {thresholdFormatted}.
          </div>
          <button
            type="button"
            onClick={() => setAuthModalOpen(true)}
            className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            Register / Sign In
          </button>
        </div>
      )}

      {/* 4-Column KPI Strip (Tabular Numerals, Single Elevation) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500">Available Wallet Balance</div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
              {localBalance}
            </span>
            <span className="text-xs font-mono tabular-nums text-emerald-700 font-semibold">
              {selectedCountry.currency}
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center justify-between">
            <span>
              {meetsWithdrawalThreshold(userStats.balance)
                ? `Threshold met (${thresholdFormatted}+)`
                : `${formatCurrencyFromUsd(analytics.remainingTo20, selectedCountry)} left to ${thresholdFormatted}`}
            </span>
            <span className="font-mono tabular-nums font-semibold text-slate-700">{progressTo20}%</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${progressTo20}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500">Lifetime Earned &amp; Pending</div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
              {formatCurrencyFromUsd(userStats.lifetimeEarned, selectedCountry)}
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              Pending {formatCurrencyFromUsd(analytics.totalPendingWithdrawals, selectedCountry)}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Withdrawn: <strong className="font-mono tabular-nums text-slate-800">{formatCurrencyFromUsd(analytics.totalWithdrawnCompleted, selectedCountry)}</strong></span>
            <button
              type="button"
              onClick={() => setStreakModalOpen(true)}
              className="text-amber-700 hover:text-amber-800 font-semibold cursor-pointer inline-flex items-center gap-1"
            >
              <Flame className="w-3 h-3" />
              <span className="font-mono tabular-nums">{userStats.streakDays}d ({userStats.streakDays >= 7 ? '+20%' : '+10%'})</span>
            </button>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500">Today&apos;s Tier Quota</div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
              {dailyQuotaStatus.usedToday} / {dailyQuotaStatus.rule.dailyLimit}
            </span>
            <span className="text-xs font-mono tabular-nums text-brand-700 font-semibold">
              8:00 AM EAT Drop
            </span>
          </div>
          <div className="mt-2.5 text-[11px] text-slate-500 flex items-center justify-between">
            <span>{dailyQuotaStatus.rule.dailyUnitLabel}</span>
            <span className="font-mono tabular-nums font-semibold text-slate-700">
              {dailyQuotaStatus.remainingToday} left today
            </span>
          </div>
          <div className="mt-1.5 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 rounded-full" style={{ width: `${dailyQuotaPct}%` }} />
          </div>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 bg-white">
          <div className="text-xs font-medium text-slate-500">Tasks &amp; Partner Earnings</div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold font-mono tabular-nums text-slate-900">
              {taskHistory.length} Tasks
            </span>
            <span className="text-xs font-mono tabular-nums text-slate-600 font-semibold">
              {analytics.avgAccuracy}% QA
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
            <span>Ref Bonus: <strong className="font-mono tabular-nums text-emerald-700">{formatCurrencyFromUsd(referralStats.totalCommissionEarned, selectedCountry)}</strong></span>
            <span>Tier: <strong className="text-slate-800">{userStats.tier}</strong></span>
          </div>
        </div>
      </div>

      {/* Segmented Navigation Bar */}
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 min-w-max">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                subTab === tab.id
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* SUB-TAB 1: OVERVIEW */}
      {subTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Columns: Earnings Chart & Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">7-Day Earnings Trend</h2>
                  <p className="text-xs text-slate-500">
                    Daily task rewards approved in {selectedCountry.currency} across the past 7 days
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab('analytics')}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 whitespace-nowrap cursor-pointer"
                >
                  Full Analytics →
                </button>
              </div>

              {taskHistory.length === 0 ? (
                <div className="py-10 text-center border border-dashed border-slate-200 rounded-lg space-y-2.5">
                  <TrendingUp className="w-6 h-6 text-slate-400 mx-auto" />
                  <div className="text-sm font-semibold text-slate-800">
                    No earnings recorded yet
                  </div>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Complete today&apos;s 8:00 AM EAT daily task drop (rewards set by the merchant per task) to start populating your daily earnings chart.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tasks')}
                    className="mt-1 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Start Your First Task
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="h-40 flex items-end gap-2 sm:gap-3 pt-4 border-b border-slate-200 pb-2">
                    {analytics.dailySeries7.map((day) => {
                      const heightPct = Math.max(
                        day.earned > 0 ? 12 : 3,
                        Math.round((day.earned / analytics.maxDailyEarned7) * 100)
                      );
                      return (
                        <div key={day.dateKey} className="flex-1 flex flex-col items-center justify-end h-full gap-1.5">
                          <span className="text-[10px] font-mono tabular-nums text-slate-600 font-semibold">
                            {day.earned > 0 ? formatCurrencyFromUsd(day.earned, selectedCountry) : ''}
                          </span>
                          <div className="w-full max-w-[40px] flex-1 flex items-end">
                            <div
                              title={`${day.label}: ${formatCurrencyFromUsd(day.earned, selectedCountry)} (${day.count} task${day.count === 1 ? '' : 's'})`}
                              className={`w-full rounded-t-md transition-all ${
                                day.earned > 0 ? 'bg-brand-600 hover:bg-brand-700' : 'bg-slate-100'
                              }`}
                              style={{ height: `${heightPct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3">
                    {analytics.dailySeries7.map((day) => (
                      <div key={day.dateKey} className="flex-1 text-center text-[11px] font-mono text-slate-500 truncate">
                        {day.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Unified Recent Activity Feed */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Recent Account Activity</h2>
                  <p className="text-xs text-slate-500">
                    Tasks, PayPal payout requests, and referral bonuses
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSubTab('tasks')}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 whitespace-nowrap cursor-pointer"
                >
                  View All Tasks →
                </button>
              </div>

              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  Your completed tasks, payout requests, and referral payouts will appear here chronologically.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {recentActivity.map((ev) => (
                    <div key={ev.id} className="py-3 flex items-center justify-between gap-4 text-xs">
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 truncate">{ev.title}</div>
                        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="font-mono">{ev.meta}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ev.dateText}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-mono font-bold tabular-nums ${
                            ev.amountLabel.startsWith('+')
                              ? 'text-emerald-700'
                              : ev.amountLabel.startsWith('-')
                              ? 'text-slate-900'
                              : 'text-brand-700'
                          }`}
                        >
                          {ev.amountLabel}
                        </div>
                        <div
                          className={`text-[11px] font-semibold ${
                            ev.status === 'Approved' || ev.status === 'Completed'
                              ? 'text-emerald-700'
                              : ev.status === 'Rejected' || ev.status === 'Banned'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {ev.status}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Account, National ID KYC, & Milestones */}
          <div className="space-y-6">
            {/* National ID KYC & PayPal Payout Limits */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">National ID KYC &amp; Payouts</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedCountry.idDocumentName} · Status:{' '}
                    <strong
                      className={
                        kycStatus === 'Approved'
                          ? 'text-emerald-700'
                          : kycStatus === 'Rejected'
                          ? 'text-rose-700'
                          : kycStatus === 'Pending'
                          ? 'text-amber-700'
                          : 'text-slate-700'
                      }
                    >
                      {kycStatus}
                    </strong>
                  </p>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
              </div>

              <div className="text-xs text-slate-700 space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span className="text-slate-500">Daily Open Access</span>
                  <span className="font-mono font-semibold text-slate-900">{dailyQuotaStatus.rule.dailyUnitLabel}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Task Reward</span>
                  <span className="font-mono font-semibold text-slate-900">Varies by Merchant</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Min PayPal Withdrawal</span>
                  <span className="font-mono font-extrabold text-sky-800">{thresholdFormatted}</span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setSubTab('account-kyc')}
                  className="w-full py-2 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors cursor-pointer"
                >
                  {kycStatus === 'Approved'
                    ? 'View Approved National ID KYC'
                    : 'Upload Front & Back National ID KYC'}
                </button>
                <button
                  type="button"
                  onClick={() => (isAuthenticated ? openMyAccount('withdraw') : setWalletOpen(true))}
                  className="w-full py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
                >
                  PayPal Cash-Out ({thresholdFormatted}+)
                </button>
              </div>
            </div>

            {/* Registered Identity & Locked Payout Summary */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Account &amp; Security</h2>
                <button
                  type="button"
                  onClick={() => openMyAccount('details')}
                  className="text-xs font-semibold text-brand-700 hover:text-brand-800 cursor-pointer"
                >
                  Edit Details
                </button>
              </div>

              <div className="space-y-2 text-xs pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Registered Phone</span>
                  <span className="font-mono font-semibold text-slate-900">
                    {customerProfile?.phone || 'Not linked'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">Withdrawal Method</span>
                  <span className="font-semibold text-slate-900">
                    {customerProfile?.withdrawalDetails?.locked
                      ? `${customerProfile.withdrawalDetails.method} (Locked)`
                      : 'Set in My Account'}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-500">2FA Protection</span>
                  <span className={`font-semibold ${customerProfile?.twoFactorEnabled ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {customerProfile?.twoFactorEnabled
                      ? `Enabled (${customerProfile.twoFactorMethod.toUpperCase()})`
                      : 'Recommended'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => openMyAccount('withdraw')}
                  className="flex-1 py-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  My Account
                </button>
                <button
                  type="button"
                  onClick={() => setSecurityModalOpen(true)}
                  className="flex-1 py-2 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold cursor-pointer"
                >
                  {customerProfile?.twoFactorEnabled ? 'Manage 2FA' : 'Enable 2FA'}
                </button>
              </div>
            </div>

            {/* Category Breakdown Preview */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Earnings by Category</h2>
                <Award className="w-4 h-4 text-slate-400" />
              </div>

              {analytics.categoryRows.length === 0 ? (
                <p className="text-xs text-slate-500 py-2">
                  Category performance shares will appear after your first completed task.
                </p>
              ) : (
                <div className="space-y-3 pt-1">
                  {analytics.categoryRows.slice(0, 5).map((cat) => (
                    <div key={cat.category} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-slate-700">{cat.label}</span>
                        <span className="font-mono tabular-nums text-slate-900 font-semibold">
                          {formatCurrencyFromUsd(cat.totalUsd, selectedCountry)} ({cat.sharePct}%)
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-slate-800 rounded-full" style={{ width: `${cat.sharePct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: TASKS HISTORY */}
      {subTab === 'tasks' && (
        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Completed Tasks History</h2>
              <p className="text-xs text-slate-500">
                All completed surveys, annotations, data entry, and micro-tasks with accuracy scores and payouts
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  placeholder="Search title or ref..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-900 w-48 focus:border-brand-600 outline-hidden"
                />
              </div>

              <select
                value={taskCategoryFilter}
                onChange={(e) => setTaskCategoryFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium outline-hidden"
              >
                <option value="all">All Categories</option>
                {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>

              <select
                value={taskStatusFilter}
                onChange={(e) => setTaskStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white text-slate-700 font-medium outline-hidden"
              >
                <option value="all">All Statuses</option>
                <option value="Approved">Approved</option>
                <option value="Under Review">Under Review</option>
              </select>
            </div>
          </div>

          {filteredTasks.length === 0 ? (
            <div className="py-12 text-center space-y-2.5">
              <CheckCircle2 className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">
                {taskHistory.length === 0 ? 'No completed tasks yet' : 'No matching tasks found'}
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {taskHistory.length === 0
                  ? `Start with the 8:00 AM EAT daily dropped task (rewards set by the merchant, 100% free access) to earn ${selectedCountry.currency} payouts withdrawable via PayPal.`
                  : 'Try clearing your search or category filter.'}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (taskHistory.length === 0) {
                    setActiveTab('tasks');
                  } else {
                    setTaskSearch('');
                    setTaskCategoryFilter('all');
                    setTaskStatusFilter('all');
                  }
                }}
                className="mt-1 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                {taskHistory.length === 0 ? 'Explore Available Tasks' : 'Reset Filters'}
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[760px]">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Reference</th>
                    <th className="py-2.5 px-3 font-semibold">Task Title</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Accuracy</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Reward ({selectedCountry.currency})</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{t.transactionRef}</td>
                      <td className="py-3 px-3 font-semibold text-slate-900">{t.taskTitle}</td>
                      <td className="py-3 px-3 text-slate-600">{CATEGORY_LABELS[t.category] || t.category}</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">{t.accuracyScore}%</td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                        +{formatCurrencyFromUsd(t.reward, selectedCountry)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`font-semibold ${
                            t.status === 'Approved'
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-500">
                        {new Date(t.completedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3: WITHDRAWAL HISTORY */}
      {subTab === 'withdrawals' && (
        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Withdrawal History &amp; Live Payout Status</h2>
              <p className="text-xs text-slate-500">
                Minimum PayPal cash-out threshold is {thresholdFormatted} (KES 150 equivalent) · Mandatory Approved Front &amp; Back {selectedCountry.idDocumentName} KYC required
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200">
                {(['all', 'Processing', 'Completed', 'Rejected'] as const).map((statusOpt) => (
                  <button
                    key={statusOpt}
                    type="button"
                    onClick={() => setWithdrawalStatusFilter(statusOpt)}
                    className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      withdrawalStatusFilter === statusOpt
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {statusOpt === 'all' ? 'All' : statusOpt}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => (isAuthenticated ? openMyAccount('withdraw') : setWalletOpen(true))}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Request Payout</span>
              </button>
            </div>
          </div>

          <WithdrawalEligibilityGate>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="text-emerald-950">
                <strong className="font-bold">PayPal Withdrawal Eligibility Unlocked!</strong> Your balance ({localBalance}) and Approved National ID KYC are verified.
              </div>
              <button
                type="button"
                onClick={() => (isAuthenticated ? openMyAccount('withdraw') : setWalletOpen(true))}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold whitespace-nowrap cursor-pointer"
              >
                Open Payout Form →
              </button>
            </div>
          </WithdrawalEligibilityGate>

          {withdrawalsError && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs">
              {withdrawalsError}
            </div>
          )}

          {withdrawalsLoading ? (
            <div className="space-y-2.5 py-4">
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              <div className="h-10 bg-slate-100 rounded-lg animate-pulse" />
            </div>
          ) : filteredWithdrawals.length === 0 ? (
            <div className="py-12 text-center space-y-2.5">
              <Wallet className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-semibold text-slate-800">
                No withdrawal requests found
              </div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Once you meet the {thresholdFormatted} requirement, submit a payout request using your locked withdrawal details inside My Account or Wallet.
              </p>
              <button
                type="button"
                onClick={() => (isAuthenticated ? openMyAccount('withdraw') : setWalletOpen(true))}
                className="mt-1 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Open Payout Form
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left min-w-[780px]">
                <thead className="border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Request ID</th>
                    <th className="py-2.5 px-3 font-semibold">Method &amp; Destination</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Amount ({selectedCountry.currency})</th>
                    <th className="py-2.5 px-3 font-semibold">Status</th>
                    <th className="py-2.5 px-3 font-semibold">Receipt / Owner Note</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{w.id}</td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{w.method}</div>
                        <div className="font-mono text-[11px] text-slate-500">{w.accountDetails}</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                        {formatCurrencyFromUsd(w.amountUsd, selectedCountry)}
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 font-semibold ${
                            w.status === 'Completed'
                              ? 'text-emerald-700'
                              : w.status === 'Rejected'
                              ? 'text-rose-700'
                              : 'text-amber-700'
                          }`}
                        >
                          {w.status === 'Completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          ) : w.status === 'Rejected' ? (
                            <AlertCircle className="w-3.5 h-3.5" />
                          ) : (
                            <Clock className="w-3.5 h-3.5" />
                          )}
                          <span>{w.status === 'Processing' ? 'Pending Owner Approval' : w.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                        {w.gatewayReceipt || w.rejectedReason || (w.status === 'Processing' ? 'In Owner review queue' : '—')}
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-500">
                        {new Date(w.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 3B: PRODUCT AUCTIONS TRACKER */}
      {subTab === 'auctions' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Gavel className="w-4 h-4 text-blue-700" />
                <span>My Product Auctions &amp; Live Bids</span>
              </h2>
              <p className="text-xs text-slate-500">
                Track products you uploaded for auction, highest offers received, and active bids you placed across East Africa.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveTab('auctions')}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              <span>Open Auctions Marketplace</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">My Uploaded Products ({myUploadedAuctions.length})</h3>
                <button
                  type="button"
                  onClick={() => setActiveTab('auctions')}
                  className="text-xs font-semibold text-brand-700 hover:underline cursor-pointer"
                >
                  Upload New Product →
                </button>
              </div>
              {myUploadedAuctions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  You have not uploaded any product auctions yet. Click Upload New Product above to start selling to highest bidders.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myUploadedAuctions.map((auc) => {
                    const thumb = resolveAuctionImageUrl(auc.imageUrls?.[0]);
                    return (
                      <div key={auc.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="flex items-center gap-3 min-w-0">
                          {thumb && (
                            <img src={thumb} alt={auc.title} className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{auc.title}</div>
                            <div className="text-[11px] text-slate-500 font-mono">
                              {auc.bidCount} bid(s) · {auc.status}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-emerald-700">
                            {formatCurrencyFromKes(auc.currentBidKes, selectedCountry)}
                          </div>
                          <div className="text-[10px] text-slate-500">{auc.highestBidderName || 'No bids yet'}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">Auctions Where I Placed Bids ({myBidAuctions.length})</h3>
                <span className="text-[11px] font-mono text-slate-500">
                  {auctionsList.filter((a) => a.status === 'Live').length} Live Marketplace Items
                </span>
              </div>
              {myBidAuctions.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-lg">
                  You have not placed bids on any products yet. Visit the Auctions Marketplace to bid in {selectedCountry.currency}.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {myBidAuctions.map((auc) => {
                    const leading = auc.highestBidderUid === currentUid;
                    return (
                      <div key={auc.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-900 truncate">{auc.title}</div>
                          <div className="text-[11px] text-slate-500">
                            Seller: {auc.sellerName} · Status: <strong>{auc.status}</strong>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono font-bold text-slate-900">
                            {formatCurrencyFromKes(auc.currentBidKes, selectedCountry)}
                          </div>
                          <div className={`text-[10px] font-bold ${leading ? 'text-emerald-700' : 'text-amber-700'}`}>
                            {leading ? (auc.status === 'Sold' ? 'Auction Won' : 'Highest Bidder') : 'Outbid'}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: ANALYTICS */}
      {subTab === 'analytics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="text-xs text-slate-500">Average Task Payout</div>
              <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                {formatCurrencyFromUsd(analytics.avgReward, selectedCountry)}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Best task: {formatCurrencyFromUsd(analytics.highestReward, selectedCountry)}</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="text-xs text-slate-500">Task Accuracy Rate</div>
              <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-emerald-700">
                {analytics.avgAccuracy}%
              </div>
              <div className="mt-1 text-[11px] text-slate-500">Tier standing: {userStats.tier}</div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="text-xs text-slate-500">Daily Task Drop Window</div>
              <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                1 Task / Day
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                Dropped at 8:00 AM EAT · Merchant-set reward
              </div>
            </div>

            <div className="p-4 rounded-xl border border-slate-200 bg-white">
              <div className="text-xs text-slate-500">Next {thresholdFormatted} Cash-Out ETA</div>
              <div className="mt-1 text-2xl font-extrabold font-mono tabular-nums text-slate-900">
                {analytics.estDaysToCashout === 0 ? 'Threshold Met' : `${analytics.estDaysToCashout}d`}
              </div>
              <div className="mt-1 text-[11px] text-slate-500">
                {analytics.remainingTo20 === 0 ? 'Threshold reached' : `${formatCurrencyFromUsd(analytics.remainingTo20, selectedCountry)} remaining`}
              </div>
            </div>
          </div>

          {/* 14-Day Chart */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">14-Day Daily Earnings &amp; Task Volume</h2>
                <p className="text-xs text-slate-500">Computed from verified task submissions in your ledger</p>
              </div>
              <Calendar className="w-4 h-4 text-slate-400" />
            </div>

            <div className="h-44 flex items-end gap-1.5 sm:gap-2 pt-4 border-b border-slate-200 pb-2">
              {analytics.dailySeries14.map((day) => {
                const heightPct = Math.max(
                  day.earned > 0 ? 10 : 3,
                  Math.round((day.earned / analytics.maxDailyEarned14) * 100)
                );
                return (
                  <div key={day.dateKey} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
                    <span className="text-[9px] font-mono tabular-nums text-slate-600 hidden sm:inline">
                      {day.earned > 0 ? `${selectedCountry.symbol} ${convertUsdToLocal(day.earned, selectedCountry)}` : ''}
                    </span>
                    <div className="w-full max-w-[28px] flex-1 flex items-end">
                      <div
                        title={`${day.label}: ${formatCurrencyFromUsd(day.earned, selectedCountry)} (${day.count} tasks)`}
                        className={`w-full rounded-t transition-all ${
                          day.earned > 0 ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-100'
                        }`}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>{analytics.dailySeries14[0]?.label}</span>
              <span>{analytics.dailySeries14[Math.floor(analytics.dailySeries14.length / 2)]?.label}</span>
              <span>{analytics.dailySeries14[analytics.dailySeries14.length - 1]?.label}</span>
            </div>
          </div>

          {/* Category Performance Table */}
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <h2 className="text-base font-bold text-slate-900">Category Performance Matrix</h2>
            {analytics.categoryRows.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Complete tasks across Surveys, AI Annotation, Data Entry, or Micro Tasks to compare earnings per category.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[600px]">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Category</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Completed</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Avg Reward</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Avg Accuracy</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Total Earned</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Share</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {analytics.categoryRows.map((cat) => (
                      <tr key={cat.category} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-semibold text-slate-900">{cat.label}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">{cat.count}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">{formatCurrencyFromUsd(cat.avgReward, selectedCountry)}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">{cat.avgAccuracy}%</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                          {formatCurrencyFromUsd(cat.totalUsd, selectedCountry)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600">{cat.sharePct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 5: REFERRALS */}
      {subTab === 'referrals' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Referral Link &amp; 20% Commission Tracker</h2>
                <p className="text-xs text-slate-500">
                  Share your link and earn partner referral bonuses whenever invited East Africa contributors sign up and complete tasks
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('referrals')}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 whitespace-nowrap cursor-pointer"
              >
                Open Full Partner Hub →
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="flex-1 px-3.5 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-xs text-slate-800 truncate">
                {referralStats.referralLink}
              </div>
              <button
                type="button"
                onClick={handleCopyReferralLink}
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
              >
                {copiedRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedRef ? 'Copied Link' : 'Copy Referral Link'}</span>
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(`Join Gideon Global Tasks in East Africa & earn ${selectedCountry.currency} for surveys and AI tasks: ${referralStats.referralLink}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-xs font-semibold whitespace-nowrap"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Share WhatsApp</span>
              </a>
            </div>

            {editingCode ? (
              <form onSubmit={handleSaveReferralCode} className="flex flex-wrap items-center gap-2 pt-2">
                <input
                  type="text"
                  value={codeDraft}
                  onChange={(e) => setCodeDraft(e.target.value)}
                  placeholder="MY-CODE-2026"
                  className="px-3 py-1.5 rounded-lg border border-slate-300 font-mono text-xs text-slate-900 uppercase outline-hidden"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-brand-600 text-white text-xs font-semibold cursor-pointer"
                >
                  Save Code
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCode(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <div className="text-xs text-slate-500 flex items-center gap-3">
                <span>
                  Referral Code: <strong className="font-mono text-slate-900">{referralStats.referralCode}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCodeDraft(referralStats.referralCode);
                    setEditingCode(true);
                  }}
                  className="text-brand-700 hover:underline font-semibold cursor-pointer"
                >
                  Customize Code
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-slate-100 text-xs">
              <div>
                <div className="text-slate-500">Total Clicks</div>
                <div className="font-mono tabular-nums font-bold text-lg text-slate-900">{referralStats.totalClicks}</div>
              </div>
              <div>
                <div className="text-slate-500">Signups</div>
                <div className="font-mono tabular-nums font-bold text-lg text-slate-900">{referralStats.totalSignups}</div>
              </div>
              <div>
                <div className="text-slate-500">Qualified Invites</div>
                <div className="font-mono tabular-nums font-bold text-lg text-slate-900">{referralStats.passesPurchasedCount}</div>
              </div>
              <div>
                <div className="text-slate-500">Commission Earned</div>
                <div className="font-mono tabular-nums font-bold text-lg text-emerald-700">
                  {formatCurrencyFromUsd(referralStats.totalCommissionEarned, selectedCountry)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
            <h3 className="text-base font-bold text-slate-900">Referral Conversions Ledger</h3>
            {referralHistory.length === 0 ? (
              <div className="py-10 text-center space-y-2">
                <Users className="w-7 h-7 text-slate-300 mx-auto" />
                <div className="text-sm font-semibold text-slate-800">No referred conversions recorded yet</div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Share your link above with creators and taskers across Kenya, Uganda, Tanzania, and Rwanda to earn referral bonuses when they join and complete tasks.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[680px]">
                  <thead className="border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-3 font-semibold">Transaction ID</th>
                      <th className="py-2.5 px-3 font-semibold">Invited Contributor</th>
                      <th className="py-2.5 px-3 font-semibold">Milestone</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Activity Value</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Your Commission</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {referralHistory.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-500">{r.transactionId}</td>
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {r.refereeName} · <span className="text-slate-500 font-normal">{r.refereeCountry}</span>
                        </td>
                        <td className="py-3 px-3 text-slate-700">{r.passPurchased}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700">{formatCurrencyFromUsd(r.passPrice, selectedCountry)}</td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-emerald-700">
                          +{formatCurrencyFromUsd(r.commissionEarned, selectedCountry)}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-[11px] text-slate-500">{r.dateJoined}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 6: ACCOUNT & NATIONAL ID KYC VERIFICATION */}
      {subTab === 'account-kyc' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Identity & Permanently Locked My Account Info */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <UserIcon className="w-4 h-4 text-brand-600" />
                  <h2 className="text-base font-bold text-slate-900">My Account &amp; Permanently Locked Details</h2>
                </div>
                <button
                  type="button"
                  onClick={() => openMyAccount('details')}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 cursor-pointer"
                >
                  Open My Account
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">Account Lock Status</span>
                  <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                    {customerProfile?.accountDetailsLocked ? (
                      <>
                        <Lock className="w-3 h-3 text-emerald-700" />
                        <span className="text-emerald-800">All Account Details Permanently Locked</span>
                      </>
                    ) : (
                      <span className="text-amber-700">Set &amp; Lock in My Account</span>
                    )}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                    {customerProfile?.accountDetailsLocked ? <Lock className="w-3 h-3 text-slate-500" /> : null}
                    <span>{displayName}</span>
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">Mobile Phone (Immutable)</span>
                  <span className="font-mono font-semibold text-slate-900 inline-flex items-center gap-1">
                    {customerProfile?.phone ? <Lock className="w-3 h-3 text-amber-600" /> : null}
                    <span>{customerProfile?.phone || 'Not linked yet'}</span>
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">Email</span>
                  <span className="font-mono text-slate-800 inline-flex items-center gap-1">
                    {customerProfile?.accountDetailsLocked && customerProfile?.email ? <Lock className="w-3 h-3 text-slate-500" /> : null}
                    <span>{customerProfile?.email || user?.email || 'Not set'}</span>
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">City / County</span>
                  <span className="text-slate-800 inline-flex items-center gap-1">
                    {customerProfile?.accountDetailsLocked && customerProfile?.city ? <Lock className="w-3 h-3 text-slate-500" /> : null}
                    <span>{customerProfile?.city || 'Not set'}</span>
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">PayPal Destination (Locked)</span>
                  <span className="font-mono text-slate-900 text-right inline-flex items-center gap-1">
                    {customerProfile?.withdrawalDetails?.locked ? <Lock className="w-3 h-3 text-amber-600" /> : null}
                    <span>
                      {customerProfile?.withdrawalDetails?.locked
                        ? `PayPal · ${customerProfile.withdrawalDetails.accountDetails}`
                        : 'Not bound yet'}
                    </span>
                  </span>
                </div>
                <div className="py-2.5 flex justify-between gap-4">
                  <span className="text-slate-500">Two-Factor Security (2FA)</span>
                  <button
                    type="button"
                    onClick={() => setSecurityModalOpen(true)}
                    className="font-semibold text-brand-700 hover:underline cursor-pointer"
                  >
                    {customerProfile?.twoFactorEnabled
                      ? `${customerProfile.twoFactorMethod.toUpperCase()} Active (Manage)`
                      : 'Enable 2FA Now'}
                  </button>
                </div>
              </div>
            </div>

            {/* Withdrawal & Open Access Rules Card */}
            <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-900">Open-Access &amp; PayPal Withdrawal Rules</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('tasks')}
                  className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Browse Tasks
                </button>
              </div>

              <div className="divide-y divide-slate-100 text-xs">
                <div className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-700">Task Marketplace Access</span>
                  <span className="font-mono text-emerald-700 font-bold">100% Free · No Worker Pass</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-700">Daily Task Drop</span>
                  <span className="font-mono text-slate-900">{dailyQuotaStatus.rule.dailyUnitLabel} · 8:00 AM EAT</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-700">Payment Gateway</span>
                  <span className="font-mono text-sky-800 font-bold">PayPal Only</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-700">Minimum Withdrawal</span>
                  <span className="font-mono text-slate-900 font-bold">{thresholdFormatted} (KES 150 eq.)</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="font-medium text-slate-700">Strict KYC Document</span>
                  <span className="font-mono text-slate-900 font-semibold">{selectedCountry.idDocumentName} (Front + Back)</span>
                </div>
              </div>
            </div>
          </div>

          <KycVerificationPanel />
        </div>
      )}
    </div>
  );
};
