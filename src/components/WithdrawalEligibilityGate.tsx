import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import {
  WITHDRAWAL_THRESHOLD_USD,
  VIP_PASS_KES,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
} from '../lib/eastAfrica';
import {
  Lock,
  CheckCircle2,
  ArrowUpRight,
  Copy,
  Check,
  Users,
  Crown,
  Sparkles,
} from 'lucide-react';

interface WithdrawalEligibilityGateProps {
  children: React.ReactNode;
  onCloseParent?: () => void;
}

export const WithdrawalEligibilityGate: React.FC<WithdrawalEligibilityGateProps> = ({
  children,
  onCloseParent,
}) => {
  const {
    userStats,
    referralStats,
    vipReferralCount,
    hasVipReferral,
    setActiveTab,
    simulateReferralPurchase,
  } = useTasks();
  const { isOwner } = useAuth();
  const { selectedCountry } = useRegion();
  const [copied, setCopied] = useState(false);

  const thresholdMet = userStats.balance >= WITHDRAWAL_THRESHOLD_USD;

  // Owner or users who completed both sequential requirements see the payout form
  if (isOwner || (thresholdMet && hasVipReferral)) {
    return <>{children}</>;
  }

  const thresholdFormatted = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
  const balanceFormatted = formatCurrencyFromUsd(userStats.balance, selectedCountry);
  const remainingUsd = Math.max(0, WITHDRAWAL_THRESHOLD_USD - userStats.balance);
  const remainingFormatted = formatCurrencyFromUsd(remainingUsd, selectedCountry);
  const progressPct = Math.min(
    100,
    Math.round((userStats.balance / WITHDRAWAL_THRESHOLD_USD) * 100)
  );
  const vipPassLocal = formatCurrencyFromKes(VIP_PASS_KES, selectedCountry);

  const handleCopyInvite = () => {
    try {
      navigator.clipboard.writeText(referralStats.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  // REQUIREMENT 1 ONLY (NEVER mention or hint at referrals or VIP Worker Pass while balance < threshold)
  if (!thresholdMet) {
    return (
      <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Withdrawal Threshold Required
              </h3>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                You must reach the minimum withdrawal threshold of{' '}
                <strong className="font-mono text-slate-900">{thresholdFormatted}</strong> to unlock
                withdrawal requests.
              </p>
            </div>
          </div>
          <span className="font-mono font-bold text-xs text-slate-900 tabular-nums whitespace-nowrap">
            {progressPct}%
          </span>
        </div>

        <div className="p-4 rounded-xl bg-white border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Current Eligible Balance</span>
            <span className="font-mono font-bold text-slate-900 tabular-nums">
              {balanceFormatted} / {thresholdFormatted}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Remaining to reach threshold:</span>
            <strong className="font-mono text-slate-800 tabular-nums">{remainingFormatted}</strong>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-500">
            Complete available tasks to build your balance up to {thresholdFormatted}.
          </span>
          <button
            type="button"
            onClick={() => {
              onCloseParent?.();
              setActiveTab('tasks');
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
          >
            <span>Complete Tasks to Earn</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // REQUIREMENT 2 (REVEALED ONLY AFTER REQUIREMENT 1 IS COMPLETED)
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          Withdrawal threshold of <span className="font-mono">{thresholdFormatted}</span> reached ({balanceFormatted} available).
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-900 text-white flex items-center justify-center shrink-0">
          <Crown className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">
            Referral VIP Worker Pass Requirement
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed">
            To unlock your withdrawal request, any of your referred contributors must purchase the{' '}
            <strong className="text-slate-900">
              VIP Worker Pass of {vipPassLocal}
            </strong>
            .
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-white border border-amber-200 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-amber-700" />
            <span>VIP Pass Referrals Verified</span>
          </span>
          <span className="font-mono font-bold text-slate-900 tabular-nums">
            {vipReferralCount} / 1 Required
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-slate-600">
            Your Personal Referral Code &amp; Link ({referralStats.referralCode}):
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 font-mono text-[11px] text-slate-800 truncate">
              {referralStats.referralLink}
            </div>
            <button
              type="button"
              onClick={handleCopyInvite}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Invite Link'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <button
          type="button"
          onClick={() => {
            onCloseParent?.();
            setActiveTab('referrals');
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-900 hover:bg-amber-950 text-white text-xs font-bold transition-colors cursor-pointer"
        >
          <span>Open Referrals Hub</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => simulateReferralPurchase('vip')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 text-amber-950 text-xs font-semibold transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-700" />
          <span>Simulate Referral VIP Pass ({vipPassLocal})</span>
        </button>
      </div>
    </div>
  );
};
