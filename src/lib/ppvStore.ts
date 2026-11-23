import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import {
  PPV_RATE_PER_VIEW_KES,
  PPV_STATUS_DURATION_HOURS,
  convertKesToUsd,
  KES_PER_USD,
} from './eastAfrica.ts';
import { creditPpvEarningsToWallet } from './customerStateStore.ts';
import { upsertPlatformTransaction } from './transactionsStore.ts';

export type PpvMediaType = 'photo' | 'video';
export type PpvCategory = 'Funny Video' | 'Funny Photo' | 'My Photo' | 'My Video';
export type PpvPostStatus = 'Active (24h Live)' | 'Settled & Paid';

export interface PpvStatusPost {
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
  viewedByUids: string[];
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

function getIsoDateKey(timestampMs: number = Date.now()): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

function buildRecent7DayCounts(weights: number[]): Record<string, number> {
  const out: Record<string, number> = {};
  const baseNow = Date.now();
  for (let i = 0; i < 7; i++) {
    const dayKey = getIsoDateKey(baseNow - (6 - i) * 24 * 60 * 60 * 1000);
    out[dayKey] = weights[i] ?? 0;
  }
  return out;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const PPV_MEDIA_DIR = path.join(DATA_DIR, 'ppv-media');
const PPV_POSTS_FILE = path.join(DATA_DIR, 'ppv-posts.json');
const PPV_COLLECTION = 'ppv_posts';

const DURATION_MS = PPV_STATUS_DURATION_HOURS * 60 * 60 * 1000;
const postsById = new Map<string, PpvStatusPost>();

function buildSeedPosts(): PpvStatusPost[] {
  const now = Date.now();
  const isoOffset = (hoursAgo: number) => new Date(now - hoursAgo * 60 * 60 * 1000).toISOString();
  const expiresFrom = (hoursAgo: number) => new Date(now + (24 - hoursAgo) * 60 * 60 * 1000).toISOString();

  return [
    {
      id: 'PPV-SEED-01',
      authorUid: 'seed-creator-01',
      authorName: 'Brian Kamau',
      countryCode: 'KE',
      city: 'Nairobi',
      mediaType: 'photo',
      category: 'Funny Photo',
      caption: 'Spotted in Ngong Road morning jam: "No Hurry in Africa, Unless It Is Payday!" Best bumper sticker this week.',
      mediaUrl: '/seed/ppv_matatu_comedy',
      mimeType: 'image/jpeg',
      ratePerViewKes: PPV_RATE_PER_VIEW_KES,
      viewsCount: 24,
      viewedByUids: [],
      pendingEarningsKes: 24 * PPV_RATE_PER_VIEW_KES,
      paidOutKes: 0,
      paidOut: false,
      status: 'Active (24h Live)',
      isSeeded: true,
      dailyViewCounts: buildRecent7DayCounts([2, 3, 4, 3, 5, 4, 3]),
      createdAt: isoOffset(3),
      expiresAt: expiresFrom(3),
    },
    {
      id: 'PPV-SEED-02',
      authorUid: 'seed-creator-02',
      authorName: 'Grace Namukasa',
      countryCode: 'UG',
      city: 'Kampala',
      mediaType: 'photo',
      category: 'My Photo',
      caption: 'Tried to flip a giant Kampala rolex like a five-star chef — caught the exact moment before landing!',
      mediaUrl: '/seed/ppv_rolex_chef',
      mimeType: 'image/jpeg',
      ratePerViewKes: PPV_RATE_PER_VIEW_KES,
      viewsCount: 19,
      viewedByUids: [],
      pendingEarningsKes: 19 * PPV_RATE_PER_VIEW_KES,
      paidOutKes: 0,
      paidOut: false,
      status: 'Active (24h Live)',
      isSeeded: true,
      dailyViewCounts: buildRecent7DayCounts([1, 2, 2, 3, 4, 3, 4]),
      createdAt: isoOffset(6),
      expiresAt: expiresFrom(6),
    },
    {
      id: 'PPV-SEED-03',
      authorUid: 'seed-creator-03',
      authorName: 'Faith Wanjiku',
      countryCode: 'KE',
      city: 'Nakuru',
      mediaType: 'photo',
      category: 'Funny Photo',
      caption: 'Left my phone on the fence for 10 seconds and our farm goat decided to take his own passport photo.',
      mediaUrl: '/seed/ppv_goat_selfie',
      mimeType: 'image/jpeg',
      ratePerViewKes: PPV_RATE_PER_VIEW_KES,
      viewsCount: 31,
      viewedByUids: [],
      pendingEarningsKes: 31 * PPV_RATE_PER_VIEW_KES,
      paidOutKes: 0,
      paidOut: false,
      status: 'Active (24h Live)',
      isSeeded: true,
      dailyViewCounts: buildRecent7DayCounts([3, 4, 5, 4, 5, 6, 4]),
      createdAt: isoOffset(11),
      expiresAt: expiresFrom(11),
    },
  ];
}

function syncPostToFirestore(post: PpvStatusPost) {
  if (!adminDb || post.isSeeded) return;
  try {
    const { dailyViewCounts: _omitDaily, isSeeded: _omitSeed, ...firestoreSafe } = post;
    adminDb
      .collection(PPV_COLLECTION)
      .doc(post.id)
      .set(JSON.parse(JSON.stringify(firestoreSafe)), { merge: true })
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

function persistPostsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(postsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(PPV_POSTS_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist PPV posts store:', (err as Error)?.message || err);
  }
}

function loadPostsFromDisk() {
  try {
    if (!fs.existsSync(PPV_POSTS_FILE)) {
      const seeds = buildSeedPosts();
      seeds.forEach((p) => postsById.set(p.id, p));
      persistPostsToDisk();
      return;
    }
    const raw = JSON.parse(fs.readFileSync(PPV_POSTS_FILE, 'utf8'));
    const seedDefaults = new Map(buildSeedPosts().map((s) => [s.id, s]));
    let backfilled = false;
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (item?.id) {
          if (!item.dailyViewCounts || Object.keys(item.dailyViewCounts).length === 0) {
            const seedMatch = seedDefaults.get(item.id);
            if (seedMatch?.dailyViewCounts) {
              item.dailyViewCounts = seedMatch.dailyViewCounts;
            } else {
              const dayKey = String(item.createdAt || new Date().toISOString()).slice(0, 10);
              item.dailyViewCounts = { [dayKey]: Math.max(0, Number(item.viewsCount || 0)) };
            }
            backfilled = true;
          }
          postsById.set(item.id, item);
        }
      }
    }
    if (backfilled) {
      persistPostsToDisk();
    }
    if (postsById.size === 0) {
      const seeds = buildSeedPosts();
      seeds.forEach((p) => postsById.set(p.id, p));
      persistPostsToDisk();
    }
  } catch (err) {
    console.warn('Could not load PPV posts store:', (err as Error)?.message || err);
  }
}

loadPostsFromDisk();

const ALLOWED_MEDIA_MIMES: Record<string, { ext: string; mediaType: PpvMediaType; contentType: string }> = {
  'image/png': { ext: 'png', mediaType: 'photo', contentType: 'image/png' },
  'image/jpeg': { ext: 'jpg', mediaType: 'photo', contentType: 'image/jpeg' },
  'image/jpg': { ext: 'jpg', mediaType: 'photo', contentType: 'image/jpeg' },
  'image/webp': { ext: 'webp', mediaType: 'photo', contentType: 'image/webp' },
  'image/gif': { ext: 'gif', mediaType: 'photo', contentType: 'image/gif' },
  'video/mp4': { ext: 'mp4', mediaType: 'video', contentType: 'video/mp4' },
  'video/webm': { ext: 'webm', mediaType: 'video', contentType: 'video/webm' },
  'video/quicktime': { ext: 'mov', mediaType: 'video', contentType: 'video/quicktime' },
  'video/x-m4v': { ext: 'm4v', mediaType: 'video', contentType: 'video/mp4' },
  'video/ogg': { ext: 'ogv', mediaType: 'video', contentType: 'video/ogg' },
};

export function savePpvMediaBase64(dataUrl: string): {
  filename: string;
  mediaUrl: string;
  mimeType: string;
  mediaType: PpvMediaType;
} {
  const match = /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9.+_-]+)(?:;[^,]*)?;base64,([A-Za-z0-9+/=\s]+)$/i.exec(
    String(dataUrl || '').trim()
  );
  if (!match) {
    throw new Error('Please upload a valid photo (PNG, JPG, WebP, GIF) or video (MP4, WebM, MOV).');
  }

