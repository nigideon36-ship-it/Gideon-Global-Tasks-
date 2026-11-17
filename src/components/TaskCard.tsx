import React from 'react';
import { Task } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromUsd, formatCurrencyFromKes, MAX_TASK_REWARD_USD } from '../lib/eastAfrica';
import { ArrowRight, Star, Check, Lock } from 'lucide-react';

interface Props {
  task: Task;
  onSelect: (task: Task) => void;
}

export const TaskCard: React.FC<Props> = ({ task, onSelect }) => {
  const { userStats, activePackage, dailyQuotaStatus } = useTasks();
  const { selectedCountry } = useRegion();
  const isCompleted = userStats.completedTaskIds.includes(task.id);
  const eligibility = dailyQuotaStatus.canDoTask(task);

  const categoryNameMap: Record<string, string> = {
    survey: 'Survey',
    annotation: 'AI Annotation',
    'data-entry': 'Data Entry',
    writing: 'Writing',
    'meme-content': 'Meme & Content',
    'creator-campaign': 'Creator Campaign',
    micro: 'Micro Task'
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 p-5 md:p-6 transition-all hover:shadow-md flex flex-col justify-between group">
      <div>
        {/* Unboxed Metadata Header (No static pills) */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-2.5">
          <span className="font-semibold text-brand-600">
            {categoryNameMap[task.category] || task.category}
          </span>
          <span aria-hidden="true">·</span>
          <span>{task.estimatedMinutes} mins</span>
          <span aria-hidden="true">·</span>
          <span>{task.difficulty}</span>
          <span aria-hidden="true">·</span>
          <span>{task.createdAt}</span>
        </div>

        {/* Primary Title */}
        <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors leading-snug mb-2">
          {task.title}
        </h3>

        {/* Description */}
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
          {task.description}
        </p>

        {task.creatorCampaignConfig && (
          <div className="text-[11px] text-slate-500 font-medium mb-3">
            <span>{task.creatorCampaignConfig.allowedPlatforms.join(' / ')}</span>
            <span aria-hidden="true"> · </span>
            <span className="capitalize">
              {task.creatorCampaignConfig.allowedFormats.map((f) => f.replace('-', ' ')).join(', ')}
            </span>
          </div>
        )}

        {/* Requester details and tags */}
        <div className="flex items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-slate-700">{task.requesterName}</span>
            <span aria-hidden="true">·</span>
            <span className="flex items-center gap-0.5 text-amber-600 font-semibold">
              <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
              <span>{task.requesterRating}</span>
            </span>
          </div>

          <div className="text-[11px] text-slate-400 font-mono tabular-nums">
            {task.spotsRemaining} spots left
          </div>
        </div>
      </div>

      {/* Card Footer: Reward & Action CTA */}
      <div className="pt-4 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
            Earn Bounty
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrencyFromUsd(task.reward, selectedCountry)}
          </div>
        </div>

        {isCompleted ? (
          <button
            type="button"
            disabled
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-semibold border border-emerald-200 cursor-default"
          >
            <Check className="w-3.5 h-3.5" />
            <span>Completed</span>
          </button>
        ) : !eligibility.allowed ? (
          <button
            type="button"
            onClick={() => onSelect(task)}
            title={eligibility.reason}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            <span>
              {eligibility.reasonCode === 'DAILY_LIMIT_REACHED' ||
              eligibility.reasonCode === 'VIP_SURVEY_LIMIT_REACHED'
                ? `Limit (${dailyQuotaStatus.usedToday}/${dailyQuotaStatus.rule.dailyLimit})`
                : eligibility.requiredMinTier === 'starter'
                ? `Starter (${formatCurrencyFromKes(50, selectedCountry)})`
                : eligibility.requiredMinTier === 'pro'
                ? `2nd Pass (${formatCurrencyFromKes(100, selectedCountry)})`
                : `VIP Pass (${formatCurrencyFromKes(200, selectedCountry)})`}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onSelect(task)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shadow-xs group/btn cursor-pointer"
          >
            <span>{!activePackage && task.reward <= MAX_TASK_REWARD_USD ? 'Start Free Task' : 'Start Task'}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};
