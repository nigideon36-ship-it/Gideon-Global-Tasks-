import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import { upsertPlatformTransaction } from './transactionsStore.ts';
import {
  isIdentifierOrAccountBanned,
  isProtectedAdminIdentifier,
  normalizeEastAfricaPhone,
  getCustomerByUid,
} from './customerAuth.ts';

export type InvestmentPlanId = 'starter-7d' | 'growth-14d' | 'vip-30d';
export type InvestmentDepositMethod =
  | 'Manual M-PESA 0758727558'
  | 'Paystack M-PESA STK'
  | 'Paystack Card'
  | 'Mobile Money';

export type InvestmentStatus =
  | 'Pending Owner Approval'
  | 'Active'
  | 'Matured & Paid'
  | 'Rejected';

export interface InvestmentPlan {
  id: InvestmentPlanId;
  name: string;
  minKes: number;
  durationDays: number;
  returnPct: number;
  description: string;
}

export const INVESTMENT_PLANS: InvestmentPlan[] = [
  {
    id: 'starter-7d',
    name: '7-Day Seed Yield Pool',
    minKes: 50,
    durationDays: 7,
    returnPct: 12,
    description:
      'Accessible entry pool starting from KES 50+. Backed by micro-task escrow volume with a 7-day cycle.',
  },
  {
    id: 'growth-14d',
    name: '14-Day East Africa Growth',
    minKes: 250,
    durationDays: 14,
    returnPct: 25,
    description:
      'Balanced 2-week enterprise data annotation liquidity pool for deposits of KES 250 and above.',
  },
  {
    id: 'vip-30d',
    name: '30-Day AI Sovereign Vault',
    minKes: 1000,
    durationDays: 30,
    returnPct: 45,
    description:
      'High-yield 30-day enterprise fulfillment pool for deposits starting at KES 1,000+.',
  },
];

export const MIN_INVESTMENT_KES = 50;
export const KES_PER_USD_EST = 130;

