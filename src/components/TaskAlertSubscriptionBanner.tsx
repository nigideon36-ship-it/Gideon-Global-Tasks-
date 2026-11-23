import React, { useState, useEffect, useCallback } from 'react';
import { Bell, Mail, CheckCircle2, AlertCircle, Trash2, Sparkles, ChevronDown, ChevronUp, Inbox } from 'lucide-react';
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { auth, db } from '../lib/firebase';
import { formatCurrencyFromKes } from '../lib/eastAfrica';

interface SubscriptionItem {
  id: string;
  userUid: string;
  email: string;
  categories: string[];
  minRewardKes: number;
  frequency: 'instant' | 'daily_digest';
  active: boolean;
  matchCount: number;
  lastNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface DispatchItem {
  id: string;
  taskId: string;
  taskTitle: string;
  taskCategory: string;
  taskRewardKes: number;
  deliveryChannel: 'SMTP Email' | 'In-App Alert Feed';
  deliveryStatus: 'Sent' | 'Queued' | 'Failed';
  deliveryNote: string;
  createdAt: string;
}

const INTEREST_OPTIONS = [
  { id: 'all', label: 'All High-Reward Tasks' },
  { id: 'creator-campaign', label: 'Creator Product Campaigns' },
  { id: 'survey', label: 'Paid Consumer Surveys' },
  { id: 'annotation', label: 'AI Image Annotation' },
  { id: 'data-entry', label: 'Receipt & Data Verification' },
  { id: 'writing', label: 'Content & Localization' },
  { id: 'meme-content', label: 'Community Meme Bounties' },
  { id: 'micro', label: 'Quick Micro-Tasks' },
];

const REWARD_THRESHOLDS_KES = [30, 40, 45, 50];

export const TaskAlertSubscriptionBanner: React.FC = () => {
  const { user, customerProfile, isAuthenticated, activeToken, getFreshToken, setAuthModalOpen } = useAuth();
  const { selectedCountry } = useRegion();

  const [expanded, setExpanded] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionItem | null>(null);
  const [dispatches, setDispatches] = useState<DispatchItem[]>([]);
  const [smtpConfigured, setSmtpConfigured] = useState(false);

  const [email, setEmail] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>(['all']);
  const [minRewardKes, setMinRewardKes] = useState<number>(40);
  const [frequency, setFrequency] = useState<'instant' | 'daily_digest'>('instant');
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const defaultEmail = customerProfile?.email || user?.email || '';
    if (defaultEmail && !email) {
      setEmail(defaultEmail);
    }
  }, [customerProfile?.email, user?.email, email]);

  const loadMySubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(null);
      setDispatches([]);
      return;
    }

    try {
      const token = (await getFreshToken()) || activeToken;
      if (!token) return;

      const res = await fetch('/api/task-alerts/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();

      if (res.ok && data?.success) {
        if (data.subscription) {
          setSubscription(data.subscription);
          setEmail(data.subscription.email);
          setSelectedCategories(data.subscription.categories || ['all']);
          setMinRewardKes(data.subscription.minRewardKes || 40);
          setFrequency(data.subscription.frequency || 'instant');
        } else if (auth.currentUser?.emailVerified) {
          // Restore from Firestore if server restarted
          try {
            const snap = await getDoc(doc(db, 'task_alert_subscriptions', auth.currentUser.uid));
            if (snap.exists()) {
              const fsSub = snap.data() as SubscriptionItem;
              setSubscription(fsSub);
              setEmail(fsSub.email);
              setSelectedCategories(fsSub.categories || ['all']);
              setMinRewardKes(fsSub.minRewardKes || 40);
              setFrequency(fsSub.frequency || 'instant');
              await fetch('/api/task-alerts/hydrate', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ subscription: fsSub }),
              });
            }
          } catch {
            // non-blocking
          }
        }
        setDispatches(Array.isArray(data.dispatches) ? data.dispatches : []);
        setSmtpConfigured(Boolean(data.smtpConfigured));
      }
    } catch {
      // non-blocking
    }
  }, [isAuthenticated, activeToken, getFreshToken]);

  useEffect(() => {
    void loadMySubscription();
  }, [loadMySubscription]);

  const toggleCategory = (catId: string) => {
    if (catId === 'all') {
      setSelectedCategories(['all']);
      return;
    }
    setSelectedCategories((prev) => {
      const withoutAll = prev.filter((c) => c !== 'all');
      if (withoutAll.includes(catId)) {
        const next = withoutAll.filter((c) => c !== catId);
        return next.length === 0 ? ['all'] : next;
      }
      return [...withoutAll, catId];
    });
  };

  const handleSaveSubscription = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!isAuthenticated) {
      setAuthModalOpen(true);
      return;
    }

    setSaving(true);
    try {
      const token = (await getFreshToken()) || activeToken;
      const res = await fetch('/api/task-alerts/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: email.trim(),
          categories: selectedCategories,
          minRewardKes,
          frequency,
          active: true,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setFeedback({ type: 'error', text: data?.error || 'Could not save alert subscription.' });
        setSaving(false);
        return;
      }

      const savedSub: SubscriptionItem = data.subscription;
      setSubscription(savedSub);
      setDispatches(Array.isArray(data.dispatches) ? data.dispatches : []);

      // Persist securely to Firestore when Firebase user session is active
      if (auth.currentUser?.emailVerified && savedSub) {
        try {
          await setDoc(doc(db, 'task_alert_subscriptions', auth.currentUser.uid), {
            id: auth.currentUser.uid,
            userUid: auth.currentUser.uid,
            email: savedSub.email,
            categories: savedSub.categories,
            minRewardKes: savedSub.minRewardKes,
            frequency: savedSub.frequency,
            active: savedSub.active,
            matchCount: savedSub.matchCount || 0,
            createdAt: savedSub.createdAt,
            updatedAt: savedSub.updatedAt,
          });
        } catch {
          // non-blocking
        }
      }

      setFeedback({
        type: 'success',
        text: `Alert subscription active for ${savedSub.email} (tasks >= ${formatCurrencyFromKes(
          savedSub.minRewardKes,
          selectedCountry
        )}).`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', text: err?.message || 'Error saving alert preferences.' });
    } finally {
      setSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!subscription) return;
    setRemoving(true);
    setFeedback(null);
    try {
      const token = (await getFreshToken()) || activeToken;
      const res = await fetch(`/api/task-alerts/${encodeURIComponent(subscription.id)}`, {
        method: 'DELETE',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        setSubscription(null);
        setSelectedCategories(['all']);
        if (auth.currentUser?.emailVerified) {
          deleteDoc(doc(db, 'task_alert_subscriptions', auth.currentUser.uid)).catch(() => {});
        }
        setFeedback({ type: 'success', text: 'Email alert subscription removed.' });
      }
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-blue-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-blue-50 via-white to-emerald-50/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-700 text-white flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">
                High-Reward Task Email Alerts
              </h3>
              {subscription?.active && (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  Active · {formatCurrencyFromKes(subscription.minRewardKes, selectedCountry)}+
                </span>
              )}
              {dispatches.length > 0 && (
                <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-md">
                  {dispatches.length} Matched Alert{dispatches.length === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-600">
              {subscription?.active
                ? `Alerts sent to ${subscription.email} for ${
                    subscription.categories.includes('all')
                      ? 'all task categories'
                      : subscription.categories.join(', ')
                  }.`
                : 'Get notified by email whenever new high-reward tasks matching your interests are posted.'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
        >
          <Mail className="w-3.5 h-3.5" />
          <span>{subscription?.active ? 'Manage Alerts' : 'Subscribe to Task Alerts'}</span>
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {expanded && (
        <div className="p-5 border-t border-slate-200 space-y-5 text-xs">
          {feedback && (
            <div
              className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-medium ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveSubscription} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Notification Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@gmail.com"
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Minimum High-Reward Threshold
                </label>
                <select
                  value={minRewardKes}
                  onChange={(e) => setMinRewardKes(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REWARD_THRESHOLDS_KES.map((kes) => (
                    <option key={kes} value={kes}>
                      {formatCurrencyFromKes(kes, selectedCountry)} ({kes} KSh) and above
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Delivery Frequency
                </label>
                <select
                  value={frequency}
                  onChange={(e) =>
                    setFrequency(e.target.value === 'daily_digest' ? 'daily_digest' : 'instant')
                  }
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="instant">Instant Alert on New Task</option>
                  <option value="daily_digest">Daily High-Reward Digest</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-2">
                Select Task Categories Matching Your Interests
              </label>
              <div className="flex flex-wrap gap-2">
                {INTEREST_OPTIONS.map((opt) => {
                  const selected = selectedCategories.includes(opt.id);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => toggleCategory(opt.id)}
                      className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors cursor-pointer ${
                        selected
                          ? 'bg-blue-700 border-blue-700 text-white'
                          : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {smtpConfigured
                    ? 'Direct SMTP email + live in-app alert feed enabled.'
                    : 'Alerts appear immediately in your subscriber alert feed and dispatch via SMTP when configured.'}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {subscription && (
                  <button
                    type="button"
                    onClick={() => void handleUnsubscribe()}
                    disabled={removing}
                    className="inline-flex items-center gap-1 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{removing ? 'Removing...' : 'Unsubscribe'}</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>
                    {saving
                      ? 'Saving Preferences...'
                      : !isAuthenticated
                      ? 'Sign In & Subscribe'
                      : subscription
                      ? 'Update Alert Preferences'
                      : 'Activate Email Alerts'}
                  </span>
                </button>
              </div>
            </div>
          </form>

          {dispatches.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5 text-blue-600" />
                <span>Recent Matched High-Reward Task Notifications</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {dispatches.slice(0, 4).map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 truncate">{d.taskTitle}</div>
                      <div className="text-[10px] text-slate-500">
                        {d.taskCategory} · {d.deliveryChannel} ({d.deliveryStatus})
                      </div>
                    </div>
                    <div className="font-mono font-bold text-emerald-700 shrink-0">
                      {formatCurrencyFromKes(d.taskRewardKes, selectedCountry)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
