import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth, OWNER_EMAIL } from '../context/AuthContext';
import { TaskCategory, TaskDifficulty } from '../types/tasks';
import {
  PlusCircle,
  Users,
  CheckCircle2,
  Sparkles,
  AlertCircle,
  Smartphone,
  Zap,
  Lock,
  Globe,
  MapPin,
  Wallet,
  Clock,
  XCircle,
  RefreshCw,
  Receipt,
  ListChecks,
  Search,
  DollarSign,
} from 'lucide-react';

interface OwnerWithdrawalItem {
  id: string;
  userUid: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  countryCode: string;
  amountUsd: number;
  method: string;
  accountDetails: string;
  status: 'Processing' | 'Completed' | 'Rejected';
  mpesaReceipt?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
}

type TransactionKind =
  | 'withdrawal'
  | 'pass_purchase'
  | 'task_reward'
  | 'referral_commission';

interface PlatformTransactionItem {
  id: string;
  kind: TransactionKind;
  title: string;
  customerLabel: string;
  gatewayOrMethod: string;
  currency: string;
  amountLocal?: number;
  amountUsd: number;
  status: 'Completed' | 'Processing' | 'Pending' | 'Rejected' | 'Failed';
  reference: string;
  countryCode: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  createdAt: string;
  updatedAt: string;
}

interface TransactionSummary {
  totalTransactions: number;
  pendingWithdrawalsCount: number;
  pendingWithdrawalsUsd: number;
  approvedWithdrawalsUsd: number;
  passRevenueUsd: number;
  taskRewardsUsd: number;
}

type ConsoleSectionTab = 'withdrawals' | 'transactions' | 'tasks';
type TxKindFilter = 'all' | TransactionKind;

