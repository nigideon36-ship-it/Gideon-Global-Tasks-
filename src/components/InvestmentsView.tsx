import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromUsd, formatCurrencyFromKes } from '../lib/eastAfrica';
import { CANONICAL_PLATFORM_ORIGIN } from '../utils/platformUrl';
import {
  TrendingUp,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Clock,
  RefreshCw,
  Zap,
  Lock,
  ArrowLeft,
  Ban,
  Globe,
  ExternalLink,
} from 'lucide-react';

interface InvestmentPlan {
  id: 'starter-7d' | 'growth-14d' | 'vip-30d';
  name: string;
  minKes: number;
  durationDays: number;
  returnPct: number;
  description: string;
}

interface InvestmentRecord {
  id: string;
  planId: string;
  planName: string;
  amountKes: number;
  amountUsd: number;
  returnPct: number;
  expectedReturnKes: number;
  expectedReturnUsd: number;
  durationDays: number;
  depositMethod: string;
  senderPhone?: string;
  paymentReference: string;
  status: 'Pending Owner Approval' | 'Active' | 'Matured & Paid' | 'Rejected';
  ownerNotes?: string;
  payoutReceipt?: string;
  maturesAt?: string;
  settledAt?: string;
  createdAt: string;
}

const DEFAULT_PLANS: InvestmentPlan[] = [
  {
    id: 'starter-7d',
    name: '7-Day Seed Yield Pool',
    minKes: 50,
    durationDays: 7,
    returnPct: 12,
    description:
      'Accessible entry pool starting from KES 50+. Funded strictly via PayPal with a 7-day cycle.',
  },
  {
    id: 'growth-14d',
    name: '14-Day East Africa Growth',
    minKes: 250,
    durationDays: 14,
    returnPct: 25,
    description:
      'Balanced 2-week enterprise data annotation liquidity pool for PayPal deposits of KES 250 and above.',
  },
  {
    id: 'vip-30d',
    name: '30-Day AI Sovereign Vault',
    minKes: 1000,
    durationDays: 30,
    returnPct: 45,
    description:
      'High-yield 30-day enterprise fulfillment pool for PayPal deposits starting at KES 1,000+.',
  },
];

const LOCAL_STORAGE_INV_IDS = 'gideon_investment_ids_v1';

function readTrackedInvestmentIds(): string[] {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_INV_IDS);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveTrackedInvestmentId(id: string) {
  try {
    const existing = readTrackedInvestmentIds();
    if (!existing.includes(id)) {
      localStorage.setItem(LOCAL_STORAGE_INV_IDS, JSON.stringify([id, ...existing].slice(0, 40)));
    }
  } catch {}
}

