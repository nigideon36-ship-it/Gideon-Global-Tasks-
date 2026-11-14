import React, { useState, useMemo } from 'react';
import { useTasks } from '../context/TaskContext';
import { TaskCategory } from '../types/tasks';
import { History, Search, Download, CheckCircle2, Clock, Filter, ArrowUpRight, DollarSign, Award, Check } from 'lucide-react';

export const TaskHistoryView: React.FC = () => {
  const { taskHistory, userStats, setWalletOpen } = useTasks();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  const filteredHistory = useMemo(() => {
    return taskHistory.filter((item) => {
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (statusFilter !== 'all' && item.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = item.taskTitle.toLowerCase().includes(q);
        const matchRef = item.transactionRef.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        if (!matchTitle && !matchRef && !matchCat) return false;
      }
      return true;
    });
  }, [taskHistory, selectedCategory, statusFilter, searchQuery]);

  const totalRewardsApproved = useMemo(() => {
    return taskHistory
      .filter((h) => h.status === 'Approved')
      .reduce((sum, h) => sum + h.reward, 0);
  }, [taskHistory]);

  const handleExportCSV = () => {
    const headers = ['Transaction Ref', 'Task Title', 'Category', 'Completed At', 'Accuracy Score (%)', 'Reward (USD)', 'Status'];
    const rows = filteredHistory.map((h) => [
      h.transactionRef,
      `"${h.taskTitle.replace(/"/g, '""')}"`,
      h.category,
      `"${h.completedAt}"`,
      `${h.accuracyScore}%`,
      `$${h.reward.toFixed(2)}`,
      h.status
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gideon_task_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 2500);
  };

  const CATEGORY_TABS: { id: string; label: string }[] = [
    { id: 'all', label: 'All Tasks' },
    { id: 'survey', label: 'Surveys' },
    { id: 'annotation', label: 'AI Annotation' },
    { id: 'data-entry', label: 'Data Entry' },
    { id: 'writing', label: 'Writing' },
    { id: 'meme-content', label: 'Memes' },
    { id: 'micro', label: 'Micro Tasks' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-600 mb-1">
            <History className="w-3.5 h-3.5" />
            <span>Audit Trail & Task Ledger</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Completed Task History
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Track all completed surveys, AI annotations, data entries, copy submissions, and micro tasks with verified timestamps, accuracy scores, and approved payments.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-4 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-xs transition-colors"
          >
            {downloadSuccess ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Download className="w-3.5 h-3.5 text-slate-500" />}
            <span>{downloadSuccess ? 'CSV Exported' : 'Export CSV'}</span>
          </button>

          <button
            type="button"
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors whitespace-nowrap"
          >
            <span>Withdraw Balance (${userStats.balance.toFixed(2)})</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
            Total Tasks Completed
          </span>
          <div className="text-2xl font-bold font-mono text-slate-900 tabular-nums">
            {taskHistory.length}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            100% verified on ledger
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
            Total Approved Rewards
          </span>
          <div className="text-2xl font-bold font-mono text-emerald-600 tabular-nums">
            ${totalRewardsApproved.toFixed(2)}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Directly credited to wallet
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
            Average Quality Accuracy
          </span>
          <div className="text-2xl font-bold font-mono text-brand-600 tabular-nums">
            {userStats.qualityScore}%
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Gold Tier Contributor Benchmark
          </div>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
          <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
            Withdrawal Threshold
          </span>
          <div className="text-2xl font-bold font-mono text-slate-800 tabular-nums">
            $20.00
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">
            Starting from $20 via M-PESA & Mobile Money
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-4">
        {/* Category tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {CATEGORY_TABS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl whitespace-nowrap shrink-0 transition-all ${
                  isSelected
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Search input and status dropdown */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by title, ref ID, or category..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-brand-500 outline-hidden"
            />
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 outline-hidden focus:border-brand-500 font-medium"
            >
              <option value="all">All Statuses</option>
              <option value="Approved">Approved Only</option>
              <option value="Under Review">Under Review</option>
            </select>
          </div>
        </div>
      </div>

      {/* High-Density Data Grid Table (§2.A SaaS guidelines) */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
            <tr>
              <th className="py-3 px-5">Reference ID</th>
              <th className="py-3 px-5">Task Title</th>
              <th className="py-3 px-5">Category</th>
              <th className="py-3 px-5">Date & Time</th>
              <th className="py-3 px-5 text-right">Accuracy</th>
              <th className="py-3 px-5 text-right">Reward Paid</th>
              <th className="py-3 px-5 text-right">Approval Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400 text-xs">
                  No completed tasks found matching your filter criteria.
                </td>
              </tr>
            ) : (
              filteredHistory.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 transition-colors h-11">
                  <td className="py-2.5 px-5 font-mono font-medium text-slate-600 whitespace-nowrap">
                    {item.transactionRef}
                  </td>
                  <td className="py-2.5 px-5 font-semibold text-slate-900 max-w-[280px] truncate">
                    {item.taskTitle}
                  </td>
                  <td className="py-2.5 px-5">
                    <span className="capitalize text-slate-600 font-medium">
                      {item.category.replace('-', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {item.completedAt}
                  </td>
                  <td className="py-2.5 px-5 text-right font-mono font-bold text-slate-800 tabular-nums">
                    {item.accuracyScore.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-5 text-right font-mono font-bold text-emerald-600 tabular-nums">
                    +${item.reward.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-5 text-right">
                    <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>{item.status}</span>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