  const rawMime = match[1].toLowerCase();
  const spec = ALLOWED_MEDIA_MIMES[rawMime];
  if (!spec) {
    throw new Error(`Unsupported file format (${rawMime}). Allowed: JPG, PNG, WebP, GIF, MP4, WebM, MOV.`);
  }

  const base64Clean = match[2].replace(/\s+/g, '');
  const buffer = Buffer.from(base64Clean, 'base64');

  if (buffer.byteLength < 512) {
    throw new Error('Uploaded file appears empty or corrupted. Please choose another photo or video.');
  }
  if (buffer.byteLength > 28 * 1024 * 1024) {
    throw new Error('Uploaded photo or video must be under 28 MB.');
  }

  if (!fs.existsSync(PPV_MEDIA_DIR)) {
    fs.mkdirSync(PPV_MEDIA_DIR, { recursive: true });
  }

  const filename = `ppv-${crypto.randomBytes(8).toString('hex')}.${spec.ext}`;
  const fullPath = path.join(PPV_MEDIA_DIR, filename);
  fs.writeFileSync(fullPath, buffer);

  return {
    filename,
    mediaUrl: `/api/ppv/media/${filename}`,
    mimeType: spec.contentType,
    mediaType: spec.mediaType,
  };
}

export function resolvePpvMediaFilePath(filename: string): { fullPath: string; contentType: string } | null {
  if (!/^ppv-[a-f0-9]+\.(png|jpg|webp|gif|mp4|webm|mov|m4v|ogv)$/i.test(filename)) {
    return null;
  }
  const fullPath = path.join(PPV_MEDIA_DIR, filename);
  if (!fs.existsSync(fullPath)) return null;
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const contentTypeMap: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    gif: 'image/gif',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mov: 'video/quicktime',
    m4v: 'video/mp4',
    ogv: 'video/ogg',
  };
  return {
    fullPath,
    contentType: contentTypeMap[ext] || 'application/octet-stream',
  };
}

