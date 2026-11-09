import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { Wallet, Globe, Sparkles, Flame, LogIn, LogOut, User as UserIcon } from 'lucide-react';
import { ThemeColorPicker } from './ThemeColorPicker';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, userStats, setWalletOpen, setStreakModalOpen, setPublisherModalOpen } = useTasks();
  const { user, signInWithGoogle, signOutUser } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setActiveTab('tasks')}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <div className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center font-bold text-sm shadow-sm transition-colors">
            G
          </div>
          <span>Gideon Global Tasks</span>
        </button>

        {/* Zone 2: 5 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <button
            onClick={() => setActiveTab('tasks')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'tasks' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Tasks
          </button>
          <button
            onClick={() => setActiveTab('task-history')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'task-history' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Task History
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'referrals' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Referrals (20%)
          </button>
          <button
            onClick={() => setActiveTab('packages')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'packages' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Worker Passes ($2–$10)
          </button>
          <button
            onClick={() => setActiveTab('meme-studio')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'meme-studio' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Meme Studio
          </button>
          <button
            onClick={() => setActiveTab('ai-media')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'ai-media' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            AI Media & 3D
          </button>
        </nav>

        {/* Zone 3: Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setPublisherModalOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            title="Publish to Google Search Console & AdSense"
          >
            <Globe className="w-3.5 h-3.5 text-brand-600" />
            <span className="hidden xl:inline">Publish to Google</span>
          </button>

          <ThemeColorPicker />

          <button
            type="button"
            onClick={() => setStreakModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
            title="Daily Contributor Streak"
          >
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            <span className="font-mono">{userStats.streakDays}d</span>
            <span className="text-[10px] text-amber-600 font-semibold">{userStats.streakDays >= 7 ? '+20%' : '+10%'}</span>
          </button>

          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tabular-nums font-mono">${userStats.balance.toFixed(2)}</span>
            <span className="text-slate-400">·</span>
            <span>Withdraw</span>
          </button>

          {/* User Sign In / Profile */}
          {user ? (
            <div className="flex items-center gap-2 pl-1 border-l border-slate-200">
              <div className="flex items-center gap-1.5">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-7 h-7 rounded-full object-cover border border-slate-300"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center border border-slate-300">
                    {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                  </div>
                )}
                <span className="hidden xl:inline text-xs font-medium text-slate-700 max-w-[100px] truncate">
                  {user.displayName || user.email?.split('@')[0]}
                </span>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                title="Sign Out"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={signInWithGoogle}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-slate-500" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
