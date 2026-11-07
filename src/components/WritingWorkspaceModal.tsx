import React, { useState } from 'react';
import { Task } from '../types/tasks';
import { useTasks } from '../context/TaskContext';
import { X, PenTool, CheckCircle2, AlertCircle, Sparkles, BookOpen, Clock } from 'lucide-react';

interface Props {
  task: Task;
  onClose: () => void;
}

export const WritingWorkspaceModal: React.FC<Props> = ({ task, onClose }) => {
  const { completeTask } = useTasks();
  const config = task.writingConfig;

  const [content, setContent] = useState<string>(
    'Upgrade your desktop workflow with the HyperCharge 140W GaN Hub. Engineered with cutting-edge Gallium Nitride semiconductors, this ultra-compact powerhouse delivers universal fast charging across your laptop, tablet, and smartphone at full velocity without breaking a sweat.\n\nUnlike bulky legacy adapters, its advanced architecture ensures superior heat dissipation and cool-touch thermal efficiency during peak multi-device workloads. Backed by intelligent power distribution and durable aerospace-grade shielding, it fits cleanly in your travel pouch while replacing four individual wall chargers.'
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const words = content.trim().split(/\s+/).filter(Boolean);
  const wordCount = content.trim() ? words.length : 0;
  const minWords = config?.targetWordCount.min || 80;
  const maxWords = config?.targetWordCount.max || 150;

  const isWordCountValid = wordCount >= minWords && wordCount <= maxWords;

  // Keyword detection
  const detectedKeywords = (config?.mandatoryKeywords || []).map((keyword) => {
    const regex = new RegExp(keyword, 'i');
    return {
      keyword,
      present: regex.test(content)
    };
  });

  const allKeywordsPresent = detectedKeywords.every((k) => k.present);

  const handleInsertDraftStarter = () => {
    setContent(
      'Engineered with state-of-the-art Gallium Nitride technology, the HyperCharge hub provides universal fast charging for your entire creative rig. Its aerospace casing guarantees continuous heat dissipation, delivering pure performance in a pocket-sized form factor.'
    );
  };

  const handleSubmit = () => {
    if (!isWordCountValid) {
      setErrorMsg(`Word count must be between ${minWords} and ${maxWords} words (current: ${wordCount} words).`);
      return;
    }

    if (!allKeywordsPresent) {
      setErrorMsg('Please include all mandatory keywords in your copy before submitting.');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      completeTask(task.id, task.reward, task.title);
      setIsSubmitting(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94vh]">
        {/* Header */}
        <div className="px-6 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
              <PenTool className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <span>Copywriting & Writing</span>
                <span aria-hidden="true">·</span>
                <span>{task.requesterName}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono text-emerald-600 font-semibold">${task.reward.toFixed(2)} Bounty</span>
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

        {/* Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
          {/* Writing canvas */}
          <div className="flex-1 p-6 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="mb-4 p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div className="font-semibold text-slate-800 mb-1 flex items-center gap-2">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Brief & Instructions:</span>
                </div>
                <p className="text-slate-600 leading-relaxed mb-2">
                  {config?.prompt}
                </p>
                <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                  <span>Tone: <strong className="text-slate-700">{config?.tone}</strong></span>
                  <span aria-hidden="true">·</span>
                  <span>Target: <strong className="text-slate-700">{minWords}–{maxWords} words</strong></span>
                </div>
              </div>

              <div className="relative">
                <textarea
                  rows={9}
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setErrorMsg(null);
                  }}
                  placeholder="Draft your compelling product copy here..."
                  className="w-full p-4 rounded-xl border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 text-slate-800 text-sm leading-relaxed outline-hidden resize-none font-sans"
                />
              </div>

              {/* Real-time word counter meter */}
              <div className="mt-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Word Count:</span>
                  <span
                    className={`font-mono font-bold tabular-nums px-2 py-0.5 rounded-md ${
                      isWordCountValid
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}
                  >
                    {wordCount} / {minWords}–{maxWords} words
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleInsertDraftStarter}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Load Sample Copy
                </button>
              </div>

              {errorMsg && (
                <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Plagiarism & grammar verification active
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="py-2.5 px-5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{isSubmitting ? 'Evaluating Copy...' : `Submit Draft ($${task.reward.toFixed(2)})`}</span>
              </button>
            </div>
          </div>

          {/* Right Checklist Sidebar */}
          <div className="w-full md:w-72 bg-slate-50 border-t md:border-t-0 md:border-l border-slate-200 p-5 flex flex-col justify-between overflow-y-auto">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Mandatory Keywords
              </div>
              <div className="space-y-2 mb-6">
                {detectedKeywords.map((item, idx) => (
                  <div
                    key={idx}
                    className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                      item.present
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-800'
                        : 'bg-white border-slate-200 text-slate-500'
                    }`}
                  >
                    <span className="font-medium font-mono text-[11px]">{item.keyword}</span>
                    <CheckCircle2
                      className={`w-4 h-4 shrink-0 ${
                        item.present ? 'text-emerald-600' : 'text-slate-300'
                      }`}
                    />
                  </div>
                ))}
              </div>

              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
                Grading Rubric
              </div>
              <ul className="space-y-2 text-xs text-slate-600">
                {(config?.rubric || []).map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-500">
              <div className="font-semibold text-slate-700 mb-1">Human Copy Review</div>
              <p className="text-[11px] leading-relaxed">
                Accepted copy is automatically indexed for requester marketing campaigns.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
