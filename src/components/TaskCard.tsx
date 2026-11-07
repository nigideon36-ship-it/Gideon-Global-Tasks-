import React from 'react';
import { Task } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { ArrowRight, Clock, Star, CheckCircle, Check } from 'lucide-react';

interface Props {
  task: Task;
  onSelect: (task: Task) => void;
}

export const TaskCard: React.FC<Props> = ({ task, onSelect }) => {
  const { userStats } = useTasks();
  const isCompleted = userStats.completedTaskIds.includes(task.id);

  const categoryNameMap: Record<string, string> = {
    survey: 'Survey',
    annotation: 'AI Annotation',
    'data-entry': 'Data Entry',
    writing: 'Writing',
    'meme-content': 'Meme & Content',
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
        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-4">
          {task.description}
        </p>

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
      <div className="pt-4 flex items-center justify-between">
        <div>
          <span className="text-[10px] text-slate-400 block uppercase font-bold tracking-wider">
            Earn Bounty
          </span>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900">
            ${task.reward.toFixed(2)}
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
        ) : (
          <button
            type="button"
            onClick={() => onSelect(task)}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shadow-xs group/btn"
          >
            <span>Start Task</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/btn:translate-x-0.5 transition-transform" />
          </button>
        )}
      </div>
    </div>
  );
};
