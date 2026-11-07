import React, { useState } from 'react';
import { Task } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { X, Zap, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

export const MicroTaskWorkspaceModal: React.FC<Props> = ({ task, onClose }) => {
  const { completeTask } = useTasks();
  const config = task.microConfig;

  const [selectedOption, setSelectedOption] = useState<string>('');
  const [reason, setReason] = useState<string>('Option A has noticeably higher contrast against dark backgrounds.');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!selectedOption) {
      setErrorMsg('Please select one of the options.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      completeTask(task.id, task.reward, task.title);
      setIsSubmitting(false);
      onClose();
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Micro Task</span>
                <span aria-hidden="true">·</span>
                <span>{task.estimatedMinutes} min job</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-600 font-semibold">${task.reward.toFixed(2)} Instant</span>
              </div>
              <h2 className="text-base font-semibold text-slate-900 leading-tight">
                {task.title}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 md:p-8 space-y-6">
          <div className="p-4 bg-slate-900 rounded-xl text-white">
            <div className="text-[11px] uppercase tracking-wider text-slate-400 font-bold mb-3">
              Side-by-Side Mobile Interface Simulation
            </div>
            <div className="grid grid-cols-2 gap-4 py-3">
              {/* Option A preview */}
              <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-xs text-slate-400">Variant A</span>
                <button
                  type="button"
                  className="px-4 py-2 bg-emerald-500 text-slate-950 font-bold text-xs rounded-lg shadow-sm"
                >
                  Send Transfer Now
                </button>
              </div>
              {/* Option B preview */}
              <div className="p-4 rounded-lg bg-slate-800 border border-slate-700 flex flex-col items-center justify-center gap-2 text-center">
                <span className="text-xs text-slate-400">Variant B</span>
                <button
                  type="button"
                  className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-lg shadow-sm"
                >
                  Send Transfer Now
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              {config?.title || 'Which option provides better legibility?'}
            </label>
            <div className="space-y-2.5">
              {(config?.options || ['Option A', 'Option B']).map((opt, idx) => {
                const isSelected = selectedOption === opt;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setSelectedOption(opt);
                      setErrorMsg(null);
                    }}
                    className={`w-full p-3.5 rounded-xl border text-xs font-medium text-left flex items-center justify-between transition-all ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-50/50 text-indigo-950 font-semibold shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    <span>{opt}</span>
                    <div
                      className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                        isSelected ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Brief Rationale:
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why did you pick this option?"
              className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 text-slate-800 outline-hidden focus:border-indigo-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Instant credit to your balance upon submit
          </span>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            <span>{isSubmitting ? 'Recording Vote...' : `Submit & Earn ($${task.reward.toFixed(2)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
