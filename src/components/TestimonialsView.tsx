import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTasks } from '../context/TaskContext';
import { useRegion } from '../context/RegionContext';
import { EAST_AFRICA_COUNTRIES } from '../lib/eastAfrica';
import {
  MessageSquareHeart,
  Star,
  CheckCircle2,
  AlertCircle,
  Send,
  ShieldCheck,
  MapPin,
  ArrowLeft,
  Sparkles,
  RefreshCw,
} from 'lucide-react';

interface PublicTestimonial {
  id: string;
  userUid: string;
  authorName: string;
  city: string;
  countryCode: string;
  rating: number;
  headline: string;
  message: string;
  experienceCategory: string;
  verifiedCustomer: boolean;
  status: 'Published' | 'Featured' | 'Hidden';
  ownerReply?: string;
  createdAt: string;
}

const CATEGORIES = [
  'Overall Platform',
  'Tasks & Payouts',
  'Worker Passes',
  'Investment Pools',
  'Referrals & Community',
];

export const TestimonialsView: React.FC = () => {
  const { activeToken, customerProfile, user } = useAuth();
  const { setActiveTab, showNotification } = useTasks();
  const { selectedCountry } = useRegion();

  const [testimonials, setTestimonials] = useState<PublicTestimonial[]>([]);
  const [loading, setLoading] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<'all' | '5' | '4+'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Form states
  const [authorName, setAuthorName] = useState(
    customerProfile?.displayName || user?.displayName || ''
  );
  const [city, setCity] = useState(customerProfile?.city || 'Nairobi');
  const [countryCode, setCountryCode] = useState(
    customerProfile?.countryCode || selectedCountry.code || 'KE'
  );
  const [rating, setRating] = useState<number>(5);
  const [experienceCategory, setExperienceCategory] = useState<string>('Overall Platform');
  const [headline, setHeadline] = useState('');
  const [message, setMessage] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (customerProfile?.displayName && !authorName) {
      setAuthorName(customerProfile.displayName);
    }
    if (customerProfile?.city && !city) {
      setCity(customerProfile.city);
    }
    if (customerProfile?.countryCode) {
      setCountryCode(customerProfile.countryCode);
    }
  }, [customerProfile?.displayName, customerProfile?.city, customerProfile?.countryCode, authorName, city]);

  const loadTestimonials = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/testimonials');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.testimonials)) {
          setTestimonials(data.testimonials);
        }
      }
    } catch {
      // ignore transient error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTestimonials();
  }, [loadTestimonials]);

  const handleSubmitTestimonial = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (customerProfile?.banned) {
      setErrorMsg(
        `Account permanently banned 🚫 forever: ${customerProfile.bannedReason || 'Policy violation.'}`
      );
      return;
    }

    if (customerProfile?.deactivated) {
      setErrorMsg(
        `Account deactivated: ${customerProfile.deactivatedReason || 'Contact Support (+254712727558).'}`
      );
      return;
    }

    if (authorName.trim().length < 2) {
      setErrorMsg('Please enter your name (at least 2 characters).');
      return;
    }
    if (headline.trim().length < 4) {
      setErrorMsg('Please provide a short headline (at least 4 characters).');
      return;
    }
    if (message.trim().length < 12) {
      setErrorMsg('Please share your honest experience (at least 12 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/testimonials', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        body: JSON.stringify({
          authorName: authorName.trim(),
          city: city.trim() || 'East Africa',
          countryCode,
          rating,
          headline: headline.trim(),
          message: message.trim(),
          experienceCategory,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        setErrorMsg(data?.error || 'Could not publish testimonial.');
        setSubmitting(false);
        return;
      }

      if (data?.testimonial) {
        setTestimonials((prev) => [data.testimonial, ...prev]);
      }
      setHeadline('');
      setMessage('');
      setSuccessMsg('Thank you! Your testimonial has been published to the East Africa community feed.');
      showNotification('Your testimonial was published!');
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error publishing testimonial.');
    } finally {
      setSubmitting(false);
    }
  };

  const averageRating = useMemo(() => {
    if (testimonials.length === 0) return 0;
    const sum = testimonials.reduce((acc, t) => acc + (Number(t.rating) || 0), 0);
    return +(sum / testimonials.length).toFixed(1);
  }, [testimonials]);

  const filteredTestimonials = useMemo(() => {
    return testimonials.filter((t) => {
      if (ratingFilter === '5' && t.rating !== 5) return false;
      if (ratingFilter === '4+' && t.rating < 4) return false;
      if (categoryFilter !== 'all' && t.experienceCategory !== categoryFilter) return false;
      return true;
    });
  }, [testimonials, ratingFilter, categoryFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 border-b border-slate-200">
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 hover:underline cursor-pointer mb-1"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Customer Dashboard</span>
          </button>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2.5">
            <MessageSquareHeart className="w-7 h-7 text-blue-700 shrink-0" />
            <span>Customer Testimonials &amp; Reviews</span>
          </h1>
          <p className="text-sm text-slate-600 max-w-2xl">
            Read real contributor experiences across East Africa or post your own verified review about tasks, M-PESA withdrawals, Worker Passes, and KES 50+ investment pools.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1 text-amber-500">
              <Star className="w-4 h-4 fill-amber-400 text-amber-500" />
              <span className="font-mono font-extrabold text-slate-900 text-sm tabular-nums">
                {testimonials.length > 0 ? averageRating.toFixed(1) : '—'}
              </span>
            </div>
            <span className="text-slate-400">|</span>
            <span className="font-semibold text-slate-700 tabular-nums">
              {testimonials.length} Review{testimonials.length === 1 ? '' : 's'}
            </span>
          </div>

          <button
            type="button"
            onClick={() => void loadTestimonials()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-800 cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Post Testimonial Form */}
        <form
          onSubmit={handleSubmitTestimonial}
          className="lg:col-span-5 p-6 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-4"
        >
          <div className="space-y-1">
            <h2 className="text-base font-extrabold text-slate-900">Post Your Testimonial</h2>
            <p className="text-xs text-slate-500">
              Share authentic feedback with fellow East Africa contributors.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Your Name</label>
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="e.g. Grace Wanjiku"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">City / Town</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Nairobi, Kampala..."
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-blue-600 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Country</label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-blue-600 outline-hidden"
              >
                {EAST_AFRICA_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Topic</label>
              <select
                value={experienceCategory}
                onChange={(e) => setExperienceCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-900 focus:border-blue-600 outline-hidden"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Your Rating</label>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                    star <= rating
                      ? 'border-amber-300 bg-amber-50 text-amber-500'
                      : 'border-slate-200 bg-white text-slate-300'
                  }`}
                >
                  <Star className={`w-4 h-4 ${star <= rating ? 'fill-amber-400' : ''}`} />
                </button>
              ))}
              <span className="ml-2 font-mono text-xs font-bold text-slate-700">{rating}.0 / 5.0</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Review Headline</label>
            <input
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Fast M-PESA payout and clear task rules"
              maxLength={120}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-900 focus:border-blue-600 outline-hidden"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Your Experience</label>
            <textarea
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell other contributors what worked well for you..."
              maxLength={1000}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-900 focus:border-blue-600 outline-hidden"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-extrabold cursor-pointer disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            <span>{submitting ? 'Publishing...' : 'Publish Testimonial'}</span>
          </button>
        </form>

        {/* Testimonials Feed */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'all', label: 'All Ratings' },
                  { id: '5', label: '5 Stars Only' },
                  { id: '4+', label: '4+ Stars' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setRatingFilter(f.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer ${
                    ratingFilter === f.id
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-[11px] font-semibold text-slate-800"
            >
              <option value="all">All Topics</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {filteredTestimonials.length === 0 ? (
            <div className="p-10 bg-white rounded-3xl border border-slate-200 text-center space-y-2">
              <MessageSquareHeart className="w-8 h-8 text-slate-300 mx-auto" />
              <div className="text-sm font-bold text-slate-800">No testimonials posted yet</div>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Be the first verified East Africa contributor to post your real review using the form on the left.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredTestimonials.map((item) => (
                <article
                  key={item.id}
                  className={`p-5 rounded-2xl border bg-white space-y-3 ${
                    item.status === 'Featured' ? 'border-amber-300 shadow-xs' : 'border-slate-200'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-extrabold text-slate-900">{item.headline}</h3>
                        {item.status === 'Featured' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-extrabold uppercase">
                            <Sparkles className="w-3 h-3" />
                            <span>Featured</span>
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span className="font-bold text-slate-800">{item.authorName}</span>
                        {item.verifiedCustomer && (
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Verified Customer</span>
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          <span>
                            {item.city}, {item.countryCode}
                          </span>
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          {item.experienceCategory}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500 shrink-0">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= item.rating ? 'fill-amber-400 text-amber-500' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">
                    {item.message}
                  </p>

                  {item.ownerReply && (
                    <div className="p-3 rounded-xl bg-blue-50/80 border border-blue-200 text-xs space-y-1">
                      <div className="font-extrabold text-blue-900 text-[11px]">
                        Platform Owner Response:
                      </div>
                      <p className="text-blue-950">{item.ownerReply}</p>
                    </div>
                  )}

                  <div className="text-[10px] font-mono text-slate-400">
                    Posted {new Date(item.createdAt).toLocaleString()} · {item.id}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
