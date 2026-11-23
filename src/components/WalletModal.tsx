import React, { useState, useEffect } from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import {
  WITHDRAWAL_THRESHOLD_USD,
  meetsWithdrawalThreshold,
  convertUsdToLocal,
  localAmountToUsd,
  formatCurrencyFromUsd,
} from '../lib/eastAfrica';
import { WithdrawalEligibilityGate } from './WithdrawalEligibilityGate';
import { X, Wallet, ArrowUpRight, ShieldCheck, CheckCircle2, AlertCircle, Lock, Globe, Clock } from 'lucide-react';

export const WalletModal: React.FC = () => {
  const { userStats, walletOpen, setWalletOpen, requestPayout, kycStatus } = useTasks();
  const { customerProfile, openMyAccount } = useAuth();
  const { selectedCountry } = useRegion();

  const lockedWithdrawal =
    customerProfile?.withdrawalDetails?.locked && customerProfile.withdrawalDetails.method === 'PayPal'
      ? customerProfile.withdrawalDetails
      : null;

  const minLocalAmount = convertUsdToLocal(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
  const [amount, setAmount] = useState<string>(String(minLocalAmount));
  const [accountDetails, setAccountDetails] = useState<string>(
    lockedWithdrawal?.accountDetails || customerProfile?.email || ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setAmount(String(convertUsdToLocal(WITHDRAWAL_THRESHOLD_USD, selectedCountry)));
  }, [selectedCountry.code]);

  useEffect(() => {
    if (lockedWithdrawal) {
      setAccountDetails(lockedWithdrawal.accountDetails);
      return;
    }
    if (customerProfile?.email && !accountDetails) {
      setAccountDetails(customerProfile.email);
    }
  }, [lockedWithdrawal, customerProfile?.email]);

  if (!walletOpen) return null;

  const maxLocalBalance = convertUsdToLocal(userStats.balance, selectedCountry);
  const numLocalAmount = parseFloat(amount) || 0;
  const resolvedUsdAmount =
    Math.abs(numLocalAmount - maxLocalBalance) <= 1 && meetsWithdrawalThreshold(userStats.balance)
      ? userStats.balance
      : localAmountToUsd(numLocalAmount, selectedCountry);
  const isEligible =
    numLocalAmount >= minLocalAmount && resolvedUsdAmount <= userStats.balance + 1e-4;
  const thresholdLabel = formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry);

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (numLocalAmount < minLocalAmount) {
      setErrorMsg(`Withdrawals start from ${thresholdLabel} (150 shillings). Continue completing free tasks to reach ${thresholdLabel}.`);
      return;
    }

    if (resolvedUsdAmount > userStats.balance + 1e-4) {
      setErrorMsg(`Withdrawal amount exceeds available balance (${formatCurrencyFromUsd(userStats.balance, selectedCountry)}).`);
      return;
    }

    const emailClean = accountDetails.trim().toLowerCase();
    if (!emailClean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      setErrorMsg('Enter a valid PayPal email address (e.g. you@example.com).');
      return;
    }

    const success = requestPayout(resolvedUsdAmount, 'PayPal', emailClean);
    if (success) {
      setSuccessMsg(
        `${formatCurrencyFromUsd(resolvedUsdAmount, selectedCountry)} payout submitted via PayPal (${emailClean})! Pending Owner verification.`
      );
      setAmount(String(minLocalAmount));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 leading-tight">
                Gideon Global Wallet &amp; PayPal Payouts
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>Gateway: <strong className="text-sky-700">PayPal Only</strong></span>
                <span aria-hidden="true">·</span>
                <span>Minimum Withdrawal: <strong className="text-slate-900 font-mono">{thresholdLabel}</strong></span>
                <span aria-hidden="true">·</span>
                <span>KYC: <strong className={kycStatus === 'Approved' ? 'text-emerald-700' : 'text-amber-700'}>{kycStatus}</strong></span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setWalletOpen(false)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Open Access + Strict KYC Policy Banner */}
          <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-sky-700 shrink-0" />
              <div>
                <span className="font-bold text-slate-900">
                  100% Free Task Access · Withdrawals via PayPal from {thresholdLabel}
                </span>
                <p className="text-slate-600 text-[11px]">
                  No Worker Pass required. Strict KYC required: upload Front &amp; Back of your {selectedCountry.idDocumentName} in My Account or below before withdrawing.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setWalletOpen(false);
                openMyAccount('details');
              }}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs cursor-pointer"
            >
              Manage KYC &amp; PayPal Email
            </button>
          </div>

          {/* Balance Cards Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Available to Cash Out
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                {formatCurrencyFromUsd(userStats.balance, selectedCountry)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {meetsWithdrawalThreshold(userStats.balance)
                  ? `Threshold met (${thresholdLabel}+)`
                  : `${formatCurrencyFromUsd(Math.max(0, WITHDRAWAL_THRESHOLD_USD - userStats.balance), selectedCountry)} needed for threshold`}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Pending Verification
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-800">
                {formatCurrencyFromUsd(userStats.pendingBalance, selectedCountry)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Clears within 24 hours
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Lifetime Earnings
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-800">
                {formatCurrencyFromUsd(userStats.lifetimeEarned, selectedCountry)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Across {userStats.completedTasksCount} completed tasks
              </div>
            </div>
          </div>

          {/* Strict Withdrawal Eligibility Gate (150 Shillings Min + Approved Front/Back National ID KYC) */}
          <WithdrawalEligibilityGate onCloseParent={() => setWalletOpen(false)}>
            <form onSubmit={handleWithdraw} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Request PayPal Withdrawal (Minimum {thresholdLabel})
                </h3>
                <span className="text-xs font-mono font-semibold text-emerald-600">
                  0% Platform Fee · KYC Verified
                </span>
              </div>

              {lockedWithdrawal ? (
                <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 text-slate-700">
                    <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                    <span>
                      Locked to your registered PayPal email:{' '}
                      <span className="font-mono font-bold text-slate-900">{lockedWithdrawal.accountDetails}</span>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setWalletOpen(false);
                      openMyAccount('details');
                    }}
                    className="text-blue-700 hover:underline font-semibold whitespace-nowrap cursor-pointer"
                  >
                    Open My Account →
                  </button>
                </div>
              ) : (
                customerProfile && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-950">
                    <span>
                      Tip: Lock your PayPal payout email in <strong>My Account</strong> for instant 1-click cash-out security.
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setWalletOpen(false);
                        openMyAccount('details');
                      }}
                      className="text-amber-900 hover:underline font-bold whitespace-nowrap cursor-pointer"
                    >
                      Go to My Account →
                    </button>
                  </div>
                )
              )}

              {/* PayPal Gateway Badge */}
              <div className="p-3 rounded-xl border border-sky-600 bg-sky-50/80 text-sky-950 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 font-bold">
                  <Globe className="w-4 h-4 text-sky-700" />
                  <span>Payout Gateway: PayPal</span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-sky-800">
                  Disbursed to verified PayPal email
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Amount in {selectedCountry.currency} ({selectedCountry.symbol}) — Minimum {thresholdLabel}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500 font-mono">{selectedCountry.symbol}</span>
                    <input
                      type="number"
                      step="10"
                      min={minLocalAmount}
                      max={maxLocalBalance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-14 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-semibold focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                    <span>Threshold: {thresholdLabel}</span>
                    {meetsWithdrawalThreshold(userStats.balance) && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(maxLocalBalance))}
                        className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                      >
                        Withdraw All ({formatCurrencyFromUsd(userStats.balance, selectedCountry)})
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>Recipient PayPal Email</span>
                    {lockedWithdrawal && (
                      <span className="text-[10px] font-semibold text-slate-500 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </label>
                  <input
                    type="email"
                    readOnly={Boolean(lockedWithdrawal)}
                    value={accountDetails}
                    onChange={(e) => {
                      if (!lockedWithdrawal) setAccountDetails(e.target.value);
                    }}
                    placeholder="you@example.com"
                    className={`w-full px-3 py-2 text-xs rounded-xl border font-mono outline-hidden ${
                      lockedWithdrawal
                        ? 'border-slate-200 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed'
                        : 'border-slate-300 bg-white focus:border-indigo-500'
                    }`}
                  />
                  <div className="text-[11px] text-sky-700 font-mono mt-1">
                    Estimated PayPal Payout: ${resolvedUsdAmount.toFixed(2)} USD (~{selectedCountry.symbol} {Math.round(numLocalAmount).toLocaleString()} {selectedCountry.currency})
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>PayPal Disbursement · National ID KYC Verified</span>
                </div>

                <button
                  type="submit"
                  disabled={!isEligible}
                  className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-xs font-semibold text-white transition-all ${
                    isEligible
                      ? 'bg-slate-900 hover:bg-slate-800 shadow-sm cursor-pointer'
                      : 'bg-slate-300 cursor-not-allowed'
                  }`}
                >
                  <span>Confirm {thresholdLabel}+ PayPal Withdrawal</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </WithdrawalEligibilityGate>

          {/* Payout History Ledger */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent PayPal Payout History
              </h3>
              <span className="text-[11px] text-slate-500">
                Owner approval (<strong className="font-mono text-slate-700">nigideon36@gmail.com</strong>) required to disburse Processing payouts
              </span>
            </div>
            <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Reference ID</th>
                    <th className="py-2.5 px-4 font-semibold">Method</th>
                    <th className="py-2.5 px-4 font-semibold">PayPal Email</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Amount</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userStats.payoutHistory.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 px-4 text-center text-slate-400">
                        No PayPal withdrawals submitted yet. Reach {thresholdLabel} &amp; verify National ID KYC to unlock cash-outs.
                      </td>
                    </tr>
                  ) : (
                    userStats.payoutHistory.map((rec) => (
                      <tr key={rec.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-700">
                          <div>{rec.id}</div>
                          {rec.mpesaReceipt && (
                            <div className="text-[10px] text-emerald-600 font-mono">
                              PayPal TXN: {rec.mpesaReceipt}
                            </div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">{rec.method}</td>
                        <td className="py-2.5 px-4 text-slate-500 truncate max-w-[160px] font-mono">{rec.accountDetails}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 tabular-nums">
                          {formatCurrencyFromUsd(rec.amount, selectedCountry)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <span
                            className={`font-semibold inline-flex items-center gap-1 ${
                              rec.status === 'Completed'
                                ? 'text-emerald-600'
                                : rec.status === 'Rejected'
                                ? 'text-rose-600'
                                : 'text-amber-600'
                            }`}
                          >
                            {rec.status === 'Completed' ? (
                              <CheckCircle2 className="w-3 h-3" />
                            ) : rec.status === 'Rejected' ? (
                              <AlertCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            <span>{rec.status}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Support Helpline */}
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-950">
            <div className="font-semibold">
              Experiencing withdrawal, KYC, or account issues? Contact our support desk directly:
            </div>
            <div className="flex flex-wrap items-center gap-3 font-mono font-bold">
              <a
                href="tel:+254712727558"
                className="text-blue-700 hover:underline"
              >
                Call: +254712727558
              </a>
              <span aria-hidden="true" className="text-blue-300">·</span>
              <a
                href="https://wa.me/254785909543"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:underline"
              >
                WhatsApp: 0785909543
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
