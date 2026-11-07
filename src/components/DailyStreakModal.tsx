import React from 'react';
import { useTasks } from '../context/TaskContext';
import { X, Flame, Check, Gift, Sparkles, Calendar, ArrowRight, ShieldCheck, Trophy } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DailyStreakModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const { userStats, checkInDaily, advanceDailyStreak } = useTasks();

  if (!isOpen) return null;

  const currentStreak = userStats.streakDays;
  const multiplierPercent = currentStreak >= 7 ? 20 : 10;

  const DAYS = [
    { day: 1, label: 'Day 1', reward: '+10% Task Bonus' },
    { day: 2, label: 'Day 2', reward: '+10% Task Bonus' },
    { day: 3, label: 'Day 3', reward: '+10% Task Bonus' },
    { day: 4, label: 'Day 4', reward: '+10% Task Bonus' },
    { day: 5, label: 'Day 5', reward: '+10% Task Bonus' },
    { day: 6, label: 'Day 6', reward: '+10% Task Bonus' },
    { day: 7, label: 'Day 7', reward: '+$5.00 Cash Bonus & 20% Boost', isGrand: true }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white flex items-start justify-between relative overflow-hidden">
          <div className="relative z-10 space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-black/20 backdrop-blur-md rounded-full text-xs font-bold">
              <Flame className="w-3.5 h-3.5 fill-white text-white" />
              <span>Consecutive Contributor Streak</span>
            </div>
            <h2 className="text-2xl font-black tracking-tight mt-1">
              {currentStreak}-Day Active Streak! 🔥
            </h2>
            <p className="text-xs text-amber-100 max-w-md">
              Log in daily to maintain your streak. Reaching Day 7 unlocks a <strong className="text-white">+$5.00 cash milestone bonus</strong> and increases your earnings multiplier to <strong className="text-white">+20%</strong>!
            </p>
          </div>

          <button
            onClick={onClose}
            className="relative z-10 p-1.5 text-white/80 hover:text-white hover:bg-black/20 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 7-Day Visual Progress Track */}
        <div className="p-6 md:p-8 space-y-6">
          <div>
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              <span>7-Day Progression Track</span>
              <span className="font-mono text-amber-600 font-bold">
                {currentStreak >= 7 ? '7-Day Milestone Active (+20%)' : `${currentStreak} / 7 Days`}
              </span>
            </div>

            <div className="grid grid-cols-7 gap-2">
              {DAYS.map((item) => {
                const isPassed = currentStreak >= item.day;
                const isCurrent = currentStreak === item.day;
                const isMilestone = item.day === 7;

                return (
                  <div
                    key={item.day}
                    className={`p-3 rounded-2xl border text-center flex flex-col items-center justify-between transition-all ${
                      isPassed
                        ? isMilestone
                          ? 'bg-amber-50 border-amber-300 ring-2 ring-amber-400'
                          : 'bg-brand-50/60 border-brand-200'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </span>

                    <div className="my-2">
                      {isPassed ? (
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-white shadow-xs ${
                            isMilestone ? 'bg-amber-500' : 'bg-brand-600'
                          }`}
                        >
                          {isMilestone ? <Trophy className="w-4 h-4" /> : <Check className="w-4 h-4 stroke-[3]" />}
                        </div>
                      ) : isMilestone ? (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                          <Gift className="w-4 h-4" />
                        </div>
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-slate-400 text-xs font-bold font-mono">
                          {item.day}
                        </div>
                      )}
                    </div>

                    <span
                      className={`text-[9px] font-bold leading-tight ${
                        isMilestone ? 'text-amber-700 font-extrabold' : 'text-slate-600'
                      }`}
                    >
                      {isMilestone ? '+$5.00 & 20%' : '+10%'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Current Multiplier Status Card */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-[11px] uppercase font-bold text-slate-400 block tracking-wider">
                Active Earnings Multiplier
              </span>
              <div className="text-xl font-mono font-bold text-slate-900 tabular-nums">
                +{multiplierPercent}% Bonus on Every Task
              </div>
              <p className="text-[11px] text-slate-500">
                {currentStreak >= 7
                  ? 'Maximum 7-day boost active! You earn an extra 20% on all surveys, annotations, and tasks.'
                  : `Currently earning +10% bonus. Reach Day 7 to unlock +20% boost and $5.00 cash award.`}
              </p>
            </div>

            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
          </div>

          {/* Interactive Check-In and Next Day Simulation Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={checkInDaily}
              className="w-full sm:flex-1 py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Calendar className="w-4 h-4" />
              <span>Record Today's Check-In</span>
            </button>

            <button
              type="button"
              onClick={advanceDailyStreak}
              className="w-full sm:flex-1 py-3 px-4 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-extrabold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Flame className="w-4 h-4 fill-current" />
              <span>
                {currentStreak === 6
                  ? 'Simulate Day 7 (Claim $5.00 Bonus!)'
                  : 'Simulate Next Day Streak'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
