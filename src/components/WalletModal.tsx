import React, { useState, useEffect } from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import {
  isEastAfricaPhone,
  WITHDRAWAL_THRESHOLD_USD,
  convertUsdToLocal,
  localAmountToUsd,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
} from '../lib/eastAfrica';
import { PayoutRecord } from '../types/tasks';
import { WithdrawalEligibilityGate } from './WithdrawalEligibilityGate';
import { X, Wallet, ArrowUpRight, ShieldCheck, CheckCircle2, AlertCircle, Lock, Zap, Clock } from 'lucide-react';

export const WalletModal: React.FC = () => {
  const { userStats, walletOpen, setWalletOpen, requestPayout, activePackage, setPackagesModalOpen } = useTasks();
  const { customerProfile, openMyAccount } = useAuth();
  const { selectedCountry } = useRegion();

  const lockedWithdrawal = customerProfile?.withdrawalDetails?.locked
    ? customerProfile.withdrawalDetails
    : null;

  const minLocalAmount = convertUsdToLocal(WITHDRAWAL_THRESHOLD_USD, selectedCountry);
  const [payoutMethod, setPayoutMethod] = useState<PayoutRecord['method']>(
    (lockedWithdrawal?.method as PayoutRecord['method']) || 'M-PESA'
  );
  const [amount, setAmount] = useState<string>(String(minLocalAmount));
  const [accountDetails, setAccountDetails] = useState<string>(
    lockedWithdrawal?.accountDetails || customerProfile?.phone || selectedCountry.samplePhone
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setAmount(String(convertUsdToLocal(WITHDRAWAL_THRESHOLD_USD, selectedCountry)));
  }, [selectedCountry.code]);

  useEffect(() => {
    if (lockedWithdrawal) {
      setPayoutMethod(lockedWithdrawal.method);
      setAccountDetails(lockedWithdrawal.accountDetails);
      return;
    }
    if (payoutMethod === 'M-PESA' || payoutMethod === 'Airtel / MTN MoMo') {
      setAccountDetails(customerProfile?.phone || selectedCountry.samplePhone);
    }
  }, [selectedCountry.code, payoutMethod, lockedWithdrawal, customerProfile?.phone]);

  if (!walletOpen) return null;

  const maxLocalBalance = convertUsdToLocal(userStats.balance, selectedCountry);
  const numLocalAmount = parseFloat(amount) || 0;
  const resolvedUsdAmount =
    Math.abs(numLocalAmount - maxLocalBalance) <= 1 && userStats.balance >= WITHDRAWAL_THRESHOLD_USD
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
      setErrorMsg(`Withdrawals start from ${thresholdLabel}. Continue completing tasks to reach ${thresholdLabel}.`);
      return;
    }

    if (resolvedUsdAmount > userStats.balance + 1e-4) {
      setErrorMsg(`Withdrawal amount exceeds available balance (${formatCurrencyFromUsd(userStats.balance, selectedCountry)}).`);
      return;
    }

    if (!accountDetails.trim()) {
      setErrorMsg(
        payoutMethod === 'M-PESA' || payoutMethod === 'Airtel / MTN MoMo'
          ? `Please enter your ${selectedCountry.name} mobile money number (${selectedCountry.dialCode}...).`
          : 'Please enter your recipient bank account or wallet details.'
      );
      return;
    }

    if (
      (payoutMethod === 'M-PESA' || payoutMethod === 'Airtel / MTN MoMo') &&
      !isEastAfricaPhone(accountDetails)
    ) {
      setErrorMsg(
        `East Africa Only: Mobile money withdrawals require a valid East Africa prefix (${selectedCountry.dialCode}...).`
      );
      return;
    }

    const success = requestPayout(resolvedUsdAmount, payoutMethod, accountDetails.trim());
    if (success) {
      setSuccessMsg(
        `${formatCurrencyFromUsd(resolvedUsdAmount, selectedCountry)} payout initiated via ${payoutMethod}! Funds scheduled for priority disbursement.`
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
                Gideon Global Wallet & Payouts
              </h2>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Pass: <strong className="text-brand-600">{activePackage?.name || 'Locked (No Active Pass)'}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Minimum Withdrawal: <strong className="text-slate-900 font-mono">{thresholdLabel}</strong></span>
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
          {/* Active Pass Banner */}
          <div className="p-4 bg-brand-50/70 border border-brand-200 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-brand-600 shrink-0" />
              <div>
                <span className="font-bold text-brand-950">
                  {activePackage
                    ? `Active Worker Pass: ${activePackage.name} (${formatCurrencyFromKes(activePackage.priceKes, selectedCountry)})`
                    : `Worker Pass: Locked (Activate ${formatCurrencyFromKes(50, selectedCountry)} / ${formatCurrencyFromKes(100, selectedCountry)} / ${formatCurrencyFromKes(200, selectedCountry)})`}
                </span>
                <p className="text-slate-600 text-[11px]">
                  {activePackage ? activePackage.taskAllowance : 'M-PESA Code + Screenshot required for Owner approval'} · 0% fee on withdrawals from {thresholdLabel} · Pay Pass via M-PESA: <strong className="font-extrabold font-mono text-emerald-900">0758727558</strong>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setWalletOpen(false);
                setPackagesModalOpen(true);
              }}
              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow-xs"
            >
              Change Pass ({formatCurrencyFromKes(50, selectedCountry)}–{formatCurrencyFromKes(200, selectedCountry)})
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
                {userStats.balance >= WITHDRAWAL_THRESHOLD_USD
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

          {/* Sequential Withdrawal Eligibility Gate & Form */}
          <WithdrawalEligibilityGate onCloseParent={() => setWalletOpen(false)}>
            <form onSubmit={handleWithdraw} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                  Request Payout (Minimum {thresholdLabel})
                </h3>
                <span className="text-xs font-mono font-semibold text-emerald-600">
                  0% Fee Applied
                </span>
              </div>

            {lockedWithdrawal ? (
              <div className="p-3 rounded-xl bg-white border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-slate-700">
                  <Lock className="w-3.5 h-3.5 text-slate-700 shrink-0" />
                  <span>
                    Locked to real registration payout: <strong>{lockedWithdrawal.method}</strong> ·{' '}
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
                    Tip: Lock your real withdrawal destination in <strong>My Account</strong> for instant 1-click cash-out verification.
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

            {/* Payout Channel Tabs with M-PESA prominent */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                {lockedWithdrawal ? 'Registered Destination Rail (Locked):' : 'Select Destination Rail:'}
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                {(['M-PESA', 'Airtel / MTN MoMo', 'East Africa Bank', 'Wise', 'Crypto USDT'] as const).map((method) => {
                  const isSelected = payoutMethod === method;
                  const isDisabledByLock = Boolean(lockedWithdrawal && lockedWithdrawal.method !== method);
                  return (
                    <button
                      key={method}
                      type="button"
                      disabled={isDisabledByLock}
                      onClick={() => {
                        if (!lockedWithdrawal) setPayoutMethod(method);
                      }}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                        isSelected
                          ? method === 'M-PESA'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                            : 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-xs'
                          : isDisabledByLock
                          ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700 cursor-pointer'
                      }`}
                    >
                      {method}
                    </button>
                  );
                })}
              </div>
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
                      step="50"
                      min={minLocalAmount}
                      max={maxLocalBalance}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full pl-14 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-semibold focus:border-indigo-500 outline-hidden"
                    />
                  </div>
                  <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                    <span>Threshold: {thresholdLabel}</span>
                    {userStats.balance >= WITHDRAWAL_THRESHOLD_USD && (
                      <button
                        type="button"
                        onClick={() => setAmount(String(maxLocalBalance))}
                        className="text-indigo-600 hover:underline font-semibold"
                      >
                        Withdraw All ({formatCurrencyFromUsd(userStats.balance, selectedCountry)})
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                    <span>
                      {payoutMethod === 'M-PESA' || payoutMethod === 'Airtel / MTN MoMo'
                        ? `${selectedCountry.name} Mobile Money Number (${selectedCountry.dialCode})`
                        : payoutMethod === 'Crypto USDT'
                        ? 'USDT Address (TRC-20)'
                        : payoutMethod === 'East Africa Bank'
                        ? 'Bank Name & Account / SWIFT'
                        : 'Wise Recipient Email'}
                    </span>
                    {lockedWithdrawal && (
                      <span className="text-[10px] font-semibold text-slate-500 inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Locked</span>
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    readOnly={Boolean(lockedWithdrawal)}
                    value={accountDetails}
                    onChange={(e) => {
                      if (!lockedWithdrawal) setAccountDetails(e.target.value);
                    }}
                    placeholder={
                      payoutMethod === 'M-PESA' || payoutMethod === 'Airtel / MTN MoMo'
                        ? selectedCountry.samplePhone
                        : payoutMethod === 'Crypto USDT'
                        ? 'e.g. TLq8x...39Fk'
                        : payoutMethod === 'East Africa Bank'
                        ? 'e.g. Equity / KCB / Stanbic Account #'
                        : 'e.g. name@domain.com'
                    }
                    className={`w-full px-3 py-2 text-xs rounded-xl border font-mono outline-hidden ${
                      lockedWithdrawal
                        ? 'border-slate-200 bg-slate-100 text-slate-700 font-semibold cursor-not-allowed'
                        : 'border-slate-300 bg-white focus:border-indigo-500'
                    }`}
                  />
                  {(payoutMethod === 'M-PESA' || payoutMethod === 'Airtel / MTN MoMo') && (
                    <div className="text-[11px] text-emerald-700 font-mono mt-1">
                      Estimated Payout: {selectedCountry.symbol} {Math.round(numLocalAmount).toLocaleString()} {selectedCountry.currency} (East Africa Instant B2C)
                    </div>
                  )}
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
                  <span>M-PESA STK & Bank Wire 256-Bit Escrow Security</span>
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
                  <span>Confirm {thresholdLabel}+ Withdrawal</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </WithdrawalEligibilityGate>

          {/* Payout History Ledger */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Recent Payout History
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
                    <th className="py-2.5 px-4 font-semibold">Account / Phone</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Amount</th>
                    <th className="py-2.5 px-4 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userStats.payoutHistory.map((rec) => (
                    <tr key={rec.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700">
                        <div>{rec.id}</div>
                        {rec.mpesaReceipt && (
                          <div className="text-[10px] text-emerald-600 font-mono">
                            M-PESA: {rec.mpesaReceipt}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{rec.method}</td>
                      <td className="py-2.5 px-4 text-slate-500 truncate max-w-[140px] font-mono">{rec.accountDetails}</td>
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Support Helpline */}
          <div className="p-3.5 rounded-2xl bg-blue-50 border border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-950">
            <div className="font-semibold">
              Experiencing withdrawal or account issues? Contact our support desk directly:
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