export const EmployerPortal: React.FC = () => {
  const {
    tasks,
    taskHistory,
    postTask,
    setActiveTab,
    setDarajaModalOpen,
    setIntasendModalOpen,
    setPaystackModalOpen,
    setPublisherModalOpen,
  } = useTasks();
  const { user, idToken, isOwner, signInWithGoogle } = useAuth();

  const [consoleTab, setConsoleTab] = useState<ConsoleSectionTab>('withdrawals');
  const [withdrawals, setWithdrawals] = useState<OwnerWithdrawalItem[]>([]);
  const [transactions, setTransactions] = useState<PlatformTransactionItem[]>([]);
  const [summary, setSummary] = useState<TransactionSummary>({
    totalTransactions: 0,
    pendingWithdrawalsCount: 0,
    pendingWithdrawalsUsd: 0,
    approvedWithdrawalsUsd: 0,
    passRevenueUsd: 0,
    taskRewardsUsd: 0,
  });

  const [loadingData, setLoadingData] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [receiptInputs, setReceiptInputs] = useState<Record<string, string>>({});
  const [withdrawalFeedback, setWithdrawalFeedback] = useState<string | null>(null);
  const [withdrawalFilter, setWithdrawalFilter] = useState<'all' | 'Processing' | 'Completed' | 'Rejected'>('all');

  const [txKindFilter, setTxKindFilter] = useState<TxKindFilter>('all');
  const [txSearch, setTxSearch] = useState('');
  const [taskCategoryFilter, setTaskCategoryFilter] = useState<'all' | TaskCategory>('all');
  const [taskSearch, setTaskSearch] = useState('');

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('survey');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState<string>('2.50');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('4');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('Beginner');
  const [totalSpots, setTotalSpots] = useState<string>('50');
  const [instructionsText, setInstructionsText] = useState(
    '1. Review the provided materials carefully.\n2. Ensure answers are objective and accurate.\n3. Submit for instant automated verification.'
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadOwnerConsoleData = useCallback(async () => {
    if (!isOwner || !idToken) return;
    setLoadingData(true);
    try {
      const [wdRes, txRes] = await Promise.all([
        fetch('/api/owner/withdrawals', {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
        fetch('/api/owner/transactions', {
          headers: { Authorization: `Bearer ${idToken}` },
        }),
      ]);

      if (wdRes.ok) {
        const wdData = await wdRes.json();
        if (Array.isArray(wdData?.withdrawals)) {
          setWithdrawals(wdData.withdrawals);
        }
      }

      if (txRes.ok) {
        const txData = await txRes.json();
        if (Array.isArray(txData?.transactions)) {
          setTransactions(txData.transactions);
        }
        if (txData?.summary) {
          setSummary(txData.summary);
        }
      }
    } catch {
      // ignore transient network errors
    } finally {
      setLoadingData(false);
    }
  }, [isOwner, idToken]);

  useEffect(() => {
    void loadOwnerConsoleData();
  }, [loadOwnerConsoleData]);

  const handleApproveWithdrawal = async (item: OwnerWithdrawalItem) => {
    if (!idToken) return;
    setProcessingId(item.id);
    setWithdrawalFeedback(null);
    setErrorMsg(null);
    try {
      const customReceipt = (receiptInputs[item.id] || '').trim();
      const res = await fetch(`/api/owner/withdrawals/${encodeURIComponent(item.id)}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          disbursementChannel: item.method,
          ...(customReceipt ? { receiptCode: customReceipt } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok && data?.withdrawal) {
        setWithdrawals((prev) => prev.map((w) => (w.id === item.id ? data.withdrawal : w)));
        setWithdrawalFeedback(
          `Approved & disbursed $${item.amountUsd.toFixed(2)} (${item.id}) to ${item.accountDetails}. Receipt: ${data.withdrawal.mpesaReceipt || 'Settled'}`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Failed to approve withdrawal.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error approving withdrawal.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectWithdrawal = async (item: OwnerWithdrawalItem) => {
    if (!idToken) return;
    setProcessingId(item.id);
    setWithdrawalFeedback(null);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/owner/withdrawals/${encodeURIComponent(item.id)}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          reason: 'Declined by Platform Owner during verification review.',
        }),
      });
      const data = await res.json();
      if (res.ok && data?.withdrawal) {
        setWithdrawals((prev) => prev.map((w) => (w.id === item.id ? data.withdrawal : w)));
        setWithdrawalFeedback(
          `Rejected withdrawal ${item.id} ($${item.amountUsd.toFixed(2)}). Funds returned to customer wallet balance.`
        );
        void loadOwnerConsoleData();
      } else {
        setErrorMsg(data?.error || 'Failed to reject withdrawal.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error rejecting withdrawal.');
    } finally {
      setProcessingId(null);
    }
  };

  const numReward = parseFloat(reward) || 0;
  const numSpots = parseInt(totalSpots, 10) || 0;
  const totalCampaignBudget = (numReward * numSpots).toFixed(2);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please specify a descriptive task title.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please provide a brief summary of what the task involves.');
      return;
    }

    if (numReward < 0.25) {
      setErrorMsg('Minimum reward per task is $0.25.');
      return;
    }

    if (numSpots < 5) {
      setErrorMsg('Minimum worker quota is 5 spots.');
      return;
    }

    const instructions = instructionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const created = {
      title: title.trim(),
      category,
      description: description.trim(),
      reward: numReward,
      estimatedMinutes: parseInt(estimatedMinutes, 10) || 3,
      difficulty,
      totalSpots: numSpots,
      requesterName: 'You (Gideon Requester)',
      requesterRating: 5.0,
      requesterVerified: true,
      tags: [category.toUpperCase(), 'Verified Bounty'],
      instructions,
    };

    postTask(created);
    setSuccessMsg(`Task "${title}" created and posted to the marketplace!`);
    setTitle('');
    setDescription('');
    setIsCreating(false);
    setConsoleTab('tasks');
  };

  const pendingWithdrawalsCount = withdrawals.filter((w) => w.status === 'Processing').length;
  const pendingWithdrawalsUsd = withdrawals
    .filter((w) => w.status === 'Processing')
    .reduce((acc, w) => acc + w.amountUsd, 0);
  const approvedWithdrawalsUsd = withdrawals
    .filter((w) => w.status === 'Completed')
    .reduce((acc, w) => acc + w.amountUsd, 0);

  const filteredWithdrawals = useMemo(() => {
    if (withdrawalFilter === 'all') return withdrawals;
    return withdrawals.filter((w) => w.status === withdrawalFilter);
  }, [withdrawals, withdrawalFilter]);

  const filteredTransactions = useMemo(() => {
    const q = txSearch.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (txKindFilter !== 'all' && tx.kind !== txKindFilter) return false;
      if (!q) return true;
      return (
        tx.id.toLowerCase().includes(q) ||
        tx.reference.toLowerCase().includes(q) ||
        tx.title.toLowerCase().includes(q) ||
        tx.customerLabel.toLowerCase().includes(q) ||
        tx.gatewayOrMethod.toLowerCase().includes(q)
      );
    });
  }, [transactions, txKindFilter, txSearch]);

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (taskCategoryFilter !== 'all' && t.category !== taskCategoryFilter) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    });
  }, [tasks, taskCategoryFilter, taskSearch]);

  const serverTaskCompletions = useMemo(
    () => transactions.filter((t) => t.kind === 'task_reward'),
    [transactions]
  );

  const kindLabel = (kind: TransactionKind) => {
    switch (kind) {
      case 'withdrawal':
        return 'Withdrawal';
      case 'pass_purchase':
        return 'Worker Pass';
      case 'task_reward':
        return 'Task Reward';
      case 'referral_commission':
        return 'Referral 20%';
      default:
        return kind;
    }
  };

  if (!isOwner) {
    return (
      <div className="max-w-xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-lg text-center space-y-5">
        <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-200">
          <Lock className="w-7 h-7" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-extrabold text-slate-900">
            Owner Authorization Required
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Only the verified platform owner (<strong className="font-mono text-slate-900">{OWNER_EMAIL}</strong>) has authority to access the Owner Portal, approve customer withdrawals, track transactions, or configure payment gateways.
          </p>
          {user && (
            <p className="text-[11px] text-rose-700 font-mono bg-rose-50 px-3 py-1.5 rounded-lg inline-block">
              Signed in as: {user.email} (Customer Account)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {!user && (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Sign In as Owner ({OWNER_EMAIL})
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
          >
            Go to Tasks Marketplace
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-7 bg-white rounded-3xl border border-slate-200 shadow-sm my-4">
      {/* Top Banner */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-blue-700 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Owner &amp; Administrator Console ({OWNER_EMAIL})</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Platform, Payouts &amp; Transactions Console
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Approve customer withdrawals, audit every M-PESA / Paystack / IntaSend &amp; reward transaction, and monitor every task campaign across East Africa.
          </p>
          <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-emerald-50 border border-emerald-200 rounded-lg text-[11px] font-semibold text-emerald-800">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>East Africa Access Lock Active · Owner Authority Verified</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => void loadOwnerConsoleData()}
            disabled={loadingData}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>

          <button
            type="button"
            onClick={() => setPublisherModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4 text-blue-600" />
            <span>AdSense &amp; SEO</span>
          </button>

          <button
            type="button"
            onClick={() => setPaystackModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-sky-50 hover:bg-sky-100 text-[#0576A0] border border-sky-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Zap className="w-4 h-4 text-[#09A5DB]" />
            <span>Paystack STK &amp; Card</span>
          </button>

          <button
            type="button"
            onClick={() => setIntasendModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg text-xs font-bold transition-colors cursor-pointer"
          >
            <Zap className="w-4 h-4 text-indigo-600" />
            <span>IntaSend Gateway</span>
          </button>

          <button
            type="button"
            onClick={() => setDarajaModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>M-PESA Daraja</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isCreating ? 'Close Form' : 'Post a New Task'}</span>
          </button>
        </div>
      </div>

      {/* Live Summary KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setConsoleTab('withdrawals')}
          className="p-4 rounded-2xl border border-amber-200 bg-amber-50/70 cursor-pointer hover:border-amber-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-amber-800">
            <span>Pending Withdrawals</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            ${pendingWithdrawalsUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-amber-900">
            {pendingWithdrawalsCount} awaiting your approval
          </div>
        </div>

        <div
          onClick={() => setConsoleTab('withdrawals')}
          className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 cursor-pointer hover:border-emerald-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-800">
            <span>Approved Payouts</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            ${approvedWithdrawalsUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-900">
            {withdrawals.filter((w) => w.status === 'Completed').length} customer payouts settled
          </div>
        </div>

        <div
          onClick={() => setConsoleTab('transactions')}
          className="p-4 rounded-2xl border border-blue-200 bg-blue-50/70 cursor-pointer hover:border-blue-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-blue-800">
            <span>Pass &amp; Gateway Volume</span>
            <DollarSign className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            ${summary.passRevenueUsd.toFixed(2)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-blue-900">
            {summary.totalTransactions} total platform transactions
          </div>
        </div>

        <div
          onClick={() => setConsoleTab('tasks')}
          className="p-4 rounded-2xl border border-slate-200 bg-slate-50 cursor-pointer hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
            <span>Active Tasks &amp; Rewards</span>
            <ListChecks className="w-4 h-4 text-blue-700" />
          </div>
          <div className="mt-2 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            {tasks.length} Tasks
          </div>
          <div className="mt-1 text-[11px] font-medium text-slate-600">
            ${summary.taskRewardsUsd.toFixed(2)} logged rewards · {taskHistory.length} local logs
          </div>
        </div>
      </div>

      {/* Feedback & Errors */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="text-emerald-900 font-bold hover:underline cursor-pointer"
          >
            View in Marketplace →
          </button>
        </div>
      )}

      {withdrawalFeedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{withdrawalFeedback}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Creation Form Section */}
      {isCreating && (
        <div className="bg-slate-50 p-6 md:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Configure New Crowdsourced Task
              </h2>
              <p className="text-xs text-slate-600">
                Define the requirements and budget for East Africa contributors.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-800 bg-white px-3 py-1.5 rounded-lg border border-slate-300">
              Total Campaign Budget: ${totalCampaignBudget}
            </div>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Categorize 20 E-Commerce Customer Inquiries"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:border-blue-600 outline-hidden font-medium bg-white text-slate-900"
                >
                  <option value="survey">Survey (Market Research)</option>
                  <option value="annotation">Data Annotation (AI Training)</option>
                  <option value="data-entry">Data Entry &amp; Extraction</option>
                  <option value="writing">Writing &amp; Copywriting</option>
                  <option value="meme-content">Meme &amp; Content Creation</option>
                  <option value="micro">Fast Micro Tasks (30s)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Description:
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the goal and what the worker will produce..."
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reward / Submission ($)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.25"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono font-semibold focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Worker Quota
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={totalSpots}
                  onChange={(e) => setTotalSpots(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:border-blue-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-blue-600 outline-hidden bg-white text-slate-900"
                >
                  <option value="Beginner">Beginner (Anyone)</option>
                  <option value="Intermediate">Intermediate (Verified)</option>
                  <option value="Expert">Expert (Gold/Diamond Tier)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Step-by-Step Instructions (One per line):
              </label>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-mono focus:border-blue-600 outline-hidden"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-blue-200" />
                <span>Deploy Campaign to East Africa Network</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Prominent Console Switcher Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        <button
          type="button"
          onClick={() => setConsoleTab('withdrawals')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'withdrawals'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Wallet className="w-4 h-4" />
          <span>Withdrawal Approvals</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'withdrawals'
                ? 'bg-white/20 text-white'
                : pendingWithdrawalsCount > 0
                ? 'bg-amber-100 text-amber-800'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {pendingWithdrawalsCount} Pending
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'transactions'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>All Transactions</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'transactions'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {transactions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setConsoleTab('tasks')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
            consoleTab === 'tasks'
              ? 'bg-blue-700 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>All Tasks &amp; Submissions</span>
          <span
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono ${
              consoleTab === 'tasks'
                ? 'bg-white/20 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {tasks.length}
          </span>
        </button>
      </div>

      {/* TAB 1: WITHDRAWAL APPROVALS */}
      {consoleTab === 'withdrawals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                <span>Customer Withdrawal Approvals ({pendingWithdrawalsCount} Pending)</span>
              </h2>
              <p className="text-xs text-slate-600">
                Review each $20.00+ payout request, optionally enter your M-PESA/Bank disbursement reference, and click <strong>Approve &amp; Pay</strong> or <strong>Reject</strong>.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['all', 'Processing', 'Completed', 'Rejected'] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setWithdrawalFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                    withdrawalFilter === st
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {st === 'all' ? `All (${withdrawals.length})` : st}
                </button>
              ))}
            </div>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
            <table className="w-full text-xs text-left min-w-[760px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference / Date</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Rail &amp; Destination</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Owner Approval Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredWithdrawals.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 px-4 text-center text-slate-500">
                      No withdrawal requests match this filter yet. When contributors submit a $20+ cash-out, it appears here immediately for your approval.
                    </td>
                  </tr>
                ) : (
                  filteredWithdrawals.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{w.id}</div>
                        <div className="text-[11px] text-slate-500">{new Date(w.createdAt).toLocaleString()}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{w.customerName || 'Contributor'}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {w.customerPhone || w.customerEmail || w.userUid} · {w.countryCode}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-800">{w.method}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{w.accountDetails}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                        ${w.amountUsd.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            w.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : w.status === 'Rejected'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {w.status === 'Completed' ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : w.status === 'Rejected' ? (
                            <XCircle className="w-3 h-3" />
                          ) : (
                            <Clock className="w-3 h-3" />
                          )}
                          <span>{w.status}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {w.status === 'Processing' ? (
                          <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                            <input
                              type="text"
                              value={receiptInputs[w.id] || ''}
                              onChange={(e) =>
                                setReceiptInputs((prev) => ({ ...prev, [w.id]: e.target.value }))
                              }
                              placeholder="M-PESA/Bank Ref (optional)"
                              className="w-36 px-2 py-1 text-[11px] font-mono rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
                            />
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() => void handleApproveWithdrawal(w)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              {processingId === w.id ? 'Processing...' : 'Approve & Pay'}
                            </button>
                            <button
                              type="button"
                              disabled={processingId === w.id}
                              onClick={() => void handleRejectWithdrawal(w)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-[11px] font-bold cursor-pointer disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="text-[11px] font-mono text-slate-500">
                            {w.mpesaReceipt ? `Ref: ${w.mpesaReceipt}` : w.rejectionReason || 'Reviewed'}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: ALL PLATFORM TRANSACTIONS LEDGER */}
      {consoleTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-blue-700" />
                <span>Complete Transaction Ledger ({filteredTransactions.length})</span>
              </h2>
              <p className="text-xs text-slate-600">
                Real-time audit trail of every Worker Pass checkout, M-PESA/Paystack/IntaSend payment, withdrawal request/approval, task reward, and referral commission.
              </p>
            </div>

            <div className="relative w-full md:w-72">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search ID, customer, method..."
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { key: 'all', label: `All (${transactions.length})` },
                { key: 'withdrawal', label: 'Withdrawals' },
                { key: 'pass_purchase', label: 'Worker Passes' },
                { key: 'task_reward', label: 'Task Rewards' },
                { key: 'referral_commission', label: 'Referrals' },
              ] as const
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setTxKindFilter(f.key)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer transition-colors ${
                  txKindFilter === f.key
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
            <table className="w-full text-xs text-left min-w-[780px]">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Reference / Time</th>
                  <th className="py-3 px-4 font-semibold">Type</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Customer</th>
                  <th className="py-3 px-4 font-semibold">Gateway / Rail</th>
                  <th className="py-3 px-4 font-semibold text-right">Amount</th>
                  <th className="py-3 px-4 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 px-4 text-center text-slate-500">
                      No transactions recorded yet for this filter. New pass checkouts, completed tasks, referrals, and withdrawals appear here automatically.
                    </td>
                  </tr>
                ) : (
                  filteredTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono">
                        <div className="font-bold text-slate-900">{tx.reference || tx.id}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(tx.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-bold bg-slate-100 text-slate-800 border border-slate-200">
                          {kindLabel(tx.kind)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs">
                        {tx.title}
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700">
                        {tx.customerLabel} · {tx.countryCode}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        {tx.gatewayOrMethod}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <div className="font-bold text-slate-900">${tx.amountUsd.toFixed(2)}</div>
                        {typeof tx.amountLocal === 'number' && tx.currency !== 'USD' && (
                          <div className="text-[11px] text-slate-500">
                            {tx.currency} {tx.amountLocal.toLocaleString()}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                            tx.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : tx.status === 'Rejected' || tx.status === 'Failed'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: ALL TASKS & SUBMISSION TRACKER */}
      {consoleTab === 'tasks' && (
        <div className="space-y-8">
          {/* All Platform Task Campaigns */}
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  All Platform Tasks &amp; Campaigns ({filteredTasks.length} of {tasks.length})
                </h2>
                <p className="text-xs text-slate-600">
                  Full visibility across every active task campaign, bounty rate, claimed spots, and remaining worker quota.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={taskSearch}
                    onChange={(e) => setTaskSearch(e.target.value)}
                    placeholder="Filter tasks..."
                    className="w-full pl-8 pr-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 focus:border-blue-600 outline-hidden"
                  />
                </div>
                <select
                  value={taskCategoryFilter}
                  onChange={(e) => setTaskCategoryFilter(e.target.value as 'all' | TaskCategory)}
                  className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white text-slate-900 font-medium focus:border-blue-600 outline-hidden"
                >
                  <option value="all">All Categories</option>
                  <option value="survey">Surveys</option>
                  <option value="annotation">AI Annotation</option>
                  <option value="data-entry">Data Entry</option>
                  <option value="writing">Writing</option>
                  <option value="meme-content">Meme Content</option>
                  <option value="micro">Micro Tasks</option>
                </select>
              </div>
            </div>

            <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
              <table className="w-full text-xs text-left min-w-[700px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-5 font-semibold">Campaign Title</th>
                    <th className="py-3 px-5 font-semibold">Category</th>
                    <th className="py-3 px-5 font-semibold text-right">Bounty</th>
                    <th className="py-3 px-5 font-semibold text-right">Claimed / Remaining / Total</th>
                    <th className="py-3 px-5 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTasks.map((task) => {
                    const claimed = Math.max(0, task.totalSpots - task.spotsRemaining);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50/60">
                        <td className="py-3 px-5 font-medium text-slate-900">
                          <div>{task.title}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {task.requesterName} · {task.id}
                          </div>
                        </td>
                        <td className="py-3 px-5">
                          <span className="capitalize text-slate-700 font-medium">
                            {task.category.replace('-', ' ')}
                          </span>
                        </td>
                        <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                          ${task.reward.toFixed(2)}
                        </td>
                        <td className="py-3 px-5 text-right font-mono text-slate-700 tabular-nums">
                          {claimed} claimed · {task.spotsRemaining} / {task.totalSpots} left
                        </td>
                        <td className="py-3 px-5 text-right">
                          <span
                            className={`font-semibold ${
                              task.spotsRemaining > 0 ? 'text-emerald-600' : 'text-amber-700'
                            }`}
                          >
                            {task.spotsRemaining > 0 ? 'Active' : 'Filled'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Completed Task Activity & Reward Submissions */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-900">
              Recent Task Submissions &amp; Reward Payouts ({serverTaskCompletions.length + taskHistory.length})
            </h3>
            <div className="border border-slate-200 rounded-2xl overflow-x-auto bg-white">
              <table className="w-full text-xs text-left min-w-[680px]">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Reference</th>
                    <th className="py-3 px-4 font-semibold">Task Completed</th>
                    <th className="py-3 px-4 font-semibold">Category</th>
                    <th className="py-3 px-4 font-semibold">Contributor</th>
                    <th className="py-3 px-4 font-semibold text-right">Reward</th>
                    <th className="py-3 px-4 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {serverTaskCompletions.map((tx) => (
                    <tr key={`srv-${tx.id}`} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{tx.reference}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{tx.title}</td>
                      <td className="py-3 px-4 text-slate-700">{tx.gatewayOrMethod}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{tx.customerLabel}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        +${tx.amountUsd.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {taskHistory.map((h) => (
                    <tr key={`loc-${h.id}`} className="hover:bg-slate-50/60">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900">{h.transactionRef}</td>
                      <td className="py-3 px-4 font-medium text-slate-900">{h.taskTitle}</td>
                      <td className="py-3 px-4 capitalize text-slate-700">{h.category.replace('-', ' ')}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">{h.completedAt}</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-700">
                        +${h.reward.toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px]">
                          {h.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
