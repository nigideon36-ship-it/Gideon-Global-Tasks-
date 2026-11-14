import React, { useState, useMemo } from 'react';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { convertKesToLocal } from '../lib/eastAfrica';
import {
  Share2,
  Copy,
  Check,
  Users,
  DollarSign,
  TrendingUp,
  Sparkles,
  ArrowUpRight,
  ShieldCheck,
  Search,
  Download,
  Flame,
  Zap,
  Globe,
  ExternalLink,
  Edit2,
  CreditCard,
  Send
} from 'lucide-react';

export const ReferralDashboard: React.FC = () => {
  const {
    referralStats,
    referralHistory,
    updateReferralCode,
    simulateReferralPurchase,
    userStats,
    setWalletOpen,
    setActiveTab
  } = useTasks();
  const { selectedCountry } = useRegion();
  const starterLocal = convertKesToLocal(50, selectedCountry);
  const proLocal = convertKesToLocal(100, selectedCountry);
  const vipLocal = convertKesToLocal(200, selectedCountry);

  const [copied, setCopied] = useState(false);
  const [editingCode, setEditingCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState(referralStats.referralCode);
  const [searchFilter, setSearchFilter] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [simulatedTier, setSimulatedTier] = useState<'starter' | 'pro' | 'vip'>('pro');

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
      if (tierFilter !== 'all') {
        if (tierFilter === 'starter' && !item.passPurchased.toLowerCase().includes('starter')) return false;
        if (tierFilter === 'pro' && !item.passPurchased.toLowerCase().includes('pro')) return false;
        if (tierFilter === 'vip' && !item.passPurchased.toLowerCase().includes('vip')) return false;
      }
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = item.refereeName.toLowerCase().includes(q);
        const matchCountry = item.refereeCountry.toLowerCase().includes(q);
        const matchRef = item.transactionId.toLowerCase().includes(q);
        if (!matchName && !matchCountry && !matchRef) return false;
      }
      return true;
    });
  }, [referralHistory, searchFilter, tierFilter]);

  const handleExportCSV = () => {
    const headers = ['Transaction ID', 'Referee Name', 'Country', 'Date Joined', 'Pass Tier', 'Pass Price ($)', 'Commission ($)', 'Method', 'Status'];
    const rows = filteredHistory.map((r) => [
      r.transactionId,
      r.refereeName,
      r.refereeCountry,
      r.dateJoined,
      r.passPurchased,
      r.passPrice.toFixed(2),
      r.commissionEarned.toFixed(2),
      r.paymentMethod,
      r.status
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gideon_referrals_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const shareText = encodeURIComponent(
    `Earn money with Surveys, AI Data Annotation, and Micro Tasks on Gideon Global Tasks! Sign up and activate your worker pass with my referral link: ${referralStats.referralLink}`
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-200">
      {/* Editorial Header */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 pb-6 border-b border-slate-100">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              <span>Affiliate & Partner Network</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-700 font-bold font-mono">20% Instant Pass Commission</span>
              <span aria-hidden="true">·</span>
              <span>Direct Wallet Payouts</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Referral Partner Dashboard
            </h1>
            <p className="text-xs md:text-sm text-slate-600 max-w-2xl">
              Share your unique invite link with friends, students, and remote workers across East Africa. Whenever a referred user signs up and purchases a <strong className="text-slate-800">Worker Pass (KES 50, KES 100, or KES 200)</strong>, you earn an instant <strong className="text-slate-800">20% commission</strong> credited directly to your balance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setWalletOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors shadow-xs"
            >
              Withdraw Earnings (${userStats.balance.toFixed(2)}) →
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
                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors shrink-0"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>{editingCode ? 'Cancel' : 'Customize Code'}</span>
              </button>
            </div>

            {/* Custom Code Form Dropdown */}
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
                    className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                  >
                    Save & Update Link
                  </button>
                </div>
              </form>
            )}

            {/* Quick Share Links */}
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

          {/* Referral Code Box */}
          <div className="lg:col-span-4 bg-gradient-to-br from-brand-900 to-slate-900 text-white p-5 rounded-2xl space-y-2 shadow-xs transition-colors">
            <span className="text-[11px] font-bold text-brand-300 uppercase tracking-wider block">
              Active Referral Code
            </span>
            <div className="text-xl font-mono font-black tracking-wider text-emerald-400">
              {referralStats.referralCode}
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed">
              Invited workers enter this code during signup or pass checkout to ensure your wallet is credited immediately.
            </p>
          </div>
        </div>
      </div>

      {/* 4-Column SaaS KPI Strip (§3.C / §1.H) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <div className="text-xs text-slate-500 font-medium">Total Commission Earned</div>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums mt-1">
            ${referralStats.totalCommissionEarned.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Credited to wallet balance</div>
        </div>

        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <div className="text-xs text-slate-500 font-medium">Commission Rate</div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {referralStats.commissionPercentage}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">On all pass tiers (KES 50–200)</div>
        </div>

        <div className="p-3 border-r border-slate-100 last:border-r-0">
          <div className="text-xs text-slate-500 font-medium">Passes Purchased</div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {referralStats.passesPurchasedCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Converted contributors</div>
        </div>

        <div className="p-3">
          <div className="text-xs text-slate-500 font-medium">Total Signups & Clicks</div>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums mt-1">
            {referralStats.totalSignups}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">{referralStats.totalClicks} link clicks tracked</div>
        </div>
      </div>

      {/* Commission Earnings Model & Mechanism-to-Outcome Chain */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">Starter Pass Referral</span>
            <span className="text-xs font-mono font-bold text-slate-700">KES 50 ({selectedCountry.currency} {starterLocal.toLocaleString()})</span>
          </div>
          <div className="text-xl font-bold font-mono text-emerald-600 tabular-nums">
            +KES 10 (~$0.08)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            When your invitee activates the KES 50 Starter Pass for survey access, you instantly receive 20% in your wallet.
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 ring-1 ring-brand-500/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-brand-950">Pro Tasker Referral</span>
              <span className="text-[10px] font-bold text-brand-600">Most Popular</span>
            </div>
            <span className="text-xs font-mono font-bold text-slate-700">KES 100 ({selectedCountry.currency} {proLocal.toLocaleString()})</span>
          </div>
          <div className="text-xl font-bold font-mono text-brand-600 tabular-nums">
            +KES 20 (~$0.15)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Earn KES 20 (~$0.15) each time a referral unlocks AI Annotation, Receipt Entry, and Meme Bounties with the KES 100 Pro Pass.
          </p>
        </div>

        <div className="p-5 bg-white rounded-2xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-900">VIP Taskmaster Referral</span>
            <span className="text-xs font-mono font-bold text-slate-700">KES 200 ({selectedCountry.currency} {vipLocal.toLocaleString()})</span>
          </div>
          <div className="text-xl font-bold font-mono text-amber-600 tabular-nums">
            +KES 40 (~$0.31)
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Earn KES 40 (~$0.31) commission when top freelancers purchase the KES 200 VIP Pass for copywriting and unlimited task quotas.
          </p>
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
              Simulate an invited friend joining and purchasing a pass via M-PESA or Card to verify immediate balance crediting.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center p-1 bg-slate-800 rounded-xl">
              <button
                type="button"
                onClick={() => setSimulatedTier('starter')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  simulatedTier === 'starter' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Starter (KES 50)
              </button>
              <button
                type="button"
                onClick={() => setSimulatedTier('pro')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  simulatedTier === 'pro' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                Pro (KES 100)
              </button>
              <button
                type="button"
                onClick={() => setSimulatedTier('vip')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  simulatedTier === 'vip' ? 'bg-brand-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                VIP (KES 200)
              </button>
            </div>

            <button
              type="button"
              onClick={() => simulateReferralPurchase(simulatedTier)}
              className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-current" />
              <span>
                Simulate Purchase (+${simulatedTier === 'starter' ? '0.08' : simulatedTier === 'vip' ? '0.31' : '0.15'})
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* High-Density Referral Activity Ledger */}
      <div className="bg-white rounded-3xl border border-slate-200 p-6 md:p-8 space-y-6 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Referral Commission Ledger
            </h2>
            <p className="text-xs text-slate-500">
              All invited contributors, converted worker passes, and instant wallet credit transactions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {/* Search */}
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

            {/* Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 outline-hidden"
            >
              <option value="all">All Passes</option>
              <option value="starter">Starter Pass (KES 50)</option>
              <option value="pro">Pro Pass (KES 100)</option>
              <option value="vip">VIP Pass (KES 200)</option>
            </select>

            {/* Export CSV */}
            <button
              type="button"
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* High-density Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Referee & Location</th>
                <th className="pb-3 font-semibold">Date Joined</th>
                <th className="pb-3 font-semibold">Pass Purchased</th>
                <th className="pb-3 font-semibold">Payment Rail</th>
                <th className="pb-3 font-semibold text-right">Commission (20%)</th>
                <th className="pb-3 font-semibold text-right">Status</th>
                <th className="pb-3 font-semibold text-right">Ref ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No referral conversion records found matching your filter criteria.
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
                      <span className="font-semibold text-slate-700">
                        {item.paymentMethod}
                      </span>
                    </td>

                    <td className="py-3 text-right font-mono font-bold text-emerald-600 tabular-nums">
                      +${item.commissionEarned.toFixed(2)}
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
              All referral commissions are combined with task earnings toward your <strong>$20.00 withdrawal milestone</strong>.
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('packages')}
            className="text-xs text-brand-600 hover:text-brand-800 font-bold hover:underline shrink-0"
          >
            View Worker Passes Catalog →
          </button>
        </div>
      </div>
    </div>
  );
};
