import React from 'react';
import { useTasks } from '../context/TaskContext';
import { CheckCircle2, X } from 'lucide-react';

export const NotificationToast: React.FC = () => {
  const { notification, clearNotification } = useTasks();

  if (!notification) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 max-w-md w-full px-4">
      <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-slate-700 flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          <p className="text-xs font-medium text-slate-100 leading-relaxed">
            {notification}
          </p>
        </div>
        <button
          onClick={clearNotification}
          className="text-slate-400 hover:text-white transition-colors p-0.5"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