export function deletePpvMediaFile(mediaUrl?: string) {
  if (!mediaUrl || !mediaUrl.startsWith('/api/ppv/media/')) return;
  const filename = mediaUrl.replace('/api/ppv/media/', '');
  const resolved = resolvePpvMediaFilePath(filename);
  if (resolved) {
    try {
      fs.unlinkSync(resolved.fullPath);
    } catch {}
  }
}

export function createPpvPost(params: {
  authorUid: string;
  authorName: string;
  countryCode: string;
  city: string;
  category?: PpvCategory;
  caption: string;
  mediaDataUrl: string;
}): PpvStatusPost {
  const cleanUid = String(params.authorUid || '').trim();
  if (!cleanUid) {
    throw new Error('Please register or sign in for free before uploading a status.');
  }
  const cleanCaption = String(params.caption || '').trim().slice(0, 280);
  if (cleanCaption.length < 3) {
    throw new Error('Please add a short caption or funny title (at least 3 characters).');
  }

  const saved = savePpvMediaBase64(params.mediaDataUrl);
  const validCategories: PpvCategory[] = ['Funny Video', 'Funny Photo', 'My Photo', 'My Video'];
  const defaultCategory: PpvCategory = saved.mediaType === 'video' ? 'Funny Video' : 'Funny Photo';
  const category: PpvCategory =
    params.category && validCategories.includes(params.category) ? params.category : defaultCategory;

  const nowMs = Date.now();
  const createdAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + DURATION_MS).toISOString();
  const id = `PPV-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const post: PpvStatusPost = {
    id,
    authorUid: cleanUid,
    authorName: String(params.authorName || 'East Africa Creator').trim().slice(0, 80),
    countryCode: String(params.countryCode || 'KE').trim().toUpperCase().slice(0, 4),
    city: String(params.city || 'Nairobi').trim().slice(0, 60) || 'Nairobi',
    mediaType: saved.mediaType,
    category,
    caption: cleanCaption,
    mediaUrl: saved.mediaUrl,
    mimeType: saved.mimeType,
    ratePerViewKes: PPV_RATE_PER_VIEW_KES,
    viewsCount: 0,
    viewedByUids: [],
    pendingEarningsKes: 0,
    paidOutKes: 0,
    paidOut: false,
    status: 'Active (24h Live)',
    isSeeded: false,
    dailyViewCounts: { [getIsoDateKey(nowMs)]: 0 },
    createdAt,
    expiresAt,
  };

  postsById.set(post.id, post);
  persistPostsToDisk();
  syncPostToFirestore(post);
  return post;
}

function settleSinglePostInternal(post: PpvStatusPost, isForcedByOwner = false): { settled: boolean; amountKes: number } {
  if (post.paidOut) return { settled: false, amountKes: 0 };

  const payoutKes = Math.max(0, post.viewsCount * PPV_RATE_PER_VIEW_KES);
  const nowIso = new Date().toISOString();
  const txId = `PPV-PAYOUT-${post.id}`;

  post.paidOut = true;
  post.status = 'Settled & Paid';
  post.paidOutKes = payoutKes;
  post.paidOutAt = nowIso;
  post.payoutTransactionId = txId;

  if (!post.isSeeded && payoutKes > 0) {
    creditPpvEarningsToWallet({
      uid: post.authorUid,
      postId: post.id,
      viewsCount: post.viewsCount,
      amountKes: payoutKes,
      caption: post.caption,
    });

    upsertPlatformTransaction({
      id: txId,
      kind: 'ppv_payout',
      title: `24h Status Payout (${post.viewsCount} views × KSh ${PPV_RATE_PER_VIEW_KES})`,
      customerLabel: `${post.authorName} (${post.city})`,
      gatewayOrMethod: isForcedByOwner ? 'Owner Early 24h Settlement → Wallet' : 'Automatic 24h Status Reader → Wallet',
      currency: 'KES',
      amountLocal: payoutKes,
      amountUsd: +(payoutKes / KES_PER_USD).toFixed(4),
      status: 'Completed',
      reference: post.id,
      countryCode: post.countryCode,
      metadata: {
        postId: post.id,
        authorUid: post.authorUid,
        viewsCount: post.viewsCount,
        ratePerViewKes: PPV_RATE_PER_VIEW_KES,
        paidOutKes: payoutKes,
        paidOutUsd: convertKesToUsd(payoutKes),
      },
    });
  }

  postsById.set(post.id, post);
  syncPostToFirestore(post);
  return { settled: true, amountKes: payoutKes };
}

export function processMaturePpvStatuses(): { settledCount: number; settledPostIds: string[] } {
  const nowMs = Date.now();
  const settledPostIds: string[] = [];

  for (const post of postsById.values()) {
    if (post.paidOut) continue;
    const expMs = Date.parse(post.expiresAt);
    if (Number.isFinite(expMs) && nowMs >= expMs) {
      if (post.isSeeded) {
        // Keep seeded starter cards fresh on a rolling 24h window so the platform feed stays vibrant
        post.createdAt = new Date(nowMs - 2 * 60 * 60 * 1000).toISOString();
        post.expiresAt = new Date(nowMs + 22 * 60 * 60 * 1000).toISOString();
        postsById.set(post.id, post);
        settledPostIds.push(post.id);
        continue;
      }
      const result = settleSinglePostInternal(post, false);
      if (result.settled) {
        settledPostIds.push(post.id);
      }
    }
  }

  if (settledPostIds.length > 0) {
    persistPostsToDisk();
  }

  return {
    settledCount: settledPostIds.length,
    settledPostIds,
  };
}

export function recordPpvView(params: {
  postId: string;
  viewerUid: string;
}): {
  post: PpvStatusPost;
  viewCounted: boolean;
  selfView: boolean;
  expired: boolean;
} {
  processMaturePpvStatuses();
  const post = postsById.get(params.postId);
  if (!post) {
    throw new Error('Status post not found.');
  }

  const cleanViewerUid = String(params.viewerUid || '').trim();
  if (!cleanViewerUid) {
    throw new Error('Sign in or register for free to view statuses.');
  }

  if (post.paidOut || Date.now() >= Date.parse(post.expiresAt)) {
    return { post, viewCounted: false, selfView: cleanViewerUid === post.authorUid, expired: true };
  }

  if (cleanViewerUid === post.authorUid) {
    return { post, viewCounted: false, selfView: true, expired: false };
  }

  if (post.viewedByUids.includes(cleanViewerUid)) {
    return { post, viewCounted: false, selfView: false, expired: false };
  }

  const todayKey = getIsoDateKey();
  const nextDaily = { ...(post.dailyViewCounts || {}) };
  nextDaily[todayKey] = (nextDaily[todayKey] || 0) + 1;

  post.viewedByUids = [...post.viewedByUids, cleanViewerUid];
  post.viewsCount += 1;
  post.dailyViewCounts = nextDaily;
  post.pendingEarningsKes = post.viewsCount * PPV_RATE_PER_VIEW_KES;
  postsById.set(post.id, post);
  persistPostsToDisk();
  syncPostToFirestore(post);

  return { post, viewCounted: true, selfView: false, expired: false };
}

export function listPpvFeed(viewerUid?: string | null) {
  processMaturePpvStatuses();
  const allPosts = Array.from(postsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const sanitized = allPosts.map((p) => ({
    ...p,
    hasViewed: Boolean(viewerUid && p.viewedByUids.includes(viewerUid)),
    viewedByUidsCount: p.viewedByUids.length,
  }));

  const activePosts = sanitized.filter((p) => !p.paidOut);
  const settledPosts = sanitized.filter((p) => p.paidOut);
  const totalViews = sanitized.reduce((sum, p) => sum + p.viewsCount, 0);
  const totalPaidOutKes = settledPosts.reduce((sum, p) => sum + p.paidOutKes, 0);

  return {
    ratePerViewKes: PPV_RATE_PER_VIEW_KES,
    durationHours: PPV_STATUS_DURATION_HOURS,
    posts: sanitized,
    summary: {
      totalStatuses: sanitized.length,
      activeCount: activePosts.length,
      settledCount: settledPosts.length,
      totalViews,
      totalPaidOutKes,
      totalPaidOutUsd: convertKesToUsd(totalPaidOutKes),
    },
  };
}

export function deletePpvPost(postId: string, requesterUid: string, isOwner: boolean): boolean {
  const post = postsById.get(postId);
  if (!post) return false;
  if (!isOwner && post.authorUid !== requesterUid) {
    throw new Error('Only the uploader or Platform Owner can remove this status.');
  }
  postsById.delete(postId);
  deletePpvMediaFile(post.mediaUrl);
  persistPostsToDisk();
  if (adminDb && !post.isSeeded) {
    try {
      adminDb.collection(PPV_COLLECTION).doc(postId).delete().catch(() => {});
    } catch {}
  }
  return true;
}

export function ownerForceSettlePpvPost(postId: string): PpvStatusPost {
  const post = postsById.get(postId);
  if (!post) throw new Error('Status post not found.');
  if (post.paidOut) return post;
  settleSinglePostInternal(post, true);
  persistPostsToDisk();
  return post;
}

export function hydratePpvFromClient(posts: PpvStatusPost[]) {
  let dirty = false;
  for (const p of posts) {
    if (!p?.id || p.isSeeded) continue;
    const existing = postsById.get(p.id);
    if (!existing) {
      postsById.set(p.id, p);
      dirty = true;
    } else if (p.viewsCount > existing.viewsCount && !existing.paidOut) {
      existing.viewsCount = p.viewsCount;
      existing.pendingEarningsKes = p.viewsCount * PPV_RATE_PER_VIEW_KES;
      existing.viewedByUids = Array.from(new Set([...(existing.viewedByUids || []), ...(p.viewedByUids || [])]));
      postsById.set(existing.id, existing);
      dirty = true;
    }
  }
  if (dirty) persistPostsToDisk();
  processMaturePpvStatuses();
}
