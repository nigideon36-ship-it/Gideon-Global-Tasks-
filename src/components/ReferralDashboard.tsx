import React, { useState, useMemo } from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import {
  convertUsdToLocal,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
  WITHDRAWAL_THRESHOLD_USD,
} from '../lib/eastAfrica';
import {
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  Search,
  Download,
  Zap,
  ExternalLink,
  Edit2,
} from 'lucide-react';

export const ReferralDashboard: React.FC = () => {
  const {
    referralStats,
    referralHistory,
    updateReferralCode,
    simulateReferralActivity,
    userStats,
    setWalletOpen,
    setActiveTab,
  } = useTasks();
  const { selectedCountry } = useRegion();

  const [copied, setCopied] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState(referralStats.referralCode);
  const [searchFilter, setSearchFilter] = useState('');

  const handleCopyLink = () => {
    navigator.clipboard.writeText(referralStats.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handleSaveCustomCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (updateReferralCode(customCodeInput)) {
      setEditingCode(false);
    }
  };

  const filteredHistory = useMemo(() => {
    return referralHistory.filter((item) => {
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = item.refereeName.toLowerCase().includes(q);
        const matchCountry = item.refereeCountry.toLowerCase().includes(q);
        const matchRef = item.transactionId.toLowerCase().includes(q);
        if (!matchName && !matchCountry && !matchRef) return false;
      }
      return true;
    });
  }, [referralHistory, searchFilter]);

  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Referee Name',
      'Country',
      'Date Joined',
      'Activity',
      `Commission (${selectedCountry.currency})`,
      'Gateway',
      'Status',
    ];
    const rows = filteredHistory.map((r) => [
      r.transactionId,
      r.refereeName,
      r.refereeCountry,
      r.dateJoined,
      r.passPurchased,
      convertUsdToLocal(r.commissionEarned, selectedCountry),
      'PayPal',
      r.status,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gideon_referrals_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareText = encodeURIComponent(
    `Earn money with free Surveys, AI Data Annotation, and Micro Tasks on Gideon Global Tasks! Join free with my invite link and withdraw via PayPal from ${formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)}: ${referralStats.referralLink}`
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Editorial Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Affiliate &amp; Partner Network</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-bold font-mono">20% Partner Commission</span>
              <span aria-hidden="true">·</span>
              <span>PayPal Withdrawals (KYC Verified)</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Referral Partner Dashboard
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl">
              Share your unique invite link with friends, students, and remote workers across East Africa. Tasks are <strong>100% free</strong> with no Worker Pass fees — whenever a referred contributor completes onboarding and verified platform activity, you earn a <strong className="text-slate-800">20% partner reward</strong> credited to your wallet.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs cursor-pointer"
            >
              Withdraw via PayPal ({formatCurrencyFromUsd(userStats.balance, selectedCountry)}) →
            </button>
          </div>
        </div>

        {/* Unique Link & Code Generator Bar */}
        <div className="pt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-8 space-y-3">
            <label className="text-xs font-bold text-slate-700 block">
              Your Unique Shareable Referral Link
            </label>

            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-800 font-mono select-all overflow-x-auto">
                <span className="truncate">{referralStats.referralLink}</span>
              </div>

              <button
                type="button"
                onClick={handleCopyLink}
                className="flex items-center justify-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-300 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied!' : 'Copy Link'}</span>
              </button>

              <button
                type="button"
                onClick={() => setEditingCode(!editingCode)}
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors shrink-0 cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{editingCode ? 'Cancel' : 'Customize Code'}</span>
              </button>
            </div>

            {editingCode && (
              <form onSubmit={handleSaveCustomCode} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Customize Your Referral Handle</span>
                  <span className="text-[11px] text-slate-500">Only letters, numbers, and hyphens</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customCodeInput}
                    onChange={(e) => setCustomCodeInput(e.target.value)}
                    placeholder="e.g. WORKWITHGIDEON"
                    className="flex-1 px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-200 rounded-xl text-slate-900 uppercase focus:border-brand-500 outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Save &amp; Update Link
                  </button>
                </div>
              </form>
            )}

            <div className="flex items-center gap-2 pt-1 flex-wrap">
              <span className="text-[11px] font-semibold text-slate-500">Quick Share:</span>
              <a
                href={`https://wa.me/?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
              >
                <span>WhatsApp</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(referralStats.referralLink)}&text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-800 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
              >
                <span>Telegram</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${shareText}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold rounded-lg transition-colors flex items-center gap-1"
              >
                <span>X / Twitter</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
          </div>

          <div className="lg:col-span-4 bg-gradient-to-br from-brand-900 to-slate-900 text-white p-5 rounded-2xl space-y-2 shadow-xs transition-colors">
            <span className="text-[11px] font-bold text-brand-300 uppercase tracking-wider block">
              Active Referral Code
            </span>
            <div className="text-xl font-mono font-black tracking-wider text-emerald-400">
              {referralStats.referralCode}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Invited workers enter this code during registration. Withdrawals unlock from {formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} via PayPal after Front &amp; Back National ID KYC approval.
            </p>
          </div>
        </div>
      </div>

      {/* 4-Column SaaS KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <div className="text-xs text-slate-500 font-medium">Total Commission Earned</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums mt-1">
            {formatCurrencyFromUsd(referralStats.totalCommissionEarned, selectedCountry)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Credited to wallet balance</div>
        </div>

        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <div className="text-xs text-slate-500 font-medium">Partner Commission Rate</div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {referralStats.commissionPercentage}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">On referred contributor earnings</div>
        </div>

        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <div className="text-xs text-slate-500 font-medium">Verified Referrals</div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {referralStats.passesPurchasedCount}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-0.5">
            Free open task onboarding
          </div>
        </div>

        <div className="p-3">
          <div className="text-xs text-slate-500 font-medium">Total Signups &amp; Clicks</div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {referralStats.totalSignups}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{referralStats.totalClicks} link clicks tracked</div>
        </div>
      </div>

      {/* Interactive Referral Testing Simulator */}
      <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/10 rounded-lg text-xs font-bold text-emerald-400">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Commission Simulation</span>
            </div>
            <h3 className="text-lg font-bold text-white mt-1">
              Test Referral Conversion in Real-Time
            </h3>
            <p className="text-xs text-slate-300">
              Simulate an invited friend joining free tasks to verify immediate balance crediting toward your PayPal cash-out.
            </p>
          </div>

          <button
            type="button"
            onClick={() => simulateReferralActivity()}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Zap className="w-4 h-4 fill-current" />
            <span>
              Simulate Verified Referral (+{formatCurrencyFromKes(30, selectedCountry)})
            </span>
          </button>
        </div>
      </div>

      {/* Referral Activity Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Referral Commission Ledger
            </h2>
            <p className="text-xs text-slate-500">
              All invited contributors and instant wallet credit transactions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter by name or country..."
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-brand-500 outline-hidden"
              />
            </div>

            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Referee &amp; Location</th>
                <th className="pb-3 font-semibold">Date Joined</th>
                <th className="pb-3 font-semibold">Verified Activity</th>
                <th className="pb-3 font-semibold">Payout Gateway</th>
                <th className="pb-3 font-semibold text-right">Commission</th>
                <th className="pb-3 font-semibold text-right">Status</th>
                <th className="pb-3 font-semibold text-right">Ref ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No referral conversion records found yet. Share your link above to start earning!
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{item.refereeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {item.refereeCountry} · {item.refereeEmailMasked}
                      </div>
                    </td>

                    <td className="py-3 text-slate-500 font-mono text-[11px]">
                      {item.dateJoined}
                    </td>

                    <td className="py-3 font-medium text-slate-800">
                      {item.passPurchased}
                    </td>

                    <td className="py-3">
                      <span className="font-semibold text-sky-800">
                        PayPal
                      </span>
                    </td>

                    <td className="py-3 text-right font-mono font-bold text-emerald-600 tabular-nums">
                      +{formatCurrencyFromUsd(item.commissionEarned, selectedCountry)}
                    </td>

                    <td className="py-3 text-right">
                      <span className="text-[11px] font-bold text-emerald-700">
                        Credited to Balance
                      </span>
                    </td>

                    <td className="py-3 text-right text-slate-400 font-mono text-[11px]">
                      {item.transactionId}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Withdrawal Threshold Note */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              All referral commissions combine with free task earnings toward your <strong>{formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, selectedCountry)} PayPal withdrawal minimum</strong> (KYC verified).
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('tasks')}
            className="text-xs text-brand-600 hover:text-brand-800 font-bold hover:underline shrink-0 cursor-pointer"
          >
            Browse Free Tasks →
          </button>
        </div>
      </div>
    </div>
  );
};
