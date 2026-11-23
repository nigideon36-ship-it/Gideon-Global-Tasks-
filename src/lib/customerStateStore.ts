import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import { getCountryByCode, convertKesToUsd } from './eastAfrica.ts';
import type { PayoutRecord, ReferralRecord, ReferralStats, TaskHistoryRecord } from '../types/tasks.ts';
import { CANONICAL_PLATFORM_ORIGIN, normalizePlatformUrl } from '../utils/platformUrl.ts';

export interface PersistedUserStats {
  balance: number;
  pendingBalance: number;
  lifetimeEarned: number;
  completedTasksCount: number;
  qualityScore: number;
  streakDays: number;
  lastLoginDate: string;
  streakBonusMultiplier: number;
  sevenDayBonusAwarded: boolean;
  tier: 'Diamond' | 'Gold' | 'Silver' | 'Bronze';
  completedTaskIds: string[];
  payoutHistory: PayoutRecord[];
}

export interface PersistedDailyUsage {
  dateKey: string;
  completedTodayCount: number;
  surveysCompletedTodayCount: number;
  earnedTodayUsd: number;
}

export interface PersistedCustomerState {
  uid: string;
  userStats: PersistedUserStats;
  taskHistory: TaskHistoryRecord[];
  referralHistory: ReferralRecord[];
  referralStats: ReferralStats;
  dailyUsage: PersistedDailyUsage;
  activePackageId: string | null;
  vipReferralCount: number;
  referredByUid?: string;
  referredByCode?: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATES_FILE = path.join(DATA_DIR, 'customer-states.json');
const VIP_REFUNDS_FILE = path.join(DATA_DIR, 'vip-bonus-refunds.json');
const PPV_PAYOUTS_FILE = path.join(DATA_DIR, 'ppv-payouts.json');
const FIRESTORE_STATES_COLLECTION = 'customer_states';

const statesByUid = new Map<string, PersistedCustomerState>();
const uidByReferralCode = new Map<string, string>();
const creditedReferralPassOrders = new Set<string>();
const creditedVipRefundKeys = new Set<string>();
const creditedPpvPayoutKeys = new Set<string>();

function createDefaultReferralCode(uid: string): string {
  const shortSuffix = uid.replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase() || 'USER';
  return `GIDEON-EA-${shortSuffix}`;
}

function createDefaultUserStats(): PersistedUserStats {
  return {
    balance: 0,
    pendingBalance: 0,
    lifetimeEarned: 0,
    completedTasksCount: 0,
    qualityScore: 100,
    streakDays: 0,
    lastLoginDate: '',
    streakBonusMultiplier: 1.0,
    sevenDayBonusAwarded: false,
    tier: 'Bronze',
    completedTaskIds: [],
    payoutHistory: [],
  };
}

function createDefaultReferralStats(uid: string): ReferralStats {
  const code = createDefaultReferralCode(uid);
  return {
    referralCode: code,
    referralLink: `${CANONICAL_PLATFORM_ORIGIN}/?ref=${code}`,
    totalClicks: 0,
    totalSignups: 0,
    passesPurchasedCount: 0,
    totalCommissionEarned: 0,
    pendingCommission: 0,
    commissionPercentage: 20,
    vipTierBonusPercent: 5,
    vipReferralCount: 0,
  };
}

function highestPackageId(a?: string | null, _b?: string | null): string | null {
  return a || null;
}

function indexState(state: PersistedCustomerState) {
  statesByUid.set(state.uid, state);
  const code = state.referralStats?.referralCode?.trim().toUpperCase();
  if (code) {
    uidByReferralCode.set(code, state.uid);
  }
}

function loadStatesFromDisk() {
  try {
    if (!fs.existsSync(STATES_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATES_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec && rec.uid) {
          if (rec.referralStats?.referralLink) {
            rec.referralStats.referralLink = normalizePlatformUrl(rec.referralStats.referralLink);
          }
          indexState(rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load customer states store:', (err as Error)?.message || err);
  }
}

function persistStatesToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(statesByUid.values());
    fs.writeFileSync(STATES_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist customer states store:', (err as Error)?.message || err);
  }
}

function syncStateToFirestore(state: PersistedCustomerState) {
  if (!adminDb) return;
  try {
    adminDb
      .collection(FIRESTORE_STATES_COLLECTION)
      .doc(state.uid)
      .set(JSON.parse(JSON.stringify(state)), { merge: true })
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

export async function hydrateCustomerStatesFromFirestore(): Promise<void> {
  if (!adminDb) return;
  try {
    const snap = await adminDb.collection(FIRESTORE_STATES_COLLECTION).get();
    let changed = false;
    snap.forEach((docSnap) => {
      const remote = docSnap.data() as PersistedCustomerState | undefined;
      if (!remote || !remote.uid) return;
      if (remote.referralStats?.referralLink) {
        remote.referralStats.referralLink = normalizePlatformUrl(remote.referralStats.referralLink);
      }
      const existing = statesByUid.get(remote.uid);
      if (!existing) {
        indexState(remote);
        changed = true;
      } else {
        const merged = mergeCustomerStates(existing, remote, { preserveExistingBalanceIfIncomingEmpty: true });
        indexState(merged);
        changed = true;
      }
    });
    if (changed) persistStatesToDisk();
  } catch {
    // non-blocking
  }
}

function loadVipRefundsFromDisk() {
  try {
    if (!fs.existsSync(VIP_REFUNDS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(VIP_REFUNDS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const key of raw) {
        if (typeof key === 'string' && key.trim()) {
          creditedVipRefundKeys.add(key.trim());
        }
      }
    }
  } catch (err) {
    console.warn('Could not load VIP bonus refunds store:', (err as Error)?.message || err);
  }
}

function persistVipRefundsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(VIP_REFUNDS_FILE, JSON.stringify(Array.from(creditedVipRefundKeys), null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist VIP bonus refunds store:', (err as Error)?.message || err);
  }
}

function loadPpvPayoutsFromDisk() {
  try {
    if (!fs.existsSync(PPV_PAYOUTS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(PPV_PAYOUTS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const key of raw) {
        if (typeof key === 'string' && key.trim()) {
          creditedPpvPayoutKeys.add(key.trim());
        }
      }
    }
  } catch (err) {
    console.warn('Could not load PPV payouts store:', (err as Error)?.message || err);
  }
}

function persistPpvPayoutsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(PPV_PAYOUTS_FILE, JSON.stringify(Array.from(creditedPpvPayoutKeys), null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist PPV payouts store:', (err as Error)?.message || err);
  }
}

loadStatesFromDisk();
loadVipRefundsFromDisk();
loadPpvPayoutsFromDisk();

function dedupePayouts(existing: PayoutRecord[] = [], incoming: PayoutRecord[] = []): PayoutRecord[] {
  const byId = new Map<string, PayoutRecord>();
  const statusRank = (s?: string) => (s === 'Completed' ? 3 : s === 'Rejected' ? 2 : 1);

  for (const item of [...existing, ...incoming]) {
    if (!item || !item.id) continue;
    const prev = byId.get(item.id);
    if (!prev || statusRank(item.status) >= statusRank(prev.status)) {
      byId.set(item.id, item);
    }
  }
  return Array.from(byId.values());
}

function dedupeTasks(existing: TaskHistoryRecord[] = [], incoming: TaskHistoryRecord[] = []): TaskHistoryRecord[] {
  const byKey = new Map<string, TaskHistoryRecord>();
  for (const t of [...existing, ...incoming]) {
    if (!t || !t.taskId) continue;
    const safeReward = Math.max(0, Number(t.reward) || 0);
    const key = t.id || `${t.taskId}::${t.completedAt}`;
    if (!byKey.has(key)) {
      byKey.set(key, { ...t, reward: +safeReward.toFixed(4) });
    }
  }
  return Array.from(byKey.values());
}

function dedupeReferrals(existing: ReferralRecord[] = [], incoming: ReferralRecord[] = []): ReferralRecord[] {
  const byId = new Map<string, ReferralRecord>();
  for (const r of [...existing, ...incoming]) {
    if (!r || !r.id) continue;
    const prev = byId.get(r.id);
    if (!prev || (Number(r.commissionEarned) || 0) >= (Number(prev.commissionEarned) || 0)) {
      byId.set(r.id, r);
    }
  }
  return Array.from(byId.values());
}

export function mergeCustomerStates(
  existing: PersistedCustomerState | null | undefined,
  incoming: Partial<PersistedCustomerState>,
  options?: { preserveExistingBalanceIfIncomingEmpty?: boolean }
): PersistedCustomerState {
  const uid = String(incoming.uid || existing?.uid || '').trim();
  const baseStats = existing?.userStats || createDefaultUserStats();
  const incStats = (incoming.userStats || {}) as Partial<PersistedUserStats>;
  const baseRef = existing?.referralStats || createDefaultReferralStats(uid);
  const incRef = (incoming.referralStats || {}) as Partial<ReferralStats>;

  const mergedCompletedTaskIds = Array.from(
    new Set([...(baseStats.completedTaskIds || []), ...(incStats.completedTaskIds || [])].filter(Boolean))
  );

  const mergedTaskHistory = dedupeTasks(existing?.taskHistory, incoming.taskHistory);
  const mergedReferralHistory = dedupeReferrals(existing?.referralHistory, incoming.referralHistory);
  const mergedPayoutHistory = dedupePayouts(baseStats.payoutHistory, incStats.payoutHistory);

  const incomingLooksUninitialized =
    (Number(incStats.balance) || 0) === 0 &&
    (Number(incStats.lifetimeEarned) || 0) === 0 &&
    mergedCompletedTaskIds.length === (baseStats.completedTaskIds?.length || 0) &&
    (incoming.taskHistory?.length || 0) === 0;

  let mergedBalance = Number(baseStats.balance) || 0;
  const incomingBal = Number(incStats.balance);
  if (Number.isFinite(incomingBal) && incomingBal >= 0) {
    if (!existing) {
      mergedBalance = incomingBal;
    } else if (options?.preserveExistingBalanceIfIncomingEmpty && incomingLooksUninitialized) {
      mergedBalance = Math.max(mergedBalance, incomingBal);
    } else {
      const basePayoutTotal = (baseStats.payoutHistory || [])
        .filter((p) => p.status !== 'Rejected')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      const incPayoutTotal = (incStats.payoutHistory || [])
        .filter((p) => p.status !== 'Rejected')
        .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
      if (basePayoutTotal === incPayoutTotal) {
        mergedBalance = Math.max(mergedBalance, incomingBal);
      } else {
        mergedBalance = Math.max(0, Number.isFinite(incomingBal) ? incomingBal : mergedBalance);
      }
    }
  }

  const vipFromHistory = mergedReferralHistory.filter(
    (r) =>
      r.packageId === 'vip' ||
      String(r.passPurchased || '').toLowerCase().includes('vip')
  ).length;

  const mergedVipReferralCount = Math.max(
    Number(existing?.vipReferralCount) || 0,
    Number(incoming.vipReferralCount) || 0,
    Number(baseRef.vipReferralCount) || 0,
    Number(incRef.vipReferralCount) || 0,
    vipFromHistory
  );

  const mergedLifetime = Math.max(
    Number(baseStats.lifetimeEarned) || 0,
    Number(incStats.lifetimeEarned) || 0,
    mergedBalance
  );

  const mergedCompletedCount = Math.max(
    Number(baseStats.completedTasksCount) || 0,
    Number(incStats.completedTasksCount) || 0,
    mergedCompletedTaskIds.length,
    mergedTaskHistory.length
  );

  const mergedStreakDays = Math.max(
    Number(baseStats.streakDays) || 0,
    Number(incStats.streakDays) || 0
  );

  const resolvedReferralCode = (
    incRef.referralCode ||
    baseRef.referralCode ||
    createDefaultReferralCode(uid)
  )
    .trim()
    .toUpperCase();

  const mergedReferralStats: ReferralStats = {
    referralCode: resolvedReferralCode,
    referralLink: normalizePlatformUrl(
      incRef.referralLink || baseRef.referralLink || `${CANONICAL_PLATFORM_ORIGIN}/?ref=${resolvedReferralCode}`
    ),
    totalClicks: Math.max(baseRef.totalClicks || 0, incRef.totalClicks || 0),
    totalSignups: Math.max(
      baseRef.totalSignups || 0,
      incRef.totalSignups || 0,
      mergedReferralHistory.length
    ),
    passesPurchasedCount: Math.max(
      baseRef.passesPurchasedCount || 0,
      incRef.passesPurchasedCount || 0,
      mergedReferralHistory.filter((r) => r.status === 'Credited').length
    ),
    totalCommissionEarned: +Math.max(
      baseRef.totalCommissionEarned || 0,
      incRef.totalCommissionEarned || 0
    ).toFixed(4),
    pendingCommission: +Math.max(baseRef.pendingCommission || 0, incRef.pendingCommission || 0).toFixed(4),
    commissionPercentage: baseRef.commissionPercentage || incRef.commissionPercentage || 20,
    vipTierBonusPercent: baseRef.vipTierBonusPercent || incRef.vipTierBonusPercent || 5,
    vipReferralCount: mergedVipReferralCount,
  };

  const exDaily = existing?.dailyUsage;
  const incDaily = incoming.dailyUsage;
  let mergedDailyUsage: PersistedDailyUsage = {
    dateKey: incDaily?.dateKey || exDaily?.dateKey || new Date().toISOString().slice(0, 10),
    completedTodayCount: incDaily?.completedTodayCount || 0,
    surveysCompletedTodayCount: incDaily?.surveysCompletedTodayCount || 0,
    earnedTodayUsd: incDaily?.earnedTodayUsd || 0,
  };
  if (exDaily && incDaily && exDaily.dateKey === incDaily.dateKey) {
    mergedDailyUsage = {
      dateKey: exDaily.dateKey,
      completedTodayCount: Math.max(exDaily.completedTodayCount || 0, incDaily.completedTodayCount || 0),
      surveysCompletedTodayCount: Math.max(exDaily.surveysCompletedTodayCount || 0, incDaily.surveysCompletedTodayCount || 0),
      earnedTodayUsd: +Math.max(exDaily.earnedTodayUsd || 0, incDaily.earnedTodayUsd || 0).toFixed(4),
    };
  } else if (exDaily && (!incDaily || exDaily.dateKey > incDaily.dateKey)) {
    mergedDailyUsage = exDaily;
  }

  const mergedState: PersistedCustomerState = {
    uid,
    userStats: {
      balance: +mergedBalance.toFixed(4),
      pendingBalance: +(Number(incStats.pendingBalance ?? baseStats.pendingBalance) || 0).toFixed(4),
      lifetimeEarned: +mergedLifetime.toFixed(4),
      completedTasksCount: mergedCompletedCount,
      qualityScore: Number(incStats.qualityScore || baseStats.qualityScore || 100),
      streakDays: mergedStreakDays,
      lastLoginDate: incStats.lastLoginDate || baseStats.lastLoginDate || '',
      streakBonusMultiplier: Math.max(Number(baseStats.streakBonusMultiplier) || 1, Number(incStats.streakBonusMultiplier) || 1),
      sevenDayBonusAwarded: Boolean(baseStats.sevenDayBonusAwarded || incStats.sevenDayBonusAwarded),
      tier: incStats.tier || baseStats.tier || 'Bronze',
      completedTaskIds: mergedCompletedTaskIds,
      payoutHistory: mergedPayoutHistory,
    },
    taskHistory: mergedTaskHistory,
    referralHistory: mergedReferralHistory,
    referralStats: mergedReferralStats,
    dailyUsage: mergedDailyUsage,
    activePackageId: highestPackageId(existing?.activePackageId, incoming.activePackageId),
    vipReferralCount: mergedVipReferralCount,
    referredByUid: existing?.referredByUid || incoming.referredByUid,
    referredByCode: existing?.referredByCode || incoming.referredByCode,
    updatedAt: new Date().toISOString(),
  };

  return mergedState;
}

export function getOrCreateCustomerState(uid: string): PersistedCustomerState {
  const cleanUid = String(uid || '').trim();
  const existing = statesByUid.get(cleanUid);
  if (existing) return existing;

  const created: PersistedCustomerState = {
    uid: cleanUid,
    userStats: createDefaultUserStats(),
    taskHistory: [],
    referralHistory: [],
    referralStats: createDefaultReferralStats(cleanUid),
    dailyUsage: {
      dateKey: new Date().toISOString().slice(0, 10),
      completedTodayCount: 0,
      surveysCompletedTodayCount: 0,
      earnedTodayUsd: 0,
    },
    activePackageId: null,
    vipReferralCount: 0,
    updatedAt: new Date().toISOString(),
  };

  indexState(created);
  persistStatesToDisk();
  syncStateToFirestore(created);
  return created;
}

export function saveMergedCustomerState(uid: string, incoming: Partial<PersistedCustomerState>): PersistedCustomerState {
  const existing = statesByUid.get(uid);
  const merged = mergeCustomerStates(existing, { ...incoming, uid }, { preserveExistingBalanceIfIncomingEmpty: true });
  indexState(merged);
  persistStatesToDisk();
  syncStateToFirestore(merged);
  return merged;
}

export function setCustomerApprovedPackage(uid: string, _packageId: string | null): PersistedCustomerState {
  return getOrCreateCustomerState(uid);
}

export function creditCustomerBalanceServer(uid: string, amountUsd: number): PersistedCustomerState {
  const state = getOrCreateCustomerState(uid);
  const safeAmt = Math.max(0, Number(amountUsd) || 0);
  state.userStats.balance = +(state.userStats.balance + safeAmt).toFixed(4);
  state.userStats.lifetimeEarned = +(Math.max(state.userStats.lifetimeEarned, state.userStats.balance)).toFixed(4);
  state.updatedAt = new Date().toISOString();
  indexState(state);
  persistStatesToDisk();
  syncStateToFirestore(state);
  return state;
}

export function creditPpvEarningsToWallet(params: {
  uid: string;
  postId: string;
  viewsCount: number;
  amountKes: number;
  caption?: string;
}): { credited: boolean; alreadyCredited: boolean; amountUsd: number; amountKes: number; newBalanceUsd: number } {
  const cleanUid = String(params.uid || '').trim();
  const cleanPostId = String(params.postId || '').trim();
  const safeKes = Math.max(0, Math.round(Number(params.amountKes) || 0));
  const amountUsd = convertKesToUsd(safeKes);

  if (!cleanUid || cleanUid === 'guest' || cleanUid.startsWith('seed-') || !cleanPostId || safeKes <= 0) {
    return {
      credited: false,
      alreadyCredited: false,
      amountUsd,
      amountKes: safeKes,
      newBalanceUsd: 0,
    };
  }

  const key = `PPV:${cleanPostId}`;
  const state = getOrCreateCustomerState(cleanUid);

  if (creditedPpvPayoutKeys.has(key)) {
    return {
      credited: false,
      alreadyCredited: true,
      amountUsd,
      amountKes: safeKes,
      newBalanceUsd: state.userStats.balance,
    };
  }

  creditedPpvPayoutKeys.add(key);
  persistPpvPayoutsToDisk();

  state.userStats.balance = +(state.userStats.balance + amountUsd).toFixed(4);
  state.userStats.lifetimeEarned = +(state.userStats.lifetimeEarned + amountUsd).toFixed(4);
  state.updatedAt = new Date().toISOString();
  indexState(state);
  persistStatesToDisk();
  syncStateToFirestore(state);

  return {
    credited: true,
    alreadyCredited: false,
    amountUsd,
    amountKes: safeKes,
    newBalanceUsd: state.userStats.balance,
  };
}

export function recordServerWithdrawalDebit(uid: string, payout: PayoutRecord): PersistedCustomerState {
  const state = getOrCreateCustomerState(uid);
  const exists = state.userStats.payoutHistory.some((p) => p.id === payout.id);
  if (!exists) {
    state.userStats.balance = +Math.max(0, state.userStats.balance - payout.amount).toFixed(4);
    state.userStats.payoutHistory = [payout, ...state.userStats.payoutHistory];
  }
  state.updatedAt = new Date().toISOString();
  indexState(state);
  persistStatesToDisk();
  syncStateToFirestore(state);
  return state;
}

export function syncServerWithdrawalDecision(
  uid: string,
  withdrawalId: string,
  status: 'Completed' | 'Rejected',
  amountUsd: number,
  mpesaReceipt?: string
): void {
  const state = statesByUid.get(uid);
  if (!state) return;
  const idx = state.userStats.payoutHistory.findIndex((p) => p.id === withdrawalId);
  if (idx !== -1) {
    const prevStatus = state.userStats.payoutHistory[idx].status;
    state.userStats.payoutHistory[idx] = {
      ...state.userStats.payoutHistory[idx],
      status,
      ...(mpesaReceipt ? { mpesaReceipt } : {}),
    };
    if (status === 'Rejected' && prevStatus !== 'Rejected') {
      state.userStats.balance = +(state.userStats.balance + amountUsd).toFixed(4);
    }
  }
  state.updatedAt = new Date().toISOString();
  indexState(state);
  persistStatesToDisk();
  syncStateToFirestore(state);
}

export function registerReferralAttribution(params: {
  newUserUid: string;
  newUserName?: string;
  countryCode?: string;
  referredByCode?: string;
}): { referrerUid?: string } {
  const cleanCode = String(params.referredByCode || '').trim().toUpperCase();
  if (!cleanCode) return {};
  const referrerUid = uidByReferralCode.get(cleanCode);
  if (!referrerUid || referrerUid === params.newUserUid) return {};

  const newState = getOrCreateCustomerState(params.newUserUid);
  if (!newState.referredByUid) {
    newState.referredByUid = referrerUid;
    newState.referredByCode = cleanCode;
    newState.updatedAt = new Date().toISOString();
    indexState(newState);
  }

  const referrerState = getOrCreateCustomerState(referrerUid);
  const alreadyListed = referrerState.referralHistory.some((r) => r.referredUserUid === params.newUserUid);
  if (!alreadyListed) {
    const country = getCountryByCode(params.countryCode || 'KE');
    referrerState.referralStats.totalSignups += 1;
    referrerState.referralHistory = [
      {
        id: `ref-${params.newUserUid.slice(-8)}`,
        referredUserUid: params.newUserUid,
        refereeName: params.newUserName || 'New Contributor',
        refereeEmailMasked: 'verified-member',
        refereeCountry: country.name,
        dateJoined: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        passPurchased: 'Joined Free Access',
        passPrice: 0,
        commissionRate: 0.2,
        commissionEarned: 0,
        paymentMethod: 'PayPal',
        status: 'Credited',
        transactionId: `SIGNUP-${params.newUserUid.slice(-6).toUpperCase()}`,
      },
      ...referrerState.referralHistory,
    ];
    referrerState.updatedAt = new Date().toISOString();
    indexState(referrerState);
    syncStateToFirestore(referrerState);
  }

  persistStatesToDisk();
  syncStateToFirestore(newState);
  return { referrerUid };
}

export function creditReferrerOnPassApproval(_params: {
  buyerUid: string;
  buyerName?: string;
  buyerCountryCode?: string;
  packageId?: string;
  packageName?: string;
  amountKes?: number;
  orderId: string;
}): { creditedReferrerUid?: string; vipUnlocked?: boolean } {
  return {};
}

export function ownerUpdateCustomerStateSupport(params: {
  uid: string;
  balanceDeltaUsd?: number;
  setBalanceUsd?: number;
  setVipReferralCount?: number;
}): PersistedCustomerState {
  const state = getOrCreateCustomerState(params.uid);
  if (typeof params.setBalanceUsd === 'number' && Number.isFinite(params.setBalanceUsd) && params.setBalanceUsd >= 0) {
    state.userStats.balance = +params.setBalanceUsd.toFixed(4);
    state.userStats.lifetimeEarned = Math.max(state.userStats.lifetimeEarned, state.userStats.balance);
  } else if (typeof params.balanceDeltaUsd === 'number' && Number.isFinite(params.balanceDeltaUsd)) {
    state.userStats.balance = +Math.max(0, state.userStats.balance + params.balanceDeltaUsd).toFixed(4);
    if (params.balanceDeltaUsd > 0) {
      state.userStats.lifetimeEarned = +(state.userStats.lifetimeEarned + params.balanceDeltaUsd).toFixed(4);
    }
  }
  if (typeof params.setVipReferralCount === 'number' && Number.isFinite(params.setVipReferralCount) && params.setVipReferralCount >= 0) {
    state.vipReferralCount = Math.floor(params.setVipReferralCount);
    state.referralStats.vipReferralCount = state.vipReferralCount;
  }
  state.updatedAt = new Date().toISOString();
  indexState(state);
  persistStatesToDisk();
  syncStateToFirestore(state);
  return state;
}

export function getCustomerStateSnapshot(uid: string): PersistedCustomerState | null {
  return statesByUid.get(uid) || null;
}

export function listAllCustomerStatesSummary(): Record<
  string,
  {
    balanceUsd: number;
    lifetimeEarnedUsd: number;
    completedTasksCount: number;
    vipReferralCount: number;
    referredByCode?: string;
    activePackageId: string | null;
  }
> {
  const out: Record<string, any> = {};
  for (const s of statesByUid.values()) {
    out[s.uid] = {
      balanceUsd: s.userStats.balance,
      lifetimeEarnedUsd: s.userStats.lifetimeEarned,
      completedTasksCount: s.userStats.completedTasksCount,
      vipReferralCount: s.vipReferralCount || 0,
      referredByCode: s.referredByCode,
      activePackageId: s.activePackageId,
    };
  }
  return out;
}
