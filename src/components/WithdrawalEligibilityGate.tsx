import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import {
  WITHDRAWAL_THRESHOLD_USD,
  meetsWithdrawalThreshold,
  formatCurrencyFromUsd,
} from '../lib/eastAfrica';
import { KycVerificationPanel } from './KycVerificationPanel';
import {
  Lock,
  CheckCircle2,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface WithdrawalEligibilityGateProps {
  children: React.ReactNode;
  onCloseParent?: () => void;
}

export const WithdrawalEligibilityGate: React.FC<WithdrawalEligibilityGateProps> = ({
  children,
  onCloseParent,
}) => {
  const { userStats, kycStatus, setActiveTab } = useTasks();
  const { isOwner } = useAuth();
  const { selectedCountry } = useRegion();

  const thresholdMet = meetsWithdrawalThreshold(userStats.balance);
  const kycApproved = kycStatus === 'Approved';

  // Owner or users with >= 150 KSh balance AND Approved National ID KYC see the PayPal payout form
  if (isOwner || (thresholdMet && kycApproved)) {
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

  // Step 1: Minimum 150 Shillings threshold
  if (!thresholdMet) {
    return (
      <div className="space-y-4">
        <div className="p-5 sm:p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">
                  Step 1: Reach Minimum Withdrawal Limit ({thresholdFormatted})
                </h3>
                <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                  Reach at least <strong className="font-mono text-slate-900">{thresholdFormatted}</strong> (150 shillings equivalent) and complete National ID KYC to withdraw via PayPal.
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
              All marketplace tasks are 100% free to complete — earn up to {thresholdFormatted} and verify your ID!
            </span>
            <button
              type="button"
              onClick={() => {
                onCloseParent?.();
                setActiveTab('tasks');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              <span>Complete Free Tasks to Earn</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Allow proactive KYC submission ahead of reaching 150 KSh */}
        <KycVerificationPanel compact />
      </div>
    );
  }

  // Step 2: Threshold reached -> Strictly require Approved Front & Back National ID KYC
  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-amber-50/70 border border-amber-300 space-y-4">
      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span>
          Minimum balance of <span className="font-mono">{thresholdFormatted}</span> reached ({balanceFormatted} available).
        </span>
      </div>

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-amber-900 text-white flex items-center justify-center shrink-0">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900">
            Step 2: Strict KYC Required — Upload Front &amp; Back of National ID
          </h3>
          <p className="text-xs text-slate-700 leading-relaxed">
            Withdrawals via <strong>PayPal</strong> are strictly locked until you upload clear photos of{' '}
            <strong>BOTH the Front AND Back</strong> of your{' '}
            <strong>{selectedCountry.idDocumentName}</strong> and receive Owner verification approval.
          </p>
        </div>
      </div>

      <KycVerificationPanel compact />
    </div>
  );
};
