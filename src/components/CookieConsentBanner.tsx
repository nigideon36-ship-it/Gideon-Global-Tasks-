import React, { useState, useEffect } from 'react';
import { ShieldCheck, Cookie, X, Check, ExternalLink } from 'lucide-react';
import { useTasks } from '../context/TaskContext';

export const CookieConsentBanner: React.FC = () => {
  const { setActiveTab } = useTasks();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem('gideon_cookie_consent');
      if (consent) {
        const staticBanner = document.getElementById('cookie-consent-banner');
        if (staticBanner) staticBanner.style.display = 'none';
        setIsVisible(false);
        return;
      }
      setIsVisible(true);
    } catch {
      setIsVisible(true);
    }

    // Attach listeners to static HTML fallback if present
    const btnAll = document.getElementById('cookie-accept-all');
    const btnEss = document.getElementById('cookie-essential-only');
    const onAcceptAll = () => handleAcceptAll();
    const onAcceptEss = () => handleAcceptEssential();

    btnAll?.addEventListener('click', onAcceptAll);
    btnEss?.addEventListener('click', onAcceptEss);

    return () => {
      btnAll?.removeEventListener('click', onAcceptAll);
      btnEss?.removeEventListener('click', onAcceptEss);
    };
  }, []);

  const hideBanner = () => {
    const staticBanner = document.getElementById('cookie-consent-banner');
    if (staticBanner) staticBanner.style.display = 'none';
    setIsVisible(false);
  };

  const handleAcceptAll = () => {
    try {
      localStorage.setItem('gideon_cookie_consent', JSON.stringify({
        essential: true,
        analytics: true,
        advertising: true,
        timestamp: new Date().toISOString()
      }));
    } catch {}
    hideBanner();
  };

  const handleAcceptEssential = () => {
    try {
      localStorage.setItem('gideon_cookie_consent', JSON.stringify({
        essential: true,
        analytics: false,
        advertising: false,
        timestamp: new Date().toISOString()
      }));
    } catch {}
    hideBanner();
  };

  if (!isVisible) return null;

  return (
    <aside
      aria-label="Cookie consent banner"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-xl z-50 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200/90 p-5 animate-in slide-in-from-bottom-5 duration-300"
    >
      <div className="flex items-start gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 mt-0.5 border border-amber-200/60">
          <Cookie className="w-5 h-5" />
        </div>
        <div className="space-y-2 flex-1 text-xs text-slate-600 leading-relaxed">
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
              <span>Cookie & AdSense Privacy Notice</span>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                GDPR & ePrivacy Compliant
              </span>
            </h3>
            <button
              onClick={handleAcceptEssential}
              className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              title="Dismiss and accept essential only"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <p>
            Gideon Global Tasks uses cookies and similar technologies to verify contributor logins, maintain account security, measure platform engagement, and serve personalized Google AdSense advertising.
          </p>
          <p className="text-[11px] text-slate-500">
            You can read our full{' '}
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('privacy');
              }}
              className="text-brand-600 hover:text-brand-700 font-medium underline"
            >
              Privacy & Cookie Policy
            </a>{' '}
            or opt out of third-party ad personalization at any time via{' '}
            <a
              href="https://adssettings.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-600 hover:text-brand-700 font-medium underline inline-flex items-center gap-0.5"
            >
              Google Ads Settings
              <ExternalLink className="w-2.5 h-2.5" />
            </a>.
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleAcceptAll}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-xs transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accept All Cookies</span>
            </button>
            <button
              type="button"
              onClick={handleAcceptEssential}
              className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg text-xs transition-colors cursor-pointer border border-slate-200"
            >
              Essential Only
            </button>
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                setActiveTab('privacy');
              }}
              className="px-3 py-2 text-slate-600 hover:text-slate-900 font-medium text-xs transition-colors"
            >
              Preferences
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
};
