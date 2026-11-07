import React from 'react';
import { useTasks } from '../context/TaskContext';
import { Trophy, Globe, Award, CheckCircle } from 'lucide-react';

export const LeaderboardView: React.FC = () => {
  const { leaderboard, userStats } = useTasks();

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-600 mb-1">
            <Trophy className="w-3.5 h-3.5" />
            <span>Weekly Performance Rankings</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Global Contributor Leaderboard
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Celebrating high-accuracy task masters across 140+ countries. Top 10 weekly contributors earn automated bonus pool shares and instant priority queue access.
          </p>
        </div>

        <div className="flex items-center gap-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs">
          <Award className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <div className="font-semibold text-slate-800">Your Current Status:</div>
            <div className="text-slate-600">
              Rank #14 · <strong className="text-amber-700 font-mono tabular-nums">${userStats.lifetimeEarned.toFixed(2)} Earned</strong> · {userStats.qualityScore}% Quality
            </div>
          </div>
        </div>
      </div>

      {/* Podium Top 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {leaderboard.slice(0, 3).map((user, idx) => (
          <div
            key={user.rank}
            className={`p-6 rounded-2xl border transition-all relative overflow-hidden flex flex-col justify-between ${
              idx === 0
                ? 'bg-gradient-to-b from-amber-50/50 to-white border-amber-200 shadow-md ring-1 ring-amber-200'
                : 'bg-white border-slate-200 shadow-xs'
            }`}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs font-mono ${
                    idx === 0
                      ? 'bg-amber-400 text-amber-950 shadow-xs'
                      : idx === 1
                      ? 'bg-slate-300 text-slate-800'
                      : 'bg-amber-700/20 text-amber-900'
                  }`}
                >
                  #{user.rank}
                </span>

                <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md">
                  {user.tier} Tier
                </span>
              </div>

              <div className="flex items-center gap-3 mb-4">
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
                />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">{user.name}</h3>
                  <div className="text-xs text-slate-400 flex items-center gap-1">
                    <Globe className="w-3 h-3" />
                    <span>{user.country}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Earnings</span>
                <span className="font-mono font-bold text-emerald-600 text-sm tabular-nums">
                  ${user.earnings.toFixed(2)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Accuracy</span>
                <span className="font-mono font-bold text-slate-800 text-sm tabular-nums">
                  {user.accuracyRate}%
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Full Leaderboard Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
            <tr>
              <th className="py-3 px-5 font-semibold">Rank</th>
              <th className="py-3 px-5 font-semibold">Contributor</th>
              <th className="py-3 px-5 font-semibold">Country</th>
              <th className="py-3 px-5 font-semibold">Tier</th>
              <th className="py-3 px-5 font-semibold text-right">Tasks Completed</th>
              <th className="py-3 px-5 font-semibold text-right">Accuracy Rate</th>
              <th className="py-3 px-5 font-semibold text-right">Total Earnings</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leaderboard.map((user) => (
              <tr key={user.rank} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3.5 px-5 font-mono font-bold text-slate-700">
                  #{user.rank}
                </td>
                <td className="py-3.5 px-5 font-medium text-slate-900">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={user.avatar}
                      alt={user.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                    <span>{user.name}</span>
                  </div>
                </td>
                <td className="py-3.5 px-5 text-slate-600 font-medium">
                  {user.country}
                </td>
                <td className="py-3.5 px-5">
                  <span className="text-slate-700 font-semibold">{user.tier}</span>
                </td>
                <td className="py-3.5 px-5 text-right font-mono text-slate-700 tabular-nums">
                  {user.tasksCompleted}
                </td>
                <td className="py-3.5 px-5 text-right font-mono font-semibold text-emerald-600 tabular-nums">
                  {user.accuracyRate}%
                </td>
                <td className="py-3.5 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                  ${user.earnings.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
