import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { useTasks } from '../context/TaskContext';
import { db, auth } from '../lib/firebase';
import {
  PPV_RATE_PER_VIEW_KES,
  PPV_STATUS_DURATION_HOURS,
  formatCurrencyFromKes,
} from '../lib/eastAfrica';
import {
  Play,
  Upload,
  Camera,
  Video,
  Clock,
  Eye,
  Wallet,
  CheckCircle2,
  Trash2,
  X,
  Lock,
  Sparkles,
  Search,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import seedMatatuImg from '../assets/images/ppv_matatu_comedy_1795082283871.jpg';
import seedRolexImg from '../assets/images/ppv_rolex_chef_1795082282893.jpg';
import seedGoatImg from '../assets/images/ppv_goat_selfie_1795082282481.jpg';

export type PpvMediaType = 'photo' | 'video';
export type PpvCategory = 'Funny Video' | 'Funny Photo' | 'My Photo' | 'My Video';
export type PpvPostStatus = 'Active (24h Live)' | 'Settled & Paid';

export interface PpvStatusPostItem {
  id: string;
  authorUid: string;
  authorName: string;
  countryCode: string;
  city: string;
  mediaType: PpvMediaType;
  category: PpvCategory;
  caption: string;
  mediaUrl: string;
  mimeType: string;
  ratePerViewKes: number;
  viewsCount: number;
  viewedByUids?: string[];
  viewedByUidsCount?: number;
  hasViewed?: boolean;
  pendingEarningsKes: number;
  paidOutKes: number;
  paidOut: boolean;
  status: PpvPostStatus;
  payoutTransactionId?: string;
  isSeeded?: boolean;
  dailyViewCounts?: Record<string, number>;
  createdAt: string;
  expiresAt: string;
  paidOutAt?: string;
}

function toFirestoreSafePpvPost(post: PpvStatusPostItem) {
  const {
    dailyViewCounts: _omitDaily,
    isSeeded: _omitSeed,
    hasViewed: _omitHasViewed,
    viewedByUidsCount: _omitViewedCount,
    ...rest
  } = post;
  return JSON.parse(JSON.stringify(rest));
}

const LOCAL_PPV_CACHE_KEY = 'gideon_ppv_statuses_cache_v1';

const SEED_IMAGE_MAP: Record<string, string> = {
  'PPV-SEED-01': seedMatatuImg,
  'PPV-SEED-02': seedRolexImg,
  'PPV-SEED-03': seedGoatImg,
};

export function resolvePpvMediaSrc(post: Pick<PpvStatusPostItem, 'id' | 'mediaUrl'>): string {
  if (SEED_IMAGE_MAP[post.id]) {
    return SEED_IMAGE_MAP[post.id];
  }
  return post.mediaUrl;
}

function formatRemaining24h(expiresAt: string, nowMs: number): { label: string; expired: boolean } {
  const target = Date.parse(expiresAt);
  if (!Number.isFinite(target)) return { label: '24h Active', expired: false };
  const diffMs = target - nowMs;
  if (diffMs <= 0) {
    return { label: '24h Complete · Auto-Paid', expired: true };
  }
  const totalMins = Math.floor(diffMs / 60000);
  const hrs = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  if (hrs > 0) {
    return { label: `${hrs}h ${mins}m left`, expired: false };
  }
  return { label: `${Math.max(1, mins)}m left`, expired: false };
}

export const PayPerViewView: React.FC = () => {
  const { user, customerProfile, isOwner, activeToken, getFreshToken, setAuthModalOpen } = useAuth();
  const { selectedCountry } = useRegion();
  const { showNotification, syncWalletFromServer } = useTasks();

  const currentUid = user?.uid || customerProfile?.uid || null;
  const currentName = customerProfile?.displayName || user?.displayName || 'East Africa Creator';

  const [posts, setPosts] = useState<PpvStatusPostItem[]>(() => {
    try {
      const raw = localStorage.getItem(LOCAL_PPV_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [filterTab, setFilterTab] = useState<'all' | 'videos' | 'photos' | 'mine'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'trending' | 'ending'>('newest');
  const [searchQuery, setSearchQuery] = useState('');
  const [chartScope, setChartScope] = useState<'mine' | 'all'>('mine');

  // Upload Composer Modal / Panel state
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState<PpvCategory>('Funny Photo');
  const [city, setCity] = useState(() => customerProfile?.city || 'Nairobi');
  const [mediaDataUrl, setMediaDataUrl] = useState<string>('');
  const [mediaFileName, setMediaFileName] = useState<string>('');
  const [previewMediaType, setPreviewMediaType] = useState<PpvMediaType>('photo');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Fullscreen Status Viewer state
  const [activeViewerPost, setActiveViewerPost] = useState<PpvStatusPostItem | null>(null);
  const [viewerNotice, setViewerNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const knownPaidIdsRef = useRef<Set<string>>(new Set());

  const fetchFeed = useCallback(async () => {
    try {
      const token = (await getFreshToken()) || activeToken;
      const res = await fetch('/api/ppv', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data?.posts)) {
        const incoming: PpvStatusPostItem[] = data.posts;
        setPosts(incoming);
        try {
          const nonSeed = incoming.filter((p) => !p.isSeeded);
          localStorage.setItem(LOCAL_PPV_CACHE_KEY, JSON.stringify(nonSeed.slice(0, 60)));
        } catch {}

        // If any of the current user's posts just transitioned to Settled & Paid, refresh wallet automatically!
        if (currentUid) {
          let newlyPaidFound = false;
          for (const p of incoming) {
            if (p.authorUid === currentUid && p.paidOut && !knownPaidIdsRef.current.has(p.id)) {
              knownPaidIdsRef.current.add(p.id);
              if (p.paidOutKes > 0) {
                newlyPaidFound = true;
              }
            }
          }
          if (newlyPaidFound) {
            await syncWalletFromServer();
          }
        }
      }
    } catch {
      // keep existing UI state on transient error
    } finally {
      setLoading(false);
    }
  }, [activeToken, getFreshToken, currentUid, syncWalletFromServer]);

  useEffect(() => {
    void fetchFeed();
    const pollId = window.setInterval(() => {
      void fetchFeed();
    }, 30000);
    const clockId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => {
      window.clearInterval(pollId);
      window.clearInterval(clockId);
    };
  }, [fetchFeed]);

  // Hydrate cached client posts on mount if server restarted
  useEffect(() => {
    if (!activeToken) return;
    try {
      const raw = localStorage.getItem(LOCAL_PPV_CACHE_KEY);
      if (!raw) return;
      const cached = JSON.parse(raw);
      if (Array.isArray(cached) && cached.length > 0) {
        fetch('/api/ppv/hydrate-sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${activeToken}`,
          },
          body: JSON.stringify({ posts: cached }),
        }).catch(() => {});
      }
    } catch {}
  }, [activeToken]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      setUploadError('Please select a photo (JPG, PNG, WebP, GIF) or video (MP4, WebM, MOV).');
      return;
    }
    if (file.size > 26 * 1024 * 1024) {
      setUploadError('File size must be under 26 MB for fast East Africa status playback.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      setMediaDataUrl(result);
      setMediaFileName(file.name);
      setPreviewMediaType(isVideo ? 'video' : 'photo');
      if (isVideo && (category === 'Funny Photo' || category === 'My Photo')) {
        setCategory('Funny Video');
      } else if (isImage && (category === 'Funny Video' || category === 'My Video')) {
        setCategory('Funny Photo');
      }
    };
    reader.onerror = () => {
      setUploadError('Could not read the selected file. Please try another photo or video.');
    };
    reader.readAsDataURL(file);
  };

  const handleOpenComposer = () => {
    if (!currentUid) {
      showNotification('Register or sign in for free to share your photos or videos and earn 5 KSh per view!');
      setAuthModalOpen(true);
      return;
    }
    setComposerOpen((prev) => !prev);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError(null);

    if (!currentUid) {
      setAuthModalOpen(true);
      return;
    }
    if (!mediaDataUrl) {
      setUploadError('Please choose a funny video, funny photo, or personal photo/video from your device.');
      return;
    }
    if (caption.trim().length < 3) {
      setUploadError('Add a short caption or title (at least 3 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const token = (await getFreshToken()) || activeToken;
      if (!token) {
        setAuthModalOpen(true);
        return;
      }

      const res = await fetch('/api/ppv/posts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          authorName: currentName,
          countryCode: selectedCountry.code,
          city: city.trim() || 'Nairobi',
          category,
          caption: caption.trim(),
          mediaDataUrl,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data?.success) {
        setUploadError(data?.error || 'Could not publish your status.');
        return;
      }

      if (Array.isArray(data.posts)) {
        setPosts(data.posts);
      }
      if (auth.currentUser?.emailVerified && data.post) {
        setDoc(doc(db, 'ppv_posts', data.post.id), toFirestoreSafePpvPost(data.post), { merge: true }).catch(
          () => {}
        );
      }

      setCaption('');
      setMediaDataUrl('');
      setMediaFileName('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setComposerOpen(false);
      showNotification(
        `Status posted free inside Gideon Global Tasks! Every unique registered view adds ${formatCurrencyFromKes(
          PPV_RATE_PER_VIEW_KES,
          selectedCountry
        )}, auto-paid to your wallet after 24 hours.`
      );
    } catch (err: any) {
      setUploadError(err?.message || 'Network error while uploading status.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleWatchStatus = async (post: PpvStatusPostItem) => {
    if (!currentUid) {
      showNotification('Sign in or register for free to view customer statuses!');
      setAuthModalOpen(true);
      return;
    }

    setActiveViewerPost(post);
    setViewerNotice(
      post.authorUid === currentUid
        ? 'Previewing your own 24-hour status (self-views do not add earnings).'
        : post.paidOut
        ? 'This 24-hour status has already been read and auto-paid to the creator wallet.'
        : 'Recording registered view...'
    );

    try {
      const token = (await getFreshToken()) || activeToken;
      if (!token) return;
      const res = await fetch(`/api/ppv/posts/${encodeURIComponent(post.id)}/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-ea-country': selectedCountry.code,
          'x-ea-verified': 'true',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (Array.isArray(data.posts)) {
          setPosts(data.posts);
        }
        if (data.post) {
          setActiveViewerPost(data.post);
          if (auth.currentUser?.emailVerified && !data.post.isSeeded) {
            setDoc(doc(db, 'ppv_posts', data.post.id), toFirestoreSafePpvPost(data.post), { merge: true }).catch(
              () => {}
            );
          }
        }
        if (data.selfView) {
          setViewerNotice('Your own status · Self-views are excluded from the 5 KSh/view tally.');
        } else if (data.expired) {
          setViewerNotice('24-hour window completed · Earnings settled automatically to creator wallet.');
        } else if (data.viewCounted) {
          setViewerNotice(
            `View counted! +${formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)} added toward ${
              post.authorName
            }'s 24h automatic wallet payout.`
          );
        } else {
          setViewerNotice(`You already viewed this status · 1 paid view per registered member.`);
        }
      }
    } catch {
      // keep viewer open cleanly
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!activeToken) return;
    setDeletingId(postId);
    try {
      const token = (await getFreshToken()) || activeToken;
      if (!token) return;
      const res = await fetch(`/api/ppv/posts/${encodeURIComponent(postId)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data?.success) {
        if (Array.isArray(data.posts)) setPosts(data.posts);
        if (auth.currentUser?.emailVerified) {
          deleteDoc(doc(db, 'ppv_posts', postId)).catch(() => {});
        }
        if (activeViewerPost?.id === postId) setActiveViewerPost(null);
        showNotification('Status removed from feed.');
      }
    } finally {
      setDeletingId(null);
    }
  };

  const myPosts = useMemo(
    () => (currentUid ? posts.filter((p) => p.authorUid === currentUid) : []),
    [posts, currentUid]
  );

  const myLiveEarningsKes = useMemo(
    () => myPosts.filter((p) => !p.paidOut).reduce((sum, p) => sum + p.pendingEarningsKes, 0),
    [myPosts]
  );
  const myPaidEarningsKes = useMemo(
    () => myPosts.filter((p) => p.paidOut).reduce((sum, p) => sum + p.paidOutKes, 0),
    [myPosts]
  );

  // Aggregate daily view counts over the last 7 days (both for the signed-in user and platform-wide)
  const last7DaysViewSeries = useMemo(() => {
    const dayKeys: string[] = [];
    const dayLabels: string[] = [];
    const baseNow = Date.now();
    for (let i = 6; i >= 0; i--) {
      const dt = new Date(baseNow - i * 24 * 60 * 60 * 1000);
      const isoKey = dt.toISOString().slice(0, 10);
      dayKeys.push(isoKey);
      dayLabels.push(
        i === 0
          ? 'Today'
          : dt.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })
      );
    }

    const myByDay = new Map<string, number>();
    const allByDay = new Map<string, number>();
    dayKeys.forEach((k) => {
      myByDay.set(k, 0);
      allByDay.set(k, 0);
    });

    for (const post of posts) {
      const isMine = Boolean(currentUid && post.authorUid === currentUid);
      const daily = post.dailyViewCounts;
      let accounted = 0;

      if (daily && typeof daily === 'object') {
        for (const [dateKey, countVal] of Object.entries(daily)) {
          const n = Math.max(0, Number(countVal || 0));
          accounted += n;
          if (allByDay.has(dateKey)) {
            allByDay.set(dateKey, (allByDay.get(dateKey) || 0) + n);
          }
          if (isMine && myByDay.has(dateKey)) {
            myByDay.set(dateKey, (myByDay.get(dateKey) || 0) + n);
          }
        }
      }

      // Attribute any unbucketed views onto the post's creation day if within the 7-day window
      const remainder = Math.max(0, Number(post.viewsCount || 0) - accounted);
      if (remainder > 0) {
        const createdKey = String(post.createdAt || '').slice(0, 10);
        if (allByDay.has(createdKey)) {
          allByDay.set(createdKey, (allByDay.get(createdKey) || 0) + remainder);
        }
        if (isMine && myByDay.has(createdKey)) {
          myByDay.set(createdKey, (myByDay.get(createdKey) || 0) + remainder);
        }
      }
    }

    return dayKeys.map((dateKey, idx) => {
      const myViews = myByDay.get(dateKey) || 0;
      const allViews = allByDay.get(dateKey) || 0;
      const effectiveViews = currentUid && chartScope === 'mine' ? myViews : allViews;
      return {
        dateKey,
        dayLabel: dayLabels[idx],
        myViews,
        allViews,
        views: effectiveViews,
        earningsKes: effectiveViews * PPV_RATE_PER_VIEW_KES,
      };
    });
  }, [posts, currentUid, chartScope]);

  const total7DayViews = useMemo(
    () => last7DaysViewSeries.reduce((sum, d) => sum + d.views, 0),
    [last7DaysViewSeries]
  );
  const peakDayViews = useMemo(
    () => Math.max(0, ...last7DaysViewSeries.map((d) => d.views)),
    [last7DaysViewSeries]
  );

  const filteredPosts = useMemo(() => {
    return posts
      .filter((p) => {
        if (filterTab === 'videos' && p.mediaType !== 'video') return false;
        if (filterTab === 'photos' && p.mediaType !== 'photo') return false;
        if (filterTab === 'mine' && p.authorUid !== currentUid) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (
            !p.caption.toLowerCase().includes(q) &&
            !p.authorName.toLowerCase().includes(q) &&
            !p.city.toLowerCase().includes(q) &&
            !p.category.toLowerCase().includes(q)
          ) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'trending') return b.viewsCount - a.viewsCount;
        if (sortBy === 'ending') return Date.parse(a.expiresAt) - Date.parse(b.expiresAt);
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [posts, filterTab, currentUid, searchQuery, sortBy]);

  return (
    <div className="space-y-8">
      {/* Hero Banner */}
      <div className="bg-slate-900 rounded-2xl p-6 md:p-8 text-white border border-slate-800 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 max-w-2xl">
            <div className="text-xs font-semibold text-emerald-300 tracking-wide">
              100% Free Upload · No Pass or Purchase Required · Platform-Only Status Feed
            </div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
              Pay-Per-View Funny Videos, Photos &amp; 24-Hour Status Feed
            </h1>
            <p className="text-xs md:text-sm text-slate-300 leading-relaxed">
              Upload your funny videos, funny photos, or personal photos and videos directly inside Gideon Global Tasks at zero cost. Every registered member who watches your status adds{' '}
              <strong className="text-white font-mono">
                {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)}
              </strong>{' '}
              per view, and the system automatically reads views and credits your wallet after {PPV_STATUS_DURATION_HOURS} hours.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleOpenComposer}
              className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs md:text-sm flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span>{composerOpen ? 'Close Upload Form' : 'Post Status Free (0 Fee)'}</span>
            </button>
            <button
              type="button"
              onClick={() => void fetchFeed()}
              className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs flex items-center gap-1.5 border border-slate-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Refresh statuses and check 24h auto-payouts"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh Feed</span>
            </button>
          </div>
        </div>

        {/* Clean 3-Stat Mechanics Strip */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-800 text-xs">
          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-1">
            <div className="text-slate-400 font-medium">Upload &amp; Viewing Cost</div>
            <div className="text-base font-extrabold text-emerald-300 font-mono tabular-nums">
              FREE (KSh 0)
            </div>
            <div className="text-[11px] text-slate-300">100% free access · No pass or deposit needed</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-1">
            <div className="text-slate-400 font-medium">Creator Pay Rate</div>
            <div className="text-base font-extrabold text-white font-mono tabular-nums">
              {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)} / Registered View
            </div>
            <div className="text-[11px] text-slate-300">Any signed-in customer can view shared statuses</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-1">
            <div className="text-slate-400 font-medium">Auto Wallet Settlement</div>
            <div className="text-base font-extrabold text-sky-300 font-mono tabular-nums">
              Automatic After 24h
            </div>
            <div className="text-[11px] text-slate-300">System reads view count &amp; pays wallet automatically</div>
          </div>
        </div>
      </div>

      {/* Free Upload Form */}
      {composerOpen && (
        <form
          onSubmit={handleUploadSubmit}
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                Share a Free 24-Hour Status Inside Platform
              </h2>
              <p className="text-xs text-slate-500">
                Upload funny clips, memes, or your own photos &amp; videos. Earn{' '}
                {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)} per registered view—credited automatically to your wallet at 24 hours.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setComposerOpen(false)}
              className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {uploadError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold">
              {uploadError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-5 space-y-3">
              <label className="block text-xs font-bold text-slate-800">
                1. Choose Photo or Video (JPG, PNG, GIF, MP4, WebM)
              </label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-2xl p-4 text-center bg-slate-50 hover:bg-blue-50/40 transition-colors cursor-pointer min-h-[210px] flex flex-col items-center justify-center gap-2 overflow-hidden"
              >
                {mediaDataUrl ? (
                  previewMediaType === 'video' ? (
                    <video
                      src={mediaDataUrl}
                      controls
                      className="w-full max-h-48 rounded-xl bg-black"
                      onClick={(ev) => ev.stopPropagation()}
                    />
                  ) : (
                    <img
                      src={mediaDataUrl}
                      alt="Upload preview"
                      className="w-full max-h-48 object-contain rounded-xl"
                    />
                  )
                ) : (
                  <>
                    <div className="flex items-center gap-2 text-slate-500">
                      <Camera className="w-5 h-5" />
                      <Video className="w-5 h-5" />
                    </div>
                    <div className="text-xs font-bold text-slate-700">
                      Click to select funny photo or video
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Posted strictly inside platform · Max 26 MB
                    </div>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {mediaFileName && (
                <div className="text-[11px] text-slate-500 font-mono truncate">
                  Selected: {mediaFileName}
                </div>
              )}
            </div>

            <div className="md:col-span-7 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    2. Status Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as PpvCategory)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Funny Video">Funny Video</option>
                    <option value="Funny Photo">Funny Photo</option>
                    <option value="My Video">My Own Video</option>
                    <option value="My Photo">My Own Photo</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-800">
                    3. City / Location
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="e.g. Nairobi, Kampala, Arusha"
                    maxLength={50}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-800">
                  4. Caption or Funny Description
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  rows={4}
                  maxLength={280}
                  placeholder="Write a short funny line or tell members what happens in your photo/video..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="text-[11px] text-slate-400 text-right font-mono">
                  {caption.length}/280
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="text-[11px] text-slate-500">
                  Free upload · Runs 24h · Auto-pays{' '}
                  <strong className="text-slate-800">
                    {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)}/view
                  </strong>{' '}
                  to your wallet
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold text-xs flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{submitting ? 'Uploading Status...' : 'Publish 24h Status Free'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Personal 24-Hour Status Payout Summary Bar (for signed-in creators) */}
      {currentUid && myPosts.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="space-y-0.5">
            <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <span>Your 24-Hour Status Earnings Summary ({myPosts.length} uploads)</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Pending amounts calculate live at {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)} per registered view and credit automatically into your main wallet once 24 hours finish.
            </p>
          </div>
          <div className="flex items-center gap-6 text-xs font-mono tabular-nums">
            <div>
              <span className="text-slate-400 block text-[10px]">LIVE 24H PENDING</span>
              <strong className="text-sm text-blue-700">
                {formatCurrencyFromKes(myLiveEarningsKes, selectedCountry)}
              </strong>
            </div>
            <div className="h-7 w-px bg-slate-200" />
            <div>
              <span className="text-slate-400 block text-[10px]">AUTO-PAID TO WALLET</span>
              <strong className="text-sm text-emerald-700">
                {formatCurrencyFromKes(myPaidEarningsKes, selectedCountry)}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Daily Status View Counts (Last 7 Days) Recharts Line Chart */}
      <section
        aria-label="Daily Status View Counts Over the Last 7 Days"
        className="bg-white rounded-2xl border border-slate-200 p-5 md:p-6 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <span>
                {currentUid && chartScope === 'mine'
                  ? 'Your Daily Status View Counts (Last 7 Days)'
                  : 'Platform Daily Status View Counts (Last 7 Days)'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              Tracks daily unique views earned across the last 7 days at{' '}
              <span className="font-mono font-semibold text-slate-700">
                {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)}/view
              </span>
              .
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-4 text-xs font-mono tabular-nums pr-1">
              <div>
                <span className="text-[10px] text-slate-400 block">7-DAY VIEWS</span>
                <strong className="text-slate-900">{total7DayViews.toLocaleString()}</strong>
              </div>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="text-[10px] text-slate-400 block">PEAK DAY</span>
                <strong className="text-emerald-700">{peakDayViews.toLocaleString()}</strong>
              </div>
            </div>

            {currentUid ? (
              <div className="inline-flex items-center p-1 bg-slate-100 rounded-xl text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setChartScope('mine')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartScope === 'mine'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  My Statuses
                </button>
                <button
                  type="button"
                  onClick={() => setChartScope('all')}
                  className={`px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    chartScope === 'all'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All Feed
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAuthModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sign In to Track Your Views
              </button>
            )}
          </div>
        </div>

        <div className="relative h-60 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={last7DaysViewSeries}
              margin={{ top: 10, right: 16, left: -12, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis
                dataKey="dayLabel"
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const pt = payload[0]?.payload as {
                    dateKey: string;
                    dayLabel: string;
                    views: number;
                    earningsKes: number;
                  };
                  if (!pt) return null;
                  return (
                    <div className="bg-slate-900 text-white px-3 py-2 rounded-xl text-xs shadow-lg border border-slate-700 space-y-0.5">
                      <div className="font-bold text-slate-200">
                        {pt.dayLabel} · <span className="font-mono text-slate-400">{pt.dateKey}</span>
                      </div>
                      <div className="font-mono tabular-nums text-emerald-300 font-bold">
                        {pt.views.toLocaleString()} {pt.views === 1 ? 'view' : 'views'}
                      </div>
                      <div className="font-mono tabular-nums text-[11px] text-slate-300">
                        Value: {formatCurrencyFromKes(pt.earningsKes, selectedCountry)}
                      </div>
                    </div>
                  );
                }}
              />
              <Line
                type="monotone"
                dataKey="views"
                name="Daily Status Views"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#0f172a', stroke: '#10b981', strokeWidth: 2 }}
              />
            </LineChart>
          </ResponsiveContainer>

          {currentUid && chartScope === 'mine' && myPosts.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/75 backdrop-blur-[1px] rounded-xl pointer-events-auto">
              <div className="text-center space-y-2 px-4">
                <p className="text-xs font-bold text-slate-800">
                  No personal status uploads yet in the last 7 days
                </p>
                <p className="text-[11px] text-slate-500">
                  Post a funny photo or video for free to watch your daily view curve climb.
                </p>
                <button
                  type="button"
                  onClick={() => setComposerOpen(true)}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold cursor-pointer"
                >
                  Post Status Free
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Feed Filter & Sort Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
          {(
            [
              { id: 'all', label: `All Statuses (${posts.length})` },
              {
                id: 'videos',
                label: `Funny Videos (${posts.filter((p) => p.mediaType === 'video').length})`,
              },
              {
                id: 'photos',
                label: `Funny Photos (${posts.filter((p) => p.mediaType === 'photo').length})`,
              },
              { id: 'mine', label: `My 24h Uploads (${myPosts.length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilterTab(t.id)}
              className={`px-3.5 py-2 rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterTab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search creator, city, caption..."
              className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
            />
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'newest' | 'trending' | 'ending')}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="newest">Newest Statuses</option>
            <option value="trending">Most Views</option>
            <option value="ending">Settling Soonest</option>
          </select>
        </div>
      </div>

      {/* Status Feed Grid */}
      {loading && posts.length === 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 overflow-hidden h-80 p-4 space-y-3">
              <div className="h-44 bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-100 rounded w-3/4" />
              <div className="h-3 bg-slate-100 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Camera className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-extrabold text-slate-900">
            No matching statuses yet
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Upload your funny video, funny meme photo, or personal snapshot for free—earn{' '}
            {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)} per registered view inside the platform!
          </p>
          <button
            type="button"
            onClick={handleOpenComposer}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Post Your First Free Status
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPosts.map((post) => {
            const countdown = formatRemaining24h(post.expiresAt, nowMs);
            const mediaSrc = resolvePpvMediaSrc(post);
            const canDelete = Boolean(isOwner || (currentUid && post.authorUid === currentUid));

            return (
              <article
                key={post.id}
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                {/* Clean Media Frame */}
                <div>
                  <div
                    onClick={() => void handleWatchStatus(post)}
                    className="relative aspect-[4/3] bg-slate-900 overflow-hidden cursor-pointer group"
                  >
                    {post.mediaType === 'video' ? (
                      <video
                        src={mediaSrc}
                        muted
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    ) : (
                      <img
                        src={mediaSrc}
                        alt={post.caption}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                      />
                    )}

                    {/* Contrast Scrim */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent pointer-events-none" />

                    {/* Top Corner Clean Label */}
                    <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 text-[11px] font-semibold text-white">
                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-xs flex items-center gap-1">
                        {post.mediaType === 'video' ? (
                          <Video className="w-3 h-3 text-emerald-300" />
                        ) : (
                          <Camera className="w-3 h-3 text-sky-300" />
                        )}
                        <span>{post.category}</span>
                      </span>

                      <span className="px-2.5 py-1 rounded-lg bg-slate-950/75 backdrop-blur-xs font-mono tabular-nums flex items-center gap-1">
                        {post.paidOut ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-300">Auto-Paid</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-300" />
                            <span>{countdown.label}</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Center Play Prompt for Videos or Protected Guest Overlay */}
                    {post.mediaType === 'video' && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-white/90 text-slate-900 flex items-center justify-center shadow-lg">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                    )}

                    {/* Bottom Scrim Title Overlay */}
                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-xs text-white">
                      <span className="font-mono tabular-nums font-bold">
                        {post.viewsCount.toLocaleString()} views
                      </span>
                      <span className="font-mono tabular-nums font-extrabold text-emerald-300">
                        {post.paidOut
                          ? `Paid ${formatCurrencyFromKes(post.paidOutKes, selectedCountry)}`
                          : `${formatCurrencyFromKes(post.pendingEarningsKes, selectedCountry)} pending`}
                      </span>
                    </div>
                  </div>

                  {/* Body Copy & Clean Unboxed Metadata */}
                  <div className="p-4 space-y-2.5">
                    <div className="text-[11px] text-slate-500 font-medium flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-slate-800">{post.authorName}</span>
                      <span>·</span>
                      <span>{post.city}</span>
                      <span>·</span>
                      <span>{post.countryCode}</span>
                    </div>

                    <p className="text-xs md:text-sm font-semibold text-slate-900 leading-relaxed line-clamp-3">
                      {post.caption}
                    </p>
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-4 pb-4 pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => void handleWatchStatus(post)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    {currentUid ? (
                      <>
                        <Eye className="w-3.5 h-3.5" />
                        <span>
                          {post.hasViewed ? 'Watched' : post.mediaType === 'video' ? 'Watch Video' : 'View Status'}
                        </span>
                      </>
                    ) : (
                      <>
                        <Lock className="w-3.5 h-3.5 text-amber-300" />
                        <span>Sign In to View</span>
                      </>
                    )}
                  </button>

                  {canDelete && (
                    <button
                      type="button"
                      disabled={deletingId === post.id}
                      onClick={() => void handleDeletePost(post.id)}
                      className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition-colors cursor-pointer shrink-0"
                      title="Delete this status"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Registered Member Fullscreen Status Viewer Modal */}
      {activeViewerPost && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setActiveViewerPost(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-3xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-extrabold truncate">{activeViewerPost.authorName}</div>
                <div className="text-[11px] text-slate-300 flex items-center gap-2">
                  <span>{activeViewerPost.category}</span>
                  <span>·</span>
                  <span>{activeViewerPost.city}</span>
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    {activeViewerPost.viewsCount.toLocaleString()} views (
                    {formatCurrencyFromKes(
                      activeViewerPost.paidOut ? activeViewerPost.paidOutKes : activeViewerPost.pendingEarningsKes,
                      selectedCountry
                    )}
                    )
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveViewerPost(null)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black flex items-center justify-center max-h-[65vh]">
              {activeViewerPost.mediaType === 'video' ? (
                <video
                  src={resolvePpvMediaSrc(activeViewerPost)}
                  controls
                  autoPlay
                  playsInline
                  className="w-full max-h-[65vh] object-contain"
                />
              ) : (
                <img
                  src={resolvePpvMediaSrc(activeViewerPost)}
                  alt={activeViewerPost.caption}
                  className="w-full max-h-[65vh] object-contain"
                />
              )}
            </div>

            <div className="p-5 space-y-3 bg-white">
              <p className="text-sm font-semibold text-slate-900 leading-relaxed">
                {activeViewerPost.caption}
              </p>
              {viewerNotice && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{viewerNotice}</span>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-500 pt-1">
                <span>
                  Status Window:{' '}
                  <strong className="text-slate-800">
                    {activeViewerPost.paidOut
                      ? 'Settled & Paid Automatically to Creator Wallet'
                      : formatRemaining24h(activeViewerPost.expiresAt, nowMs).label}
                  </strong>
                </span>
                <span className="font-mono">
                  Rate: {formatCurrencyFromKes(PPV_RATE_PER_VIEW_KES, selectedCountry)} / Registered View
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
