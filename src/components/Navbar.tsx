import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { Wallet, Globe, Sparkles, Flame, LogIn, LogOut, User as UserIcon, ShieldCheck, Smartphone, Zap, DollarSign } from 'lucide-react';
import { ThemeColorPicker } from './ThemeColorPicker';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, userStats, setWalletOpen, setStreakModalOpen, setPublisherModalOpen, setDarajaModalOpen, setIntasendModalOpen, setPaypalModalOpen } = useTasks();
  const { user, isOwner, signInWithGoogle, signOutUser } = useAuth();

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-8 px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('tasks');
          }}
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <img
            src="/images/gideon-logo.svg"
            alt="Gideon Global Tasks official verified emblem and platform logo"
            className="w-8 h-8 rounded-lg shadow-2xs"
            width="32"
            height="32"
          />
          <span>Gideon Global Tasks</span>
        </a>

        {/* Zone 2: Semantic anchor navigation links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs xl:text-sm font-medium text-slate-600">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('tasks');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'tasks' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Tasks
          </a>
          <a
            href="/guides"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('guides');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'guides' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Guides
          </a>
          <a
            href="/faq"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('faq');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'faq' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            FAQ
          </a>
          <a
            href="/task-history"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('task-history');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'task-history' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Ledger
          </a>
          <a
            href="/referrals"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('referrals');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'referrals' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Referrals (20%)
          </a>
          <a
            href="/packages"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('packages');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'packages' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Worker Passes
          </a>
          <a
            href="/about"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('about');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'about' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            About
          </a>
          <a
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('contact');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'contact' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Contact
          </a>
          <a
            href="/privacy"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('privacy');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'privacy' ? 'text-brand-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Privacy
          </a>
        </nav>

        {/* Zone 3: Actions & Social Signals */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Social Trust Links */}
          <div className="hidden xl:flex items-center gap-2 text-slate-400 border-r border-slate-200 pr-2">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Gideon Global on X / Twitter"
              className="p-1 hover:text-slate-700 transition-colors"
              title="X / Twitter"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View Open Source Tools on GitHub"
              className="p-1 hover:text-slate-700 transition-colors"
              title="GitHub"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
              </svg>
            </a>
          </div>
          {/* Owner-Only Website Management & Payment Gateway Controls */}
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setPublisherModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                title="Owner Only: Manage Google AdSense & Search Console"
              >
                <Globe className="w-3.5 h-3.5 text-brand-600" />
                <span className="hidden xl:inline">AdSense & SEO</span>
              </button>

              <button
                type="button"
                onClick={() => setDarajaModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
                title="Owner Only: Configure Safaricom Daraja M-PESA API"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span className="hidden md:inline">Daraja</span>
              </button>

              <button
                type="button"
                onClick={() => setIntasendModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Owner Only: IntaSend Payment Gateway"
              >
                <Zap className="w-3.5 h-3.5 text-indigo-600" />
                <span className="hidden md:inline">IntaSend</span>
              </button>

              <button
                type="button"
                onClick={() => setPaypalModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-[#003087] bg-blue-50 hover:bg-blue-100 border border-blue-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Owner Only: PayPal International Gateway (nigideon36@gmail.com)"
              >
                <DollarSign className="w-3.5 h-3.5 text-[#003087]" />
                <span className="hidden md:inline">PayPal</span>
              </button>

              <ThemeColorPicker />
            </>
          )}

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
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors whitespace-nowrap shadow-sm cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-emerald-400" />
            <span className="tabular-nums font-mono">${userStats.balance.toFixed(2)}</span>
            <span className="text-slate-400">·</span>
            <span>Withdraw</span>
          </button>

          {/* Owner Portal & Admin Controls — Strictly restricted to nigideon36@gmail.com */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('employer')}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              title="Owner Portal: Full Site & Campaign Authority"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="hidden sm:inline">Owner Portal</span>
            </button>
          )}

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
                <div className="hidden xl:flex flex-col">
                  <span className="text-xs font-medium text-slate-700 max-w-[100px] truncate leading-tight">
                    {user.displayName || user.email?.split('@')[0]}
                  </span>
                  {isOwner ? (
                    <span className="text-[10px] font-bold text-emerald-700 font-mono">Owner</span>
                  ) : (
                    <span className="text-[10px] font-medium text-slate-500 font-mono">Customer</span>
                  )}
                </div>
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
              <LogIn className="w-3.5 h-3.5 text-brand-600" />
              <span>Register / Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
