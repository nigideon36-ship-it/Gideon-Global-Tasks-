import React, { useMemo } from 'react';
import { Task } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { formatCurrencyFromUsd } from '../lib/eastAfrica';
import { ArrowRight, Star, Check, Lock, Share2 } from 'lucide-react';
import { CANONICAL_PLATFORM_ORIGIN } from '../utils/platformUrl';

interface Props {
  task: Task;
  isDailyDrop?: boolean;
  onSelect: (task: Task) => void;
}

export const TaskCard: React.FC<Props> = ({ task, isDailyDrop = false, onSelect }) => {
  const { userStats, referralStats, dailyQuotaStatus, dailyDropInfo } = useTasks();
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

  const whatsappShareUrl = useMemo(() => {
    const origin = CANONICAL_PLATFORM_ORIGIN;
    const refParam = referralStats?.referralCode ? `&ref=${encodeURIComponent(referralStats.referralCode)}` : '';
    const taskUrl = `${origin}/?task=${encodeURIComponent(task.id)}&category=${encodeURIComponent(task.category)}${refParam}`;
    const rewardLabel = formatCurrencyFromUsd(task.reward, selectedCountry);
    const categoryLabel = categoryNameMap[task.category] || task.category;

    const message = [
      `Earn ${rewardLabel} on Gideon Global Tasks (${selectedCountry.name} & East Africa)!`,
      `Task: ${task.title}`,
      `Category: ${categoryLabel} · Est. ${task.estimatedMinutes} mins · Daily 08:00 AM EAT Drop`,
      `Join & claim free now: ${taskUrl}`,
    ].join('\n');

    return `https://wa.me/?text=${encodeURIComponent(message)}`;
  }, [task.id, task.title, task.category, task.reward, task.estimatedMinutes, selectedCountry, referralStats?.referralCode]);

  return (
    <div
      className={`bg-white rounded-2xl border p-5 md:p-6 transition-all hover:shadow-md flex flex-col justify-between group ${
        isDailyDrop && dailyDropInfo.isDropWindowOpen
          ? 'border-emerald-400 ring-2 ring-emerald-200/70'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-2.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            <span className="font-semibold text-brand-600">
              {categoryNameMap[task.category] || task.category}
            </span>
            {isDailyDrop && (
              <span className="text-[11px] font-bold text-emerald-700">
                · {dailyDropInfo.isDropWindowOpen ? "Today's 8:00 AM Drop" : 'Scheduled 8:00 AM Drop'}
              </span>
            )}
            <span aria-hidden="true">·</span>
            <span>{task.estimatedMinutes} mins</span>
            <span aria-hidden="true">·</span>
            <span>{task.difficulty}</span>
          </div>

          <a
            href={whatsappShareUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`Share ${task.title} on WhatsApp`}
            title="Share this task with your East African WhatsApp community"
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition-colors shrink-0"
          >
            <Share2 className="w-3 h-3 text-emerald-700" />
            <span>WhatsApp</span>
          </a>
        </div>

        <h3 className="text-base font-bold text-slate-900 group-hover:text-brand-600 transition-colors leading-snug mb-2">
          {task.title}
        </h3>

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

      {/* Card Footer: Merchant-Set Reward & Daily Drop Action CTA */}
      <div className="pt-4 flex items-center justify-between gap-2">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
            Merchant Reward
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            {formatCurrencyFromUsd(task.reward, selectedCountry)}
          </div>
        </div>

        <div className="flex items-center gap-2">
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
                {eligibility.reasonCode === 'BEFORE_8AM_DROP'
                  ? `Drops 8:00 AM (${dailyDropInfo.countdownLabel})`
                  : eligibility.reasonCode === 'DAILY_LIMIT_REACHED'
                  ? `Daily Limit (${dailyQuotaStatus.usedToday}/${dailyQuotaStatus.rule.dailyLimit})`
                  : 'Next 8:00 AM Drop'}
              </span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onSelect(task)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shadow-xs group/btn cursor-pointer"
            >
              <span>Open Task</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
