import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import { upsertPlatformTransaction } from './transactionsStore.ts';
import {
  banCustomerPermanently,
  unbanCustomerByOwner,
  isProtectedAdminIdentifier,
  isIdentifierOrAccountBanned,
  normalizeEastAfricaPhone,
} from './customerAuth.ts';

export type WorkerPassTierId = 'starter' | 'pro' | 'vip';
export type PassProofStatus = 'Pending' | 'Approved' | 'Rejected' | 'Banned';

export interface WorkerPassProofRecord {
  id: string;
  transactionId: string;
  userUid: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  countryCode: string;
  packageId: WorkerPassTierId;
  packageName: string;
  amountKes: number;
  amountUsd: number;
  payToNumber: '0758727558';
  senderPhone: string;
  mpesaCode: string;
  screenshotDataUrl: string;
  screenshotFileName?: string;
  status: PassProofStatus;
  ownerApprovalDetails?: string;
  rejectionOrBanReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

const PACKAGE_CATALOG: Record<
  WorkerPassTierId,
  { name: string; amountKes: number; amountUsd: number }
> = {
  starter: { name: 'Starter Tasker', amountKes: 50, amountUsd: 0.38 },
  pro: { name: 'Pro Contributor', amountKes: 100, amountUsd: 0.77 },
  vip: { name: 'VIP Taskmaster', amountKes: 200, amountUsd: 1.54 },
};

const DATA_DIR = path.resolve(process.cwd(), '.data');
const PROOFS_FILE = path.join(DATA_DIR, 'pass-proofs.json');
const FIRESTORE_PROOFS_COLLECTION = 'pass_proofs';

const proofsById = new Map<string, WorkerPassProofRecord>();

function loadProofsFromDisk() {
  try {
    if (!fs.existsSync(PROOFS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(PROOFS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec && rec.id) {
          proofsById.set(rec.id, rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load pass proofs store:', (err as Error)?.message || err);
  }
}

function persistProofsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const records = Array.from(proofsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(PROOFS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist pass proofs store:', (err as Error)?.message || err);
  }
}

function syncProofToFirestore(rec: WorkerPassProofRecord) {
  if (!adminDb) return;
  try {
    // Keep lightweight metadata in Firestore so large screenshots never breach 1MB doc limit
    const sanitized = JSON.parse(
      JSON.stringify({
        ...rec,
        screenshotDataUrl:
          rec.screenshotDataUrl.length > 750_000
            ? '[STORED_LOCALLY_OVER_750KB]'
            : rec.screenshotDataUrl,
      })
    );
    adminDb
      .collection(FIRESTORE_PROOFS_COLLECTION)
      .doc(rec.id)
      .set(sanitized, { merge: true })
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

function restoreProtectedAdminPassProofs(): boolean {
  let changed = false;
  for (const rec of proofsById.values()) {
    if (
      rec.status === 'Banned' &&
      isProtectedAdminIdentifier({
        phone: rec.customerPhone,
        senderPhone: rec.senderPhone,
        email: rec.customerEmail,
        countryCode: rec.countryCode,
      })
    ) {
      rec.status = 'Rejected';
      rec.rejectionOrBanReason = 'Protected Platform Owner / Admin account auto-restored.';
      rec.updatedAt = new Date().toISOString();
      syncProofToFirestore(rec);
      changed = true;
    }
  }
  if (changed) {
    persistProofsToDisk();
  }
  return changed;
}

async function hydrateProofsFromFirestore() {
  if (!adminDb) return;
  try {
    const snapshot = await adminDb.collection(FIRESTORE_PROOFS_COLLECTION).get();
    let imported = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as WorkerPassProofRecord | undefined;
      if (!data || !data.id) return;
      if (
        data.status === 'Banned' &&
        isProtectedAdminIdentifier({
          phone: data.customerPhone,
          senderPhone: data.senderPhone,
          email: data.customerEmail,
          countryCode: data.countryCode,
        })
      ) {
        data.status = 'Rejected';
        data.rejectionOrBanReason = 'Protected Platform Owner / Admin account auto-restored.';
        data.updatedAt = new Date().toISOString();
        syncProofToFirestore(data);
        proofsById.set(data.id, data);
        imported += 1;
        return;
      }
      if (!proofsById.has(data.id)) {
        proofsById.set(data.id, data);
        imported += 1;
      }
    });
    if (imported > 0) {
      persistProofsToDisk();
    }
    restoreProtectedAdminPassProofs();
  } catch {
    // non-blocking
  }
}

loadProofsFromDisk();
restoreProtectedAdminPassProofs();
void hydrateProofsFromFirestore();

export class PassProofForbiddenError extends Error {
  statusCode = 403;
}

export function submitWorkerPassProof(params: {
  userUid: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode?: string;
  packageId: string;
  senderPhone: string;
  mpesaCode: string;
  screenshotDataUrl: string;
  screenshotFileName?: string;
}): WorkerPassProofRecord {
  const pkgId = String(params.packageId || '').toLowerCase() as WorkerPassTierId;
  const catalogPkg = PACKAGE_CATALOG[pkgId];
  if (!catalogPkg) {
    throw new Error('Select a valid Worker Pass tier (Starter KES 50, Pro KES 100, or VIP KES 200).');
  }

  const normalizedSenderPhone = normalizeEastAfricaPhone(params.senderPhone, params.countryCode);
  const banCheck = isIdentifierOrAccountBanned({
    uid: params.userUid,
    phone: params.customerPhone || normalizedSenderPhone,
    email: params.customerEmail,
    countryCode: params.countryCode,
  });
  if (banCheck.banned) {
    throw new PassProofForbiddenError(
      `Account permanently banned 🚫 forever (no second chance): ${banCheck.reason || 'Policy violation.'}`
    );
  }

  const senderBanCheck = normalizedSenderPhone
    ? isIdentifierOrAccountBanned({ phone: normalizedSenderPhone, countryCode: params.countryCode })
    : { banned: false };
  if (senderBanCheck.banned) {
    throw new PassProofForbiddenError(
      `This phone number is permanently banned 🚫 forever (no second chance): ${senderBanCheck.reason || 'Policy violation.'}`
    );
  }

  const cleanCode = String(params.mpesaCode || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(cleanCode)) {
    throw new Error(
      'M-PESA confirmation code MUST be submitted (6–20 letters/numbers). Failure to submit genuine proof leads to a permanent ban 🚫 forever.'
    );
  }

  const cleanScreenshot = String(params.screenshotDataUrl || '').trim();
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/i.test(cleanScreenshot)) {
    throw new Error(
      'M-PESA payment screenshot proof MUST be uploaded (PNG, JPG, or WEBP). Failure to submit screenshot proof will result in a permanent ban 🚫 forever with no second chance.'
    );
  }
  if (cleanScreenshot.length > 2_200_000) {
    throw new Error('Screenshot file is too large. Please upload a screenshot under 1.5 MB.');
  }

  // Prevent reusing the exact same M-PESA confirmation code by another submission
  for (const existing of proofsById.values()) {
    if (existing.mpesaCode === cleanCode && existing.status !== 'Rejected') {
      throw new Error(
        `M-PESA code ${cleanCode} has already been submitted. Duplicate or fake proof attempts risk a permanent ban 🚫 forever.`
      );
    }
  }

  const now = new Date().toISOString();
  const id = `PASSPRF-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const txnId = `PASS-${id}`;

  const record: WorkerPassProofRecord = {
    id,
    transactionId: txnId,
    userUid: String(params.userUid || 'guest').slice(0, 128),
    customerName: String(params.customerName || 'East Africa Contributor').trim().slice(0, 120),
    customerPhone: String(params.customerPhone || normalizedSenderPhone || params.senderPhone).trim().slice(0, 40),
    customerEmail: params.customerEmail ? String(params.customerEmail).trim().toLowerCase().slice(0, 160) : undefined,
    countryCode: String(params.countryCode || 'KE').toUpperCase().slice(0, 4),
    packageId: pkgId,
    packageName: catalogPkg.name,
    amountKes: catalogPkg.amountKes,
    amountUsd: catalogPkg.amountUsd,
    payToNumber: '0758727558',
    senderPhone: normalizedSenderPhone || String(params.senderPhone || '').trim().slice(0, 40),
    mpesaCode: cleanCode,
    screenshotDataUrl: cleanScreenshot,
    screenshotFileName: params.screenshotFileName ? String(params.screenshotFileName).slice(0, 120) : undefined,
    status: 'Pending',
    createdAt: now,
    updatedAt: now,
  };

  proofsById.set(record.id, record);
  persistProofsToDisk();
  syncProofToFirestore(record);

  upsertPlatformTransaction({
    id: txnId,
    kind: 'pass_purchase',
    title: `${catalogPkg.name} (KES ${catalogPkg.amountKes}) · Paid to 0758727558`,
    customerLabel: `${record.customerName} (${record.senderPhone})`,
    gatewayOrMethod: 'Manual M-PESA 0758727558',
    currency: 'KES',
    amountLocal: catalogPkg.amountKes,
    amountUsd: catalogPkg.amountUsd,
    status: 'Pending',
    reference: cleanCode,
    countryCode: record.countryCode,
    metadata: {
      proofId: record.id,
      packageId: pkgId,
      payToNumber: '0758727558',
      hasScreenshot: true,
    },
  });

  return record;
}

export function listAllPassProofs(): WorkerPassProofRecord[] {
  return Array.from(proofsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listCustomerPassProofs(
  userUid?: string,
  trackedIds: string[] = []
): WorkerPassProofRecord[] {
  const trackedSet = new Set(trackedIds.map((id) => String(id).trim()).filter(Boolean));
  return listAllPassProofs().filter(
    (p) => (userUid && userUid !== 'guest' && p.userUid === userUid) || trackedSet.has(p.id)
  );
}

export function approvePassProof(params: {
  id: string;
  ownerEmail: string;
  approvalDetails?: string;
}): WorkerPassProofRecord {
  const rec = proofsById.get(params.id);
  if (!rec) {
    throw new Error('Worker Pass proof submission not found.');
  }
  if (rec.status === 'Banned') {
    throw new Error('Permanently banned accounts cannot be approved.');
  }

  const now = new Date().toISOString();
  rec.status = 'Approved';
  rec.reviewedBy = params.ownerEmail;
  rec.reviewedAt = now;
  rec.ownerApprovalDetails =
    String(params.approvalDetails || '').trim().slice(0, 300) ||
    `Payment verified on M-PESA 0758727558 (Ref: ${rec.mpesaCode}). ${rec.packageName} Pass (KES ${rec.amountKes}) unlocked by Owner.`;
  rec.updatedAt = now;

  proofsById.set(rec.id, rec);
  persistProofsToDisk();
  syncProofToFirestore(rec);

  upsertPlatformTransaction({
    id: rec.transactionId,
    kind: 'pass_purchase',
    title: `${rec.packageName} (KES ${rec.amountKes}) · Paid to 0758727558`,
    customerLabel: `${rec.customerName} (${rec.senderPhone})`,
    gatewayOrMethod: 'Manual M-PESA 0758727558',
    currency: 'KES',
    amountLocal: rec.amountKes,
    amountUsd: rec.amountUsd,
    status: 'Completed',
    reference: rec.mpesaCode,
    countryCode: rec.countryCode,
    metadata: {
      proofId: rec.id,
      approvedBy: params.ownerEmail,
      ownerApprovalDetails: rec.ownerApprovalDetails,
    },
  });

  return rec;
}

export function rejectPassProof(params: {
  id: string;
  ownerEmail: string;
  reason?: string;
}): WorkerPassProofRecord {
  const rec = proofsById.get(params.id);
  if (!rec) {
    throw new Error('Worker Pass proof submission not found.');
  }
  if (rec.status === 'Approved') {
    throw new Error('Already-approved pass proofs cannot be rejected.');
  }

  const now = new Date().toISOString();
  rec.status = 'Rejected';
  rec.reviewedBy = params.ownerEmail;
  rec.reviewedAt = now;
  rec.rejectionOrBanReason =
    String(params.reason || '').trim().slice(0, 240) ||
    'Payment not confirmed on M-PESA 0758727558. Do not submit invalid proofs or your account will be permanently banned 🚫 forever.';
  rec.updatedAt = now;

  proofsById.set(rec.id, rec);
  persistProofsToDisk();
  syncProofToFirestore(rec);

  upsertPlatformTransaction({
    id: rec.transactionId,
    kind: 'pass_purchase',
    title: `${rec.packageName} (KES ${rec.amountKes}) · Paid to 0758727558`,
    customerLabel: `${rec.customerName} (${rec.senderPhone})`,
    gatewayOrMethod: 'Manual M-PESA 0758727558',
    currency: 'KES',
    amountLocal: rec.amountKes,
    amountUsd: rec.amountUsd,
    status: 'Rejected',
    reference: rec.mpesaCode,
    countryCode: rec.countryCode,
    metadata: {
      proofId: rec.id,
      rejectedBy: params.ownerEmail,
      reason: rec.rejectionOrBanReason,
    },
  });

  return rec;
}

export function banPassProofAccount(params: {
  id: string;
  ownerEmail: string;
  reason?: string;
}): WorkerPassProofRecord {
  const rec = proofsById.get(params.id);
  if (!rec) {
    throw new Error('Worker Pass proof submission not found.');
  }

  if (
    isProtectedAdminIdentifier({
      phone: rec.customerPhone,
      senderPhone: rec.senderPhone,
      email: rec.customerEmail,
      countryCode: rec.countryCode,
    })
  ) {
    throw new Error(
      'Protected Platform Owner / Admin number (+254712727558) or email (nigideon36@gmail.com) cannot be banned.'
    );
  }

  const banReason =
    String(params.reason || '').trim().slice(0, 240) ||
    'Failed to provide valid M-PESA code & payment screenshot for 0758727558 — Banned 🚫 forever (no second chance).';
  const now = new Date().toISOString();

  rec.status = 'Banned';
  rec.reviewedBy = params.ownerEmail;
  rec.reviewedAt = now;
  rec.rejectionOrBanReason = banReason;
  rec.updatedAt = now;

  proofsById.set(rec.id, rec);
  persistProofsToDisk();
  syncProofToFirestore(rec);

  banCustomerPermanently({
    uid: rec.userUid !== 'guest' ? rec.userUid : undefined,
    phone: rec.customerPhone,
    senderPhone: rec.senderPhone,
    email: rec.customerEmail,
    countryCode: rec.countryCode,
    ownerEmail: params.ownerEmail,
    reason: banReason,
  });

  upsertPlatformTransaction({
    id: rec.transactionId,
    kind: 'pass_purchase',
    title: `${rec.packageName} (KES ${rec.amountKes}) · BANNED 🚫`,
    customerLabel: `${rec.customerName} (${rec.senderPhone})`,
    gatewayOrMethod: 'Manual M-PESA 0758727558',
    currency: 'KES',
    amountLocal: rec.amountKes,
    amountUsd: rec.amountUsd,
    status: 'Rejected',
    reference: rec.mpesaCode,
    countryCode: rec.countryCode,
    metadata: {
      proofId: rec.id,
      bannedBy: params.ownerEmail,
      bannedForever: true,
      reason: banReason,
    },
  });

  return rec;
}

export function unbanPassProofAccount(params: {
  id: string;
  ownerEmail: string;
}): WorkerPassProofRecord {
  const rec = proofsById.get(params.id);
  if (!rec) {
    throw new Error('Worker Pass proof submission not found.');
  }

  const now = new Date().toISOString();
  rec.status = 'Pending';
  rec.reviewedBy = params.ownerEmail;
  rec.reviewedAt = now;
  rec.rejectionOrBanReason = `Unbanned by Owner (${params.ownerEmail}) — re-opened for review.`;
  rec.updatedAt = now;

  proofsById.set(rec.id, rec);
  persistProofsToDisk();
  syncProofToFirestore(rec);

  unbanCustomerByOwner({
    uid: rec.userUid !== 'guest' ? rec.userUid : undefined,
    phone: rec.customerPhone || rec.senderPhone,
    email: rec.customerEmail,
    countryCode: rec.countryCode,
    ownerEmail: params.ownerEmail,
  });
  if (rec.senderPhone && rec.senderPhone !== rec.customerPhone) {
    unbanCustomerByOwner({
      phone: rec.senderPhone,
      countryCode: rec.countryCode,
      ownerEmail: params.ownerEmail,
    });
  }

  return rec;
}

export function clearBannedPassProofsForIdentity(params: {
  uid?: string;
  phone?: string;
  email?: string;
  countryCode?: string;
  ownerEmail: string;
}): number {
  const normPhone = params.phone ? normalizeEastAfricaPhone(params.phone, params.countryCode || 'KE') : '';
  const cleanEmail = params.email ? params.email.trim().toLowerCase() : '';
  let cleared = 0;

  for (const rec of proofsById.values()) {
    if (rec.status !== 'Banned') continue;
    const custNorm = rec.customerPhone ? normalizeEastAfricaPhone(rec.customerPhone, rec.countryCode || 'KE') : '';
    const senderNorm = rec.senderPhone ? normalizeEastAfricaPhone(rec.senderPhone, rec.countryCode || 'KE') : '';
    const matchesUid = Boolean(params.uid && rec.userUid === params.uid);
    const matchesPhone = Boolean(normPhone && (custNorm === normPhone || senderNorm === normPhone));
    const matchesEmail = Boolean(cleanEmail && rec.customerEmail?.trim().toLowerCase() === cleanEmail);

    if (matchesUid || matchesPhone || matchesEmail) {
      rec.status = 'Rejected';
      rec.rejectionOrBanReason = `Unbanned by Owner (${params.ownerEmail}).`;
      rec.reviewedBy = params.ownerEmail;
      rec.reviewedAt = new Date().toISOString();
      rec.updatedAt = rec.reviewedAt;
      syncProofToFirestore(rec);
      cleared += 1;
    }
  }

  if (cleared > 0) {
    persistProofsToDisk();
  }
  return cleared;
}