export const InvestmentsView: React.FC = () => {
  const { activeToken, customerProfile, user } = useAuth();
  const { userStats, setActiveTab, showNotification } = useTasks();
  const { selectedCountry } = useRegion();

  const [plans, setPlans] = useState<InvestmentPlan[]>(DEFAULT_PLANS);
  const [selectedPlanId, setSelectedPlanId] = useState<'starter-7d' | 'growth-14d' | 'vip-30d'>('starter-7d');
  const [amountKesInput, setAmountKesInput] = useState<string>('50');
  const [customerName, setCustomerName] = useState<string>(
    customerProfile?.displayName || user?.displayName || ''
  );
  const [senderPhone, setSenderPhone] = useState<string>(
    customerProfile?.phone || selectedCountry.samplePhone
  );
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [paypalLinkData, setPaypalLinkData] = useState<{
    checkoutUrl: string;
    payPalMeUrl: string;
    amountUsd: number;
  } | null>(null);
  const [generatingPaypal, setGeneratingPaypal] = useState(false);

  const [myInvestments, setMyInvestments] = useState<InvestmentRecord[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customerProfile?.displayName && !customerName) {
      setCustomerName(customerProfile.displayName);
    }
    if (customerProfile?.phone && (!senderPhone || senderPhone === selectedCountry.samplePhone)) {
      setSenderPhone(customerProfile.phone);
    }
  }, [customerProfile?.displayName, customerProfile?.phone, customerName, senderPhone, selectedCountry.samplePhone]);

  const loadPlansAndInvestments = useCallback(async () => {
    setLoadingList(true);
    try {
      const tracked = readTrackedInvestmentIds();
      const query = tracked.length > 0 ? `?ids=${encodeURIComponent(tracked.join(','))}` : '';
      const [plansRes, myRes] = await Promise.all([
        fetch('/api/investments/plans'),
        fetch(`/api/investments/my${query}`, {
          headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        }),
      ]);

      if (plansRes.ok) {
        const pData = await plansRes.json();
        if (Array.isArray(pData?.plans) && pData.plans.length > 0) {
          setPlans(pData.plans);
        }
      }

      if (myRes.ok) {
        const mData = await myRes.json();
        if (Array.isArray(mData?.investments)) {
          setMyInvestments(mData.investments);
        }
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingList(false);
    }
  }, [activeToken]);

  useEffect(() => {
    void loadPlansAndInvestments();
  }, [loadPlansAndInvestments]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0];
  const parsedKes = Math.max(0, Math.round(Number(amountKesInput) || 0));
  const projectedReturnKes =
    parsedKes >= 50 ? Math.round(parsedKes * (1 + selectedPlan.returnPct / 100)) : 0;
  const projectedProfitKes = Math.max(0, projectedReturnKes - parsedKes);

  const handleSelectPlan = (plan: InvestmentPlan) => {
    setSelectedPlanId(plan.id);
    if ((Number(amountKesInput) || 0) < plan.minKes) {
      setAmountKesInput(String(plan.minKes));
    }
    setErrorMsg(null);
  };

  const handleGeneratePaypalInvestmentLink = async () => {
    setErrorMsg(null);
    setGeneratingPaypal(true);
    try {
      const amountUsd = Math.max(0.5, Number((parsedKes / 130).toFixed(2)));
      const res = await fetch('/api/paypal/generate-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          itemName: `${selectedPlan.name} Investment (KES ${parsedKes})`,
          amountUsd,
          packageId: selectedPlan.id,
          returnUrl: CANONICAL_PLATFORM_ORIGIN,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.link) {
        setErrorMsg(data?.error || 'Could not generate PayPal investment link.');
        return;
      }
      setPaypalLinkData({
        checkoutUrl: String(data.link.checkoutUrl),
        payPalMeUrl: String(data.link.payPalMeUrl),
        amountUsd: Number(data.link.amountUsd),
      });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error generating PayPal checkout link.');
    } finally {
      setGeneratingPaypal(false);
    }
  };

  const handleSubmitDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (customerProfile?.banned) {
      setErrorMsg(
        `Account permanently banned: ${customerProfile.bannedReason || 'Policy violation.'}`
      );
      return;
    }

    if (customerProfile?.deactivated) {
      setErrorMsg(
        `Account temporarily deactivated: ${customerProfile.deactivatedReason || 'Contact Support (+254712727558).'}`
      );
      return;
    }

    if (!Number.isFinite(parsedKes) || parsedKes < 50) {
      setErrorMsg('Minimum investment deposit is KES 50 (shillings 50 and above). Wallet balance cannot be used.');
      return;
    }

    if (parsedKes < selectedPlan.minKes) {
      setErrorMsg(
        `${selectedPlan.name} requires a minimum deposit of KES ${selectedPlan.minKes.toLocaleString()}. Switch to 7-Day Seed Yield Pool for KES 50+ deposits.`
      );
      return;
    }

    if (paymentReference.trim().length < 6) {
      setErrorMsg('Enter your valid PayPal Transaction ID (at least 6 characters) after completing PayPal payment.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/investments/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          planId: selectedPlanId,
          amountKes: parsedKes,
          depositMethod: 'PayPal',
          useWalletBalance: false,
          senderPhone: senderPhone.trim(),
          paymentReference: paymentReference.trim().toUpperCase(),
          countryCode: selectedCountry.code,
          customerName: customerName.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setErrorMsg(data?.error || 'Could not submit PayPal investment deposit.');
        setSubmitting(false);
        return;
      }

      if (data?.investment?.id) {
        saveTrackedInvestmentId(data.investment.id);
      }

      setPaymentReference('');
      setSuccessMsg(
        data.message ||
          `KES ${parsedKes.toLocaleString()} PayPal deposit submitted! Pending Owner verification.`
      );
      showNotification(`PayPal investment deposit of KES ${parsedKes.toLocaleString()} submitted!`);
      await loadPlansAndInvestments();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error while submitting PayPal investment deposit.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalInvestedKes = myInvestments
    .filter((i) => i.status !== 'Rejected')
    .reduce((sum, i) => sum + i.amountKes, 0);
  const totalExpectedReturnKes = myInvestments
    .filter((i) => i.status === 'Active' || i.status === 'Pending Owner Approval')
    .reduce((sum, i) => sum + i.expectedReturnKes, 0);
  const totalMaturedPaidKes = myInvestments
    .filter((i) => i.status === 'Matured & Paid')
    .reduce((sum, i) => sum + i.expectedReturnKes, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header & Return Nav */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline cursor-pointer mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customer Dashboard</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <TrendingUp className="w-7 h-7 text-emerald-600 shrink-0" />
            <span>East Africa Growth Investment Pools</span>
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Invest starting from <strong className="text-slate-900">KES 50 and above</strong> via <strong>PayPal</strong> in task liquidity pools and track maturity returns directly in your account.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void loadPlansAndInvestments()}
          disabled={loadingList}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer disabled:opacity-50 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
          <span>Refresh Portfolio</span>
        </button>
      </div>

      {/* Strict Deposit-Only Policy Banner */}
      <div className="p-4 rounded-2xl bg-amber-50 border-2 border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-amber-800 shrink-0 mt-0.5" />
          <div className="space-y-0.5 text-amber-950">
            <div className="font-extrabold uppercase tracking-wide">
              Strict Rule: External PayPal Deposit Only (KES 50+) — Wallet Balance Blocked
            </div>
            <p>
              All investments must be funded strictly by <strong>fresh PayPal deposit</strong>. Task earnings in your Wallet ({formatCurrencyFromUsd(userStats.balance, selectedCountry)}) can only be withdrawn via PayPal once KYC is approved and <strong>cannot</strong> be used to invest.
            </p>
          </div>
        </div>
        <div className="px-3 py-2 rounded-xl bg-white border border-amber-300 font-mono text-[11px] font-bold text-slate-800 shrink-0 flex items-center gap-1.5">
          <Ban className="w-3.5 h-3.5 text-rose-600" />
          <span>Wallet Pay: Disabled</span>
        </div>
      </div>

      {/* Portfolio KPI Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">Total Deposited</div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-slate-900 tabular-nums">
            KES {totalInvestedKes.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-slate-500 font-mono">
            {myInvestments.length} PayPal deposit{myInvestments.length === 1 ? '' : 's'}
          </div>
        </div>

        <div className="p-5 bg-emerald-50/70 rounded-2xl border border-emerald-200 shadow-xs">
          <div className="text-xs font-semibold text-emerald-800">Active &amp; Pending Expected Return</div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-emerald-950 tabular-nums">
            KES {totalExpectedReturnKes.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-emerald-800">
            Principal + projected yield upon maturity
          </div>
        </div>

        <div className="p-5 bg-blue-50/70 rounded-2xl border border-blue-200 shadow-xs">
          <div className="text-xs font-semibold text-blue-800">Matured &amp; Paid Out</div>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-blue-950 tabular-nums">
            KES {totalMaturedPaidKes.toLocaleString()}
          </div>
          <div className="mt-1 text-[11px] text-blue-800">
            Settled to PayPal by Platform Owner
          </div>
        </div>
      </div>

      {/* Plans Grid */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">
          1. Select Investment Pool (Starting From KES 50)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((plan) => {
            const active = selectedPlanId === plan.id;
            return (
              <button
                key={plan.id}
                type="button"
                onClick={() => handleSelectPlan(plan)}
                className={`p-5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                  active
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-slate-900">{plan.name}</span>
                    <span className="px-2.5 py-0.5 rounded-lg bg-emerald-600 text-white text-xs font-mono font-bold whitespace-nowrap">
                      +{plan.returnPct}% Return
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2 font-mono">
                    <span className="text-lg font-black text-slate-900 tabular-nums">
                      Min KES {plan.minKes.toLocaleString()}
                    </span>
                    <span className="text-xs text-slate-500">· {plan.durationDays} Days Cycle</span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{plan.description}</p>
                </div>
                <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-bold">
                  <span className={active ? 'text-emerald-700' : 'text-slate-500'}>
                    {active ? 'Selected Pool' : 'Click to Select'}
                  </span>
                  <ShieldCheck className={`w-4 h-4 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main PayPal Deposit Form */}
      <form
        onSubmit={handleSubmitDeposit}
        className="p-6 md:p-8 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-6"
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">
              2. PayPal Investment Deposit ({selectedPlan.name})
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Enter any deposit amount from <strong>KES 50 and above</strong> (KES {selectedPlan.minKes}+ for {selectedPlan.name}).
            </p>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-900 text-white font-mono text-xs flex flex-wrap items-center gap-4">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Deposit</div>
              <div className="font-bold text-sm tabular-nums">
                {formatCurrencyFromKes(parsedKes, selectedCountry)}
                {selectedCountry.code !== 'KE' ? ` (KSh ${parsedKes.toLocaleString()})` : ''}
              </div>
            </div>
            <div className="h-7 w-px bg-slate-700" />
            <div>
              <div className="text-[10px] text-emerald-300 uppercase">Expected Maturity ({selectedPlan.durationDays}d)</div>
              <div className="font-extrabold text-sm text-emerald-400 tabular-nums">
                KES {projectedReturnKes.toLocaleString()} (+KES {projectedProfitKes.toLocaleString()})
              </div>
            </div>
          </div>
        </div>

        {/* Amount KES Input + Quick Presets */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Deposit Amount in Shillings (KES 50 Minimum):
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono font-bold text-slate-500 text-xs">
                KES
              </span>
              <input
                type="number"
                min={50}
                step={1}
                value={amountKesInput}
                onChange={(e) => setAmountKesInput(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-sm font-extrabold text-slate-900 focus:border-emerald-600 outline-hidden"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {[50, 100, 250, 500, 1000, 2500, 5000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmountKesInput(String(preset))}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold border cursor-pointer ${
                    parsedKes === preset
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
                  }`}
                >
                  KES {preset.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1.5">
              Investor Full Name:
            </label>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Your registered name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-emerald-600 outline-hidden"
            />
            <p className="text-[11px] text-slate-500 mt-1.5">
              Deposits are audited by Owner (<code className="font-mono">nigideon36@gmail.com</code>) &amp; settled to your PayPal email on maturity.
            </p>
          </div>
        </div>

        {/* PayPal Checkout Details */}
        <div className="p-5 rounded-2xl bg-sky-50/80 border border-sky-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1 text-xs text-sky-950">
              <div className="font-extrabold flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-700" />
                <span>PayPal Deposit (~${Math.max(0.5, Number((parsedKes / 130).toFixed(2))).toFixed(2)} USD)</span>
              </div>
              <p className="text-[11px] text-sky-900">
                PayPal is the exclusive deposit &amp; payout gateway on Gideon Global Tasks. Click to generate a PayPal link, pay safely, and paste your Transaction ID below.
              </p>
            </div>
            <button
              type="button"
              disabled={generatingPaypal || parsedKes < 50}
              onClick={handleGeneratePaypalInvestmentLink}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold cursor-pointer disabled:opacity-50 shrink-0"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>{generatingPaypal ? 'Generating...' : 'Generate PayPal Checkout Link'}</span>
            </button>
          </div>

          {paypalLinkData && (
            <div className="p-3 rounded-xl bg-white border border-sky-300 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-slate-900">
                Ready: ${paypalLinkData.amountUsd.toFixed(2)} USD (KES {parsedKes.toLocaleString()})
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={paypalLinkData.checkoutUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0070ba] hover:bg-[#005ea6] text-white font-bold"
                >
                  <span>Open PayPal Checkout</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <a
                  href={paypalLinkData.payPalMeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 border border-sky-300 text-sky-900 font-bold"
                >
                  <span>PayPal.Me</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Contact Phone / WhatsApp:
              </label>
              <input
                type="tel"
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                PayPal Transaction ID *:
              </label>
              <input
                type="text"
                required
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value.toUpperCase())}
                placeholder="e.g. 4K928174H8239412L"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white font-mono text-xs font-bold uppercase text-slate-900"
              />
            </div>
          </div>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
          <div className="text-[11px] text-slate-500">
            Investments require Owner confirmation before activating and accrue returns over {selectedPlan.durationDays} days.
          </div>
          <button
            type="submit"
            disabled={submitting || parsedKes < 50}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50 shrink-0"
          >
            <TrendingUp className="w-4 h-4" />
            <span>
              {submitting
                ? 'Submitting PayPal Deposit...'
                : `Submit KES ${parsedKes.toLocaleString()} PayPal Deposit`}
            </span>
          </button>
        </div>
      </form>

      {/* Personal Investment Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">
              My PayPal Investment Deposits &amp; Maturity Ledger ({myInvestments.length})
            </h2>
            <p className="text-[11px] text-slate-500">
              Real-time status synced from Owner verification and PayPal settlement.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left min-w-[760px]">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">ID &amp; Date</th>
                <th className="py-3 px-4 font-semibold">Pool &amp; Cycle</th>
                <th className="py-3 px-4 font-semibold">PayPal Reference</th>
                <th className="py-3 px-4 font-semibold text-right">Deposited</th>
                <th className="py-3 px-4 font-semibold text-right">Expected Maturity</th>
                <th className="py-3 px-4 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myInvestments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 px-4 text-center text-slate-500">
                    No PayPal investments deposited yet. Start with any deposit from <strong>KES 50</strong> above to earn yield!
                  </td>
                </tr>
              ) : (
                myInvestments.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono">
                      <div className="font-bold text-slate-900">{inv.id}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(inv.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{inv.planName}</div>
                      <div className="text-[11px] text-slate-500">
                        +{inv.returnPct}% over {inv.durationDays} days
                        {inv.maturesAt ? ` · Matures ${new Date(inv.maturesAt).toLocaleDateString()}` : ''}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{inv.depositMethod}</div>
                      <div className="text-[11px] font-mono text-slate-600">Ref: {inv.paymentReference}</div>
                      {inv.payoutReceipt && (
                        <div className="text-[10px] font-mono text-emerald-700 font-bold">
                          PayPal Payout Receipt: {inv.payoutReceipt}
                        </div>
                      )}
                      {inv.ownerNotes && (
                        <div className="text-[11px] text-slate-600 mt-0.5">{inv.ownerNotes}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                      KES {inv.amountKes.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-extrabold text-emerald-700 tabular-nums">
                      KES {inv.expectedReturnKes.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                          inv.status === 'Matured & Paid'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : inv.status === 'Active'
                            ? 'bg-blue-100 text-blue-800 border border-blue-300'
                            : inv.status === 'Rejected'
                            ? 'bg-rose-100 text-rose-800 border border-rose-300'
                            : 'bg-amber-100 text-amber-900 border border-amber-300'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        <span>{inv.status}</span>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
