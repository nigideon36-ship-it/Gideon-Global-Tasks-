import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { PayoutRecord } from '../types/tasks';
import { X, Wallet, ArrowUpRight, ShieldCheck, CheckCircle2, AlertCircle, Clock, Smartphone, Zap, Check } from 'lucide-react';

export const WalletModal: React.FC = () => {
  const { userStats, walletOpen, setWalletOpen, requestPayout, activePackage, setPackagesModalOpen } = useTasks();

  const [payoutMethod, setPayoutMethod] = useState<PayoutRecord['method']>('M-PESA');
  const [amount, setAmount] = useState<string>('100.00');
  const [accountDetails, setAccountDetails] = useState<string>('+254 712 345 678');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!walletOpen) return null;

  const numAmount = parseFloat(amount) || 0;
  const isEligible = numAmount >= 100 && numAmount <= userStats.balance;
  const progressTo100 = Math.min(100, Math.round((userStats.balance / 100) * 100));

  const handleWithdraw = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (numAmount < 100) {
      setErrorMsg('Withdrawals start from $100.00. Continue completing tasks to reach the $100 cash-out milestone.');
      return;
    }

    if (numAmount > userStats.balance) {
      setErrorMsg(`Withdrawal amount exceeds available balance ($${userStats.balance.toFixed(2)}).`);
      return;
    }

    if (!accountDetails.trim()) {
      setErrorMsg(
        payoutMethod === 'M-PESA'
          ? 'Please enter your Safaricom M-PESA mobile number.'
          : 'Please enter your recipient account email or wallet address.'
      );
      return;
    }

    const success = requestPayout(numAmount, payoutMethod, accountDetails.trim());
    if (success) {
      setSuccessMsg(
        `$${numAmount.toFixed(2)} payout initiated via ${payoutMethod}! Funds scheduled for instant priority disbursement.`
      );
      setAmount('100.00');
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
                <span>Pass: <strong className="text-brand-600">{activePackage?.name || 'Active Pass'}</strong></span>
                <span aria-hidden="true">·</span>
                <span>Minimum Withdrawal: <strong className="text-slate-900 font-mono">$100.00</strong></span>
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
                <span className="font-bold text-brand-950">Active Worker Pass: {activePackage?.name || 'Pro Contributor'} (${activePackage?.price || 5})</span>
                <p className="text-slate-600 text-[11px]">
                  {activePackage?.taskAllowance} · 0% fee on withdrawals starting from $100.00.
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
              Change Pass ($2, $5, $10)
            </button>
          </div>

          {/* Balance Cards Strip */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-xs">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-1">
                Available to Cash Out
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-400">
                ${userStats.balance.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                {userStats.balance >= 100
                  ? 'Eligible for $100+ withdrawal'
                  : `$${(100 - userStats.balance).toFixed(2)} needed for $100 goal`}
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
                Pending Verification
              </div>
              <div className="text-2xl font-bold font-mono tabular-nums text-slate-800">
                ${userStats.pendingBalance.toFixed(2)}
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
                ${userStats.lifetimeEarned.toFixed(2)}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Across {userStats.completedTasksCount} completed tasks
              </div>
            </div>
          </div>

          {/* $100 Withdrawal Milestone Progress Meter */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1.5">
              <span>$100.00 Minimum Withdrawal Milestone</span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                ${userStats.balance.toFixed(2)} / $100.00 ({progressTo100}%)
              </span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  userStats.balance >= 100 ? 'bg-emerald-500' : 'bg-indigo-600'
                }`}
                style={{ width: `${progressTo100}%` }}
              />
            </div>
          </div>

          {/* Withdrawal Request Form */}
          <form onSubmit={handleWithdraw} className="p-6 bg-slate-50 rounded-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Request Payout (Minimum $100.00)
              </h3>
              <span className="text-xs font-mono font-semibold text-emerald-600">
                0% Fee Applied
              </span>
            </div>

            {/* Payout Channel Tabs with M-PESA prominent */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Select Destination Rail:
              </label>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {(['M-PESA', 'Wise', 'PayPal', 'Crypto USDT', 'Bank Wire', 'Amazon Gift Card'] as const).map((method) => {
                  const isSelected = payoutMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setPayoutMethod(method)}
                      className={`p-2.5 rounded-xl border text-xs font-semibold text-center transition-all ${
                        isSelected
                          ? method === 'M-PESA'
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-bold shadow-xs'
                            : 'border-indigo-600 bg-indigo-50/80 text-indigo-900 font-bold shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
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
                  Amount in USD ($) — Minimum $100.00
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-mono">$</span>
                  <input
                    type="number"
                    step="5"
                    min="100"
                    max={userStats.balance}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-xl border border-slate-300 font-mono font-semibold focus:border-indigo-500 outline-hidden"
                  />
                </div>
                <div className="flex justify-between items-center mt-1 text-[11px] text-slate-500">
                  <span>Threshold: $100.00</span>
                  {userStats.balance >= 100 && (
                    <button
                      type="button"
                      onClick={() => setAmount(userStats.balance.toFixed(2))}
                      className="text-indigo-600 hover:underline font-semibold"
                    >
                      Withdraw All (${userStats.balance.toFixed(2)})
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {payoutMethod === 'M-PESA'
                    ? 'Safaricom M-PESA Number'
                    : payoutMethod === 'Crypto USDT'
                    ? 'USDT Address (TRC-20)'
                    : payoutMethod === 'Bank Wire'
                    ? 'IBAN / Routing & Account #'
                    : 'Recipient Email Address'}
                </label>
                <input
                  type="text"
                  value={accountDetails}
                  onChange={(e) => setAccountDetails(e.target.value)}
                  placeholder={
                    payoutMethod === 'M-PESA'
                      ? '+254 7XX XXX XXX'
                      : payoutMethod === 'Crypto USDT'
                      ? 'e.g. TLq8x...39Fk'
                      : 'e.g. name@domain.com'
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:border-indigo-500 outline-hidden"
                />
                {payoutMethod === 'M-PESA' && (
                  <div className="text-[11px] text-emerald-700 font-mono mt-1">
                    Estimated M-PESA Payout: KES {(numAmount * 130).toLocaleString()} (Instant B2C transfer)
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
                <span>Confirm $100+ Withdrawal</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          {/* Payout History Ledger */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Recent Payout History
            </h3>
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
                        ${rec.amount.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <span
                          className={`font-semibold inline-flex items-center gap-1 ${
                            rec.status === 'Completed'
                              ? 'text-emerald-600'
                              : 'text-amber-600'
                          }`}
                        >
                          {rec.status === 'Completed' ? (
                            <CheckCircle2 className="w-3 h-3" />
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
        </div>
      </div>
    </div>
  );
};