export interface CustomerInvestmentRecord {
  id: string;
  transactionId: string;
  userUid: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  countryCode: string;
  planId: InvestmentPlanId;
  planName: string;
  amountKes: number;
  amountUsd: number;
  returnPct: number;
  expectedReturnKes: number;
  expectedReturnUsd: number;
  durationDays: number;
  depositMethod: InvestmentDepositMethod;
  payToNumber?: '0758727558';
  senderPhone?: string;
  paymentReference: string;
  screenshotDataUrl?: string;
  screenshotFileName?: string;
  status: InvestmentStatus;
  ownerNotes?: string;
  payoutReceipt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  maturesAt?: string;
  settledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export class InvestmentValidationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const INVESTMENTS_FILE = path.join(DATA_DIR, 'investments.json');
const FIRESTORE_INVESTMENTS_COLLECTION = 'investments';

const investmentsById = new Map<string, CustomerInvestmentRecord>();

function loadInvestmentsFromDisk() {
  try {
    if (!fs.existsSync(INVESTMENTS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(INVESTMENTS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec && rec.id) {
          investmentsById.set(rec.id, rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load investments store:', (err as Error)?.message || err);
  }
}

function persistInvestmentsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const records = Array.from(investmentsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(INVESTMENTS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist investments store:', (err as Error)?.message || err);
  }
}

function syncInvestmentToFirestore(rec: CustomerInvestmentRecord) {
  if (!adminDb) return;
  try {
    const clean = JSON.parse(
      JSON.stringify({
        ...rec,
        screenshotDataUrl:
          rec.screenshotDataUrl && rec.screenshotDataUrl.length > 750_000
            ? '[STORED_LOCALLY_OVER_750KB]'
            : rec.screenshotDataUrl,
      })
    );
    adminDb
      .collection(FIRESTORE_INVESTMENTS_COLLECTION)
      .doc(rec.id)
      .set(clean, { merge: true })
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

async function hydrateInvestmentsFromFirestore() {
  if (!adminDb) return;
  try {
    const snapshot = await adminDb.collection(FIRESTORE_INVESTMENTS_COLLECTION).get();
    let imported = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CustomerInvestmentRecord | undefined;
      if (data && data.id && !investmentsById.has(data.id)) {
        investmentsById.set(data.id, data);
        imported += 1;
      }
    });
    if (imported > 0) {
      persistInvestmentsToDisk();
    }
  } catch {
    // non-blocking
  }
}

loadInvestmentsFromDisk();
void hydrateInvestmentsFromFirestore();

const ALLOWED_DEPOSIT_METHODS = new Set<InvestmentDepositMethod>([
  'Manual M-PESA 0758727558',
  'Paystack M-PESA STK',
  'Paystack Card',
  'Mobile Money',
]);

export function createInvestmentDeposit(params: {
  userUid: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode?: string;
  planId: string;
  amountKes: number;
  depositMethod: string;
  useWalletBalance?: boolean;
  senderPhone?: string;
  paymentReference: string;
  screenshotDataUrl?: string;
  screenshotFileName?: string;
  verifiedGatewayStatus?: 'Active';
}): CustomerInvestmentRecord {
  const methodRaw = String(params.depositMethod || '').trim();

  if (
    params.useWalletBalance === true ||
    methodRaw.toLowerCase().includes('wallet')
  ) {
    throw new InvestmentValidationError(
      'Investments cannot be funded using your Wallet Balance. You must deposit fresh funds starting from KES 50+ via M-PESA (0758727558), Paystack STK, or Card.',
      400
    );
  }

  const depositMethod = methodRaw as InvestmentDepositMethod;
  if (!ALLOWED_DEPOSIT_METHODS.has(depositMethod)) {
    throw new InvestmentValidationError(
      'Select a valid deposit method (Manual M-PESA 0758727558, Paystack M-PESA STK, Paystack Card, or Mobile Money). Wallet balance is not accepted.',
      400
    );
  }

  const custRec = params.userUid ? getCustomerByUid(params.userUid) : null;
  if (custRec?.deactivated) {
    throw new InvestmentValidationError(
      `Account deactivated: ${custRec.deactivatedReason || 'Contact Support (+254712727558) to reactivate your account.'}`,
      403
    );
  }

  const banCheck = isIdentifierOrAccountBanned({
    uid: params.userUid,
    phone: params.customerPhone || params.senderPhone,
    email: params.customerEmail,
    countryCode: params.countryCode,
  });
  if (banCheck.banned && !isProtectedAdminIdentifier({
    phone: params.customerPhone || params.senderPhone,
    email: params.customerEmail,
    countryCode: params.countryCode,
  })) {
    throw new InvestmentValidationError(
      `Account permanently banned 🚫 forever (no second chance): ${banCheck.reason || 'Policy violation.'}`,
      403
    );
  }

  const plan = INVESTMENT_PLANS.find((p) => p.id === params.planId) || INVESTMENT_PLANS[0];
  const amountKes = Math.round(Number(params.amountKes));
  if (!Number.isFinite(amountKes) || amountKes < MIN_INVESTMENT_KES) {
    throw new InvestmentValidationError(
      `Minimum investment deposit is KES ${MIN_INVESTMENT_KES}. Please enter KES ${MIN_INVESTMENT_KES} or more.`,
      400
    );
  }
  if (amountKes < plan.minKes) {
    throw new InvestmentValidationError(
      `The ${plan.name} requires a minimum deposit of KES ${plan.minKes.toLocaleString()}. Switch to the 7-Day Seed Yield Pool for KES 50+ deposits.`,
      400
    );
  }
  if (amountKes > 5_000_000) {
    throw new InvestmentValidationError('Maximum single deposit limit is KES 5,000,000.', 400);
  }

  const cleanRef = String(params.paymentReference || '').trim().toUpperCase();
  const isManual =
    depositMethod === 'Manual M-PESA 0758727558' || depositMethod === 'Mobile Money';

  if (isManual) {
    if (!/^[A-Z0-9_-]{6,30}$/.test(cleanRef)) {
      throw new InvestmentValidationError(
        'Enter your valid M-PESA / Mobile Money confirmation code (6–30 characters) paid to 0758727558.',
        400
      );
    }
    const cleanScreenshot = String(params.screenshotDataUrl || '').trim();
    if (!cleanScreenshot.startsWith('data:image/') || cleanScreenshot.length < 100) {
      throw new InvestmentValidationError(
        'Upload a clear payment screenshot showing your KES deposit to 0758727558.',
        400
      );
    }

    for (const existing of investmentsById.values()) {
      if (
        existing.paymentReference === cleanRef &&
        existing.status !== 'Rejected'
      ) {
        throw new InvestmentValidationError(
          `M-PESA confirmation code ${cleanRef} has already been submitted for another investment.`,
          409
        );
      }
    }
  } else if (!cleanRef) {
    throw new InvestmentValidationError('Missing verified payment gateway reference.', 400);
  }

  const normalizedSender = params.senderPhone
    ? normalizeEastAfricaPhone(params.senderPhone, params.countryCode || 'KE')
    : custRec?.phone || undefined;

  const amountUsd = +(amountKes / KES_PER_USD_EST).toFixed(2);
  const expectedReturnKes = Math.round(amountKes * (1 + plan.returnPct / 100));
  const expectedReturnUsd = +(expectedReturnKes / KES_PER_USD_EST).toFixed(2);

  const now = new Date();
  const nowIso = now.toISOString();
  const id = `INV-${crypto.randomInt(1000, 9999)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const transactionId = `INVTX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const initialStatus: InvestmentStatus =
    params.verifiedGatewayStatus === 'Active' ? 'Active' : 'Pending Owner Approval';

  const maturesAt =
    initialStatus === 'Active'
      ? new Date(now.getTime() + plan.durationDays * 86400000).toISOString()
      : undefined;

  const record: CustomerInvestmentRecord = {
    id,
    transactionId,
    userUid: String(params.userUid || 'guest').slice(0, 128),
    customerName: String(params.customerName || custRec?.displayName || 'East Africa Investor').slice(0, 120),
    customerPhone: String(normalizedSender || params.customerPhone || 'Not linked').slice(0, 40),
    customerEmail: params.customerEmail ? String(params.customerEmail).slice(0, 160) : custRec?.email,
    countryCode: String(params.countryCode || custRec?.countryCode || 'KE').toUpperCase().slice(0, 4),
    planId: plan.id,
    planName: plan.name,
    amountKes,
    amountUsd,
    returnPct: plan.returnPct,
    expectedReturnKes,
    expectedReturnUsd,
    durationDays: plan.durationDays,
    depositMethod,
    ...(isManual ? { payToNumber: '0758727558' as const } : {}),
    senderPhone: normalizedSender,
    paymentReference: cleanRef,
    screenshotDataUrl: params.screenshotDataUrl ? String(params.screenshotDataUrl) : undefined,
    screenshotFileName: params.screenshotFileName ? String(params.screenshotFileName).slice(0, 140) : undefined,
    status: initialStatus,
    maturesAt,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  investmentsById.set(record.id, record);
  persistInvestmentsToDisk();
  syncInvestmentToFirestore(record);

  upsertPlatformTransaction({
    id: record.transactionId,
    kind: 'investment_deposit',
    title: `Investment Deposit · ${record.planName} (KES ${record.amountKes.toLocaleString()})`,
    customerLabel: `${record.customerName} (${record.customerPhone})`,
    gatewayOrMethod: record.depositMethod,
    currency: 'KES',
    amountLocal: record.amountKes,
    amountUsd: record.amountUsd,
    status: initialStatus === 'Active' ? 'Completed' : 'Pending',
    reference: record.paymentReference,
    countryCode: record.countryCode,
    metadata: {
      investmentId: record.id,
      planId: record.planId,
      expectedReturnKes: record.expectedReturnKes,
      depositOnly: true,
    },
  });

  return record;
}

export function listAllInvestments(): CustomerInvestmentRecord[] {
  return Array.from(investmentsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listCustomerInvestments(userUid?: string, trackedIds?: string[]): CustomerInvestmentRecord[] {
  const idSet = new Set((trackedIds || []).map((id) => String(id).trim()).filter(Boolean));
  return listAllInvestments().filter(
    (inv) =>
      (userUid && userUid !== 'guest' && inv.userUid === userUid) ||
      idSet.has(inv.id)
  );
}

export function getInvestmentById(id: string): CustomerInvestmentRecord | null {
  return investmentsById.get(id) || null;
}

export function approveInvestment(params: {
  id: string;
  ownerEmail: string;
  ownerNotes?: string;
}): CustomerInvestmentRecord {
  const rec = investmentsById.get(params.id);
  if (!rec) throw new Error('Investment deposit record not found.');

  const now = new Date();
  rec.status = 'Active';
  rec.reviewedBy = params.ownerEmail;
  rec.reviewedAt = now.toISOString();
  rec.maturesAt = new Date(now.getTime() + rec.durationDays * 86400000).toISOString();
  rec.ownerNotes =
    String(params.ownerNotes || '').trim().slice(0, 240) ||
    `Deposit KES ${rec.amountKes.toLocaleString()} confirmed (${rec.paymentReference}). Active & earning ${rec.returnPct}% over ${rec.durationDays} days.`;
  rec.updatedAt = now.toISOString();

  investmentsById.set(rec.id, rec);
  persistInvestmentsToDisk();
  syncInvestmentToFirestore(rec);

  upsertPlatformTransaction({
    id: rec.transactionId,
    kind: 'investment_deposit',
    title: `Investment Activated · ${rec.planName} (KES ${rec.amountKes.toLocaleString()})`,
    customerLabel: `${rec.customerName} (${rec.customerPhone})`,
    gatewayOrMethod: rec.depositMethod,
    currency: 'KES',
    amountLocal: rec.amountKes,
    amountUsd: rec.amountUsd,
    status: 'Completed',
    reference: rec.paymentReference,
    countryCode: rec.countryCode,
    metadata: { approvedBy: params.ownerEmail, investmentId: rec.id },
  });

  return rec;
}

export function rejectInvestment(params: {
  id: string;
  ownerEmail: string;
  reason?: string;
}): CustomerInvestmentRecord {
  const rec = investmentsById.get(params.id);
  if (!rec) throw new Error('Investment deposit record not found.');

  const nowIso = new Date().toISOString();
  rec.status = 'Rejected';
  rec.reviewedBy = params.ownerEmail;
  rec.reviewedAt = nowIso;
  rec.ownerNotes =
    String(params.reason || '').trim().slice(0, 240) ||
    'Deposit payment proof could not be verified on 0758727558.';
  rec.updatedAt = nowIso;

  investmentsById.set(rec.id, rec);
  persistInvestmentsToDisk();
  syncInvestmentToFirestore(rec);

  upsertPlatformTransaction({
    id: rec.transactionId,
    kind: 'investment_deposit',
    title: `Investment Rejected · ${rec.planName} (KES ${rec.amountKes.toLocaleString()})`,
    customerLabel: `${rec.customerName} (${rec.customerPhone})`,
    gatewayOrMethod: rec.depositMethod,
    currency: 'KES',
    amountLocal: rec.amountKes,
    amountUsd: rec.amountUsd,
    status: 'Rejected',
    reference: rec.paymentReference,
    countryCode: rec.countryCode,
    metadata: { rejectedBy: params.ownerEmail, reason: rec.ownerNotes },
  });

  return rec;
}

export function settleInvestment(params: {
  id: string;
  ownerEmail: string;
  payoutReceipt?: string;
}): CustomerInvestmentRecord {
  const rec = investmentsById.get(params.id);
  if (!rec) throw new Error('Investment deposit record not found.');

  const nowIso = new Date().toISOString();
  rec.status = 'Matured & Paid';
  rec.reviewedBy = params.ownerEmail;
  rec.settledAt = nowIso;
  rec.payoutReceipt =
    String(params.payoutReceipt || '').trim().slice(0, 120) ||
    `MTR-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  rec.ownerNotes = `Matured return KES ${rec.expectedReturnKes.toLocaleString()} disbursed (${rec.payoutReceipt}).`;
  rec.updatedAt = nowIso;

  investmentsById.set(rec.id, rec);
  persistInvestmentsToDisk();
  syncInvestmentToFirestore(rec);
  return rec;
}

export function ownerUpdateInvestment(params: {
  id: string;
  ownerEmail: string;
  amountKes?: number;
  expectedReturnKes?: number;
  status?: InvestmentStatus;
  ownerNotes?: string;
}): CustomerInvestmentRecord {
  const rec = investmentsById.get(params.id);
  if (!rec) throw new Error('Investment deposit record not found.');

  if (params.amountKes !== undefined) {
    const val = Math.round(Number(params.amountKes));
    if (Number.isFinite(val) && val >= MIN_INVESTMENT_KES) {
      rec.amountKes = val;
      rec.amountUsd = +(val / KES_PER_USD_EST).toFixed(2);
    }
  }
  if (params.expectedReturnKes !== undefined) {
    const val = Math.round(Number(params.expectedReturnKes));
    if (Number.isFinite(val) && val >= rec.amountKes) {
      rec.expectedReturnKes = val;
      rec.expectedReturnUsd = +(val / KES_PER_USD_EST).toFixed(2);
    }
  }
  if (params.status && ['Pending Owner Approval', 'Active', 'Matured & Paid', 'Rejected'].includes(params.status)) {
    rec.status = params.status;
  }
  if (params.ownerNotes !== undefined) {
    rec.ownerNotes = String(params.ownerNotes || '').trim().slice(0, 240) || undefined;
  }
  rec.reviewedBy = params.ownerEmail;
  rec.updatedAt = new Date().toISOString();

  investmentsById.set(rec.id, rec);
  persistInvestmentsToDisk();
  syncInvestmentToFirestore(rec);
  return rec;
}

export function deleteInvestment(id: string): boolean {
  const existed = investmentsById.delete(id);
  if (!existed) return false;
  persistInvestmentsToDisk();
  if (adminDb) {
    try {
      adminDb.collection(FIRESTORE_INVESTMENTS_COLLECTION).doc(id).delete().catch(() => {});
    } catch {
      // non-blocking
    }
  }
  return true;
}
