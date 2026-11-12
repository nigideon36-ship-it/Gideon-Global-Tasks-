import React, { useState } from 'react';
import { useTasks } from '../context/TaskContext';
import { TaskCategory, TaskDifficulty, Task } from '../types/tasks';
import { PlusCircle, Users, CheckCircle2, DollarSign, Layers, Sparkles, AlertCircle, Smartphone, Zap } from 'lucide-react';

export const EmployerPortal: React.FC = () => {
  const { tasks, postTask, setActiveTab, setDarajaModalOpen, setIntasendModalOpen } = useTasks();

  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('survey');
  const [description, setDescription] = useState('');
  const [reward, setReward] = useState<string>('2.50');
  const [estimatedMinutes, setEstimatedMinutes] = useState<string>('4');
  const [difficulty, setDifficulty] = useState<TaskDifficulty>('Beginner');
  const [totalSpots, setTotalSpots] = useState<string>('50');
  const [instructionsText, setInstructionsText] = useState(
    '1. Review the provided materials carefully.\n2. Ensure answers are objective and accurate.\n3. Submit for instant automated verification.'
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const numReward = parseFloat(reward) || 0;
  const numSpots = parseInt(totalSpots) || 0;
  const totalCampaignBudget = (numReward * numSpots).toFixed(2);

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!title.trim()) {
      setErrorMsg('Please specify a descriptive task title.');
      return;
    }

    if (!description.trim()) {
      setErrorMsg('Please provide a brief summary of what the task involves.');
      return;
    }

    if (numReward < 0.25) {
      setErrorMsg('Minimum reward per task is $0.25.');
      return;
    }

    if (numSpots < 5) {
      setErrorMsg('Minimum worker quota is 5 spots.');
      return;
    }

    const instructions = instructionsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const created = {
      title: title.trim(),
      category,
      description: description.trim(),
      reward: numReward,
      estimatedMinutes: parseInt(estimatedMinutes) || 3,
      difficulty,
      totalSpots: numSpots,
      requesterName: 'You (Gideon Requester)',
      requesterRating: 5.0,
      requesterVerified: true,
      tags: [category.toUpperCase(), 'Verified Bounty'],
      instructions
    };

    postTask(created);
    setSuccessMsg(`Task "${title}" created and posted to the marketplace!`);
    setTitle('');
    setDescription('');
    setIsCreating(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-10">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 mb-1">
            <Users className="w-3.5 h-3.5" />
            <span>Employer & Requester Console</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            Crowdsource at Global Scale
          </h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Deploy paid surveys, human-in-the-loop AI data annotation, data entry, copywriting, and micro tasks to thousands of vetted workers across 140+ countries.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setIntasendModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Configure IntaSend M-PESA & Card Payment Gateway"
          >
            <Zap className="w-4 h-4 text-indigo-600" />
            <span>IntaSend Gateway</span>
          </button>

          <button
            type="button"
            onClick={() => setDarajaModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Configure Safaricom Daraja M-PESA API credentials"
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>M-PESA Daraja Settings</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreating(!isCreating)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{isCreating ? 'Close Creation Form' : 'Post a New Task'}</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button
            onClick={() => setActiveTab('tasks')}
            className="text-emerald-900 font-bold hover:underline"
          >
            View in Marketplace →
          </button>
        </div>
      )}

      {/* Creation Form Modal/Section */}
      {isCreating && (
        <div className="bg-white p-6 md:p-8 rounded-2xl border border-slate-200 shadow-xl space-y-6 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Configure New Crowdsourced Task
              </h2>
              <p className="text-xs text-slate-500">
                Define the requirements and budget for global contributors.
              </p>
            </div>
            <div className="text-xs font-mono font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
              Total Campaign Budget: ${totalCampaignBudget}
            </div>
          </div>

          <form onSubmit={handleCreateTask} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Title:
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Categorize 20 E-Commerce Customer Inquiries"
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-hidden font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Task Category:
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TaskCategory)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-hidden font-medium bg-white"
                >
                  <option value="survey">I Survey (Market Research)</option>
                  <option value="annotation">Data Annotation (AI Training)</option>
                  <option value="data-entry">Data Entry & Extraction</option>
                  <option value="writing">Writing & Copywriting</option>
                  <option value="meme-content">Meme & Content Creation</option>
                  <option value="micro">Fast Micro Tasks (30s)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Short Description:
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the goal and what the worker will produce..."
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-hidden"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Reward / Submission ($)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.25"
                  value={reward}
                  onChange={(e) => setReward(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono font-semibold focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Estimated Minutes
                </label>
                <input
                  type="number"
                  min="1"
                  max="60"
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Target Worker Quota
                </label>
                <input
                  type="number"
                  min="5"
                  max="1000"
                  value={totalSpots}
                  onChange={(e) => setTotalSpots(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:border-indigo-500 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as TaskDifficulty)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 focus:border-indigo-500 outline-hidden bg-white"
                >
                  <option value="Beginner">Beginner (Anyone)</option>
                  <option value="Intermediate">Intermediate (Verified)</option>
                  <option value="Expert">Expert (Gold/Diamond Tier)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Step-by-Step Instructions (One per line):
              </label>
              <textarea
                rows={3}
                value={instructionsText}
                onChange={(e) => setInstructionsText(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-lg border border-slate-300 font-mono focus:border-indigo-500 outline-hidden"
              />
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs"
              >
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Deploy Campaign to Global Network</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Requester Metrics & Active Campaigns */}
      <div className="space-y-6">
        <h2 className="text-base font-bold text-slate-900">
          Your Active Campaigns & Network Status
        </h2>

        <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-5 font-semibold">Campaign Title</th>
                <th className="py-3 px-5 font-semibold">Category</th>
                <th className="py-3 px-5 font-semibold text-right">Bounty</th>
                <th className="py-3 px-5 font-semibold text-right">Remaining / Total</th>
                <th className="py-3 px-5 font-semibold text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {tasks.slice(0, 6).map((task) => (
                <tr key={task.id} className="hover:bg-slate-50/60">
                  <td className="py-3 px-5 font-medium text-slate-900">
                    <div>{task.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{task.requesterName}</div>
                  </td>
                  <td className="py-3 px-5">
                    <span className="capitalize text-slate-600 font-medium">{task.category.replace('-', ' ')}</span>
                  </td>
                  <td className="py-3 px-5 text-right font-mono font-bold text-slate-900 tabular-nums">
                    ${task.reward.toFixed(2)}
                  </td>
                  <td className="py-3 px-5 text-right font-mono text-slate-600 tabular-nums">
                    {task.spotsRemaining} / {task.totalSpots}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <span className="font-semibold text-emerald-600">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
