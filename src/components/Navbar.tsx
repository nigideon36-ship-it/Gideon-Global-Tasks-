import React from 'react';
import { useTasks } from '../context/TaskContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { Wallet, Globe, Flame, LogIn, LogOut, ShieldCheck, Smartphone, Zap, MapPin, Lock } from 'lucide-react';
import { ThemeColorPicker } from './ThemeColorPicker';

export const Navbar: React.FC = () => {
  const { activeTab, setActiveTab, userStats, setWalletOpen, setStreakModalOpen, setPublisherModalOpen, setDarajaModalOpen, setIntasendModalOpen, setPaystackModalOpen } = useTasks();
  const {
    user,
    customerProfile,
    isOwner,
    isAuthenticated,
    setAuthModalOpen,
    setSecurityModalOpen,
    signOutUser
  } = useAuth();
  const { selectedCountry, setSelectorOpen } = useRegion();

  const displayIdentity =
    user?.displayName ||
    customerProfile?.displayName ||
    customerProfile?.phone ||
    user?.email?.split('@')[0] ||
    'Member';

  const twoFactorActive = Boolean(customerProfile?.twoFactorEnabled);

  return (
    <header className="sticky top-0 z-40 bg-blue-900/95 backdrop-blur-md border-b border-blue-500/40 text-white shadow-sm">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4 lg:gap-6 px-3 md:px-6 py-3">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('tasks');
          }}
          className="flex items-center gap-2 text-sm sm:text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
        >
          <img
            src="/images/gideon-logo.svg"
            alt="Gideon Global Tasks official verified emblem and platform logo"
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg shadow-2xs shrink-0"
            width="32"
            height="32"
          />
          <span className="truncate max-w-[125px] sm:max-w-none">Gideon Global Tasks</span>
        </a>

        {/* Zone 2: Semantic anchor navigation links */}
        <nav className="hidden lg:flex items-center gap-5 text-xs xl:text-sm font-medium text-blue-100">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('tasks');
            }}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              activeTab === 'tasks' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'guides' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'faq' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'task-history' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'referrals' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'packages' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'about' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'contact' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
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
              activeTab === 'privacy' ? 'text-white font-semibold underline decoration-sky-300 underline-offset-4' : 'hover:text-white'
            }`}
          >
            Privacy
          </a>
        </nav>

        {/* Zone 3: Actions & Social Signals */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Social Trust Links */}
          <div className="hidden xl:flex items-center gap-2 text-blue-200 border-r border-blue-700 pr-2">
            <a
              href="https://x.com"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Follow Gideon Global on X / Twitter"
              className="p-1 hover:text-white transition-colors"
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
              className="p-1 hover:text-white transition-colors"
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
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-slate-700 bg-white/95 hover:bg-white border border-blue-200 rounded-lg transition-colors cursor-pointer"
                title="Owner Only: Manage Google AdSense & Search Console"
              >
                <Globe className="w-3.5 h-3.5 text-blue-600" />
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
                onClick={() => setPaystackModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-[#0576A0] bg-sky-50 hover:bg-sky-100 border border-sky-300 rounded-lg transition-colors cursor-pointer shadow-2xs"
                title="Owner Only: Paystack M-PESA STK Push & Card Gateway (No Paybill/Till)"
              >
                <Zap className="w-3.5 h-3.5 text-[#09A5DB]" />
                <span className="hidden md:inline">Paystack</span>
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

              <ThemeColorPicker />
            </>
          )}

          <button
            type="button"
            onClick={() => setSelectorOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-xs font-semibold text-white bg-blue-800 hover:bg-blue-700 border border-blue-400/50 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            title="East Africa Access Region (KE, UG, TZ, RW, BI, SS, ET, SO)"
          >
            <MapPin className="w-3.5 h-3.5 text-sky-300" />
            <span className="font-mono">{selectedCountry.code}</span>
            <span className="hidden xl:inline text-[11px] text-blue-100">· East Africa</span>
          </button>

          <button
            type="button"
            onClick={() => setStreakModalOpen(true)}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-amber-200 bg-blue-800 hover:bg-blue-700 border border-amber-400/40 rounded-lg transition-colors cursor-pointer"
            title="Daily Contributor Streak"
          >
            <Flame className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="font-mono">{userStats.streakDays}d</span>
            <span className="text-[10px] text-amber-300 font-semibold">{userStats.streakDays >= 7 ? '+20%' : '+10%'}</span>
          </button>

          <button
            onClick={() => setWalletOpen(true)}
            className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-blue-950 bg-white hover:bg-blue-50 rounded-lg transition-colors whitespace-nowrap shadow-sm cursor-pointer"
          >
            <Wallet className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="tabular-nums font-mono font-bold">${userStats.balance.toFixed(2)}</span>
            <span className="hidden sm:inline text-blue-400">·</span>
            <span className="hidden sm:inline">Withdraw</span>
          </button>

          {/* Owner Portal & Admin Controls — Strictly restricted to nigideon36@gmail.com */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setActiveTab('employer')}
              className="flex items-center gap-1.5 px-2.5 py-2 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg transition-colors cursor-pointer"
              title="Owner Portal: Full Site & Campaign Authority"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
              <span className="hidden sm:inline">Owner Portal</span>
            </button>
          )}

          {/* User Sign In / Mobile Profile + 2FA Controls */}
          {isAuthenticated ? (
            <div className="flex items-center gap-2 pl-2 border-l border-blue-700">
              <button
                type="button"
                onClick={() => setSecurityModalOpen(true)}
                title="Manage Two-Factor Authentication (SMS or Authenticator App)"
                className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold rounded-lg border transition-colors cursor-pointer whitespace-nowrap ${
                  twoFactorActive
                    ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50 hover:bg-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-200 border-amber-400/50 hover:bg-amber-500/30'
                }`}
              >
                <Lock className="w-3 h-3" />
                <span>{twoFactorActive ? '2FA On' : 'Enable 2FA'}</span>
              </button>

              <div className="flex items-center gap-1.5">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={displayIdentity}
                    className="w-7 h-7 rounded-full object-cover border border-blue-300"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-blue-700 text-white font-bold text-xs flex items-center justify-center border border-blue-400">
                    {displayIdentity.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="hidden xl:flex flex-col">
                  <span className="text-xs font-medium text-white max-w-[110px] truncate leading-tight">
                    {displayIdentity}
                  </span>
                  {isOwner ? (
                    <span className="text-[10px] font-bold text-emerald-300 font-mono">Owner</span>
                  ) : (
                    <span className="text-[10px] font-medium text-blue-200 font-mono">
                      {customerProfile?.phone || 'Customer'}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={signOutUser}
                title="Sign Out"
                className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-800 rounded-lg transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-bold text-blue-950 bg-white hover:bg-blue-50 border border-blue-200 rounded-lg shadow-sm transition-colors whitespace-nowrap cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span>Register / Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
