import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import { getCountryByCode, isEastAfricaCountryCode } from './eastAfrica.ts';

export type KycVerificationStatus = 'Not Submitted' | 'Pending' | 'Approved' | 'Rejected';

export interface KycVerificationRecord {
  uid: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode: string;
  idDocumentName: string;
  fullNameOnId: string;
  idNumber: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  status: Exclude<KycVerificationStatus, 'Not Submitted'>;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
}

export interface PublicKycSummary {
  uid: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode: string;
  idDocumentName: string;
  fullNameOnId: string;
  idNumber: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  status: Exclude<KycVerificationStatus, 'Not Submitted'>;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  submittedAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const KYC_FILE = path.join(DATA_DIR, 'kyc-verifications.json');
const FIRESTORE_KYC_COLLECTION = 'kyc_verifications';
const MAX_IMAGE_DATA_URL_LENGTH = 2_800_000; // ~2 MB binary image base64-encoded
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=\s]+$/i;

const kycByUid = new Map<string, KycVerificationRecord>();

function syncKycMetadataToFirestore(rec: KycVerificationRecord) {
  if (!adminDb) return;
  try {
    // Store KYC metadata + SHA-256 verification digests in Firestore (staying well under 1MB doc limit)
    const frontHash = crypto.createHash('sha256').update(rec.frontImageDataUrl).digest('hex');
    const backHash = crypto.createHash('sha256').update(rec.backImageDataUrl).digest('hex');
    adminDb
      .collection(FIRESTORE_KYC_COLLECTION)
      .doc(rec.uid)
      .set(
        JSON.parse(
          JSON.stringify({
            uid: rec.uid,
            countryCode: rec.countryCode,
            idDocumentName: rec.idDocumentName,
            fullNameOnId: rec.fullNameOnId,
            idNumber: rec.idNumber,
            frontImageUploaded: true,
            backImageUploaded: true,
            frontImageSha256: frontHash,
            backImageSha256: backHash,
            status: rec.status,
            rejectionReason: rec.rejectionReason,
            reviewedBy: rec.reviewedBy,
            reviewedAt: rec.reviewedAt,
            submittedAt: rec.submittedAt,
            updatedAt: rec.updatedAt,
          })
        ),
        { merge: true }
      )
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

function loadKycFromDisk() {
  try {
    if (!fs.existsSync(KYC_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(KYC_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec && rec.uid) {
          kycByUid.set(String(rec.uid), rec as KycVerificationRecord);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load KYC verifications store:', (err as Error)?.message || err);
  }
}

function persistKycToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const items = Array.from(kycByUid.values()).sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    fs.writeFileSync(KYC_FILE, JSON.stringify(items, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist KYC verifications store:', (err as Error)?.message || err);
  }
}

function mergeKycRecordFromFirestoreDoc(data: any): KycVerificationRecord | null {
  if (!data || !data.uid || !data.status) return null;
  const uid = String(data.uid).trim();
  const existing = kycByUid.get(uid);
  const rank = (s: string) => (s === 'Approved' ? 3 : s === 'Rejected' ? 2 : s === 'Pending' ? 1 : 0);
  const remoteTime = Date.parse(data.updatedAt || '') || 0;
  const existingTime = Date.parse(existing?.updatedAt || '') || 0;

  if (existing && rank(existing.status) >= rank(data.status) && existingTime >= remoteTime) {
    return existing;
  }

  const merged: KycVerificationRecord = {
    uid,
    customerName: existing?.customerName,
    customerPhone: existing?.customerPhone,
    customerEmail: existing?.customerEmail,
    countryCode: String(data.countryCode || existing?.countryCode || 'KE').toUpperCase(),
    idDocumentName: String(data.idDocumentName || existing?.idDocumentName || 'National ID'),
    fullNameOnId: String(data.fullNameOnId || existing?.fullNameOnId || ''),
    idNumber: String(data.idNumber || existing?.idNumber || ''),
    frontImageDataUrl: existing?.frontImageDataUrl || '',
    backImageDataUrl: existing?.backImageDataUrl || '',
    status: data.status as Exclude<KycVerificationStatus, 'Not Submitted'>,
    rejectionReason: data.rejectionReason ? String(data.rejectionReason) : existing?.rejectionReason,
    reviewedBy: data.reviewedBy ? String(data.reviewedBy) : existing?.reviewedBy,
    reviewedAt: data.reviewedAt ? String(data.reviewedAt) : existing?.reviewedAt,
    submittedAt: String(data.submittedAt || existing?.submittedAt || new Date().toISOString()),
    updatedAt: String(data.updatedAt || existing?.updatedAt || new Date().toISOString()),
  };
  kycByUid.set(uid, merged);
  return merged;
}

export async function hydrateKycFromFirestore(): Promise<void> {
  if (!adminDb) return;
  try {
    const snap = await adminDb.collection(FIRESTORE_KYC_COLLECTION).get();
    let changed = false;
    snap.forEach((docSnap) => {
      const merged = mergeKycRecordFromFirestoreDoc(docSnap.data());
      if (merged) changed = true;
    });
    if (changed) {
      persistKycToDisk();
    }
  } catch {
    // Non-blocking when local ADC credentials aren't active
  }
}

export async function getOrHydrateKycByUid(uid?: string | null): Promise<KycVerificationRecord | null> {
  const clean = String(uid || '').trim();
  if (!clean) return null;
  const cached = kycByUid.get(clean);
  if (cached) return cached;
  if (!adminDb) return null;
  try {
    const snap = await adminDb.collection(FIRESTORE_KYC_COLLECTION).doc(clean).get();
    if (snap.exists) {
      const merged = mergeKycRecordFromFirestoreDoc(snap.data());
      if (merged) {
        persistKycToDisk();
        return merged;
      }
    }
  } catch {
    // non-blocking
  }
  return null;
}

loadKycFromDisk();
void hydrateKycFromFirestore();

function validateIdImageDataUrl(raw: string, sideLabel: 'Front' | 'Back', idDocumentName: string): string {
  const clean = String(raw || '').trim();
  if (!clean || !IMAGE_DATA_URL_RE.test(clean)) {
    throw new Error(
      `Upload a clear ${sideLabel} photo (PNG, JPG, or WebP) of your ${idDocumentName}.`
    );
  }
  if (clean.length > MAX_IMAGE_DATA_URL_LENGTH) {
    throw new Error(
      `${sideLabel} ID image is too large (max ~2 MB). Please upload a compressed PNG/JPG photo.`
    );
  }
  return clean;
}

export function getKycByUid(uid?: string | null): KycVerificationRecord | null {
  const clean = String(uid || '').trim();
  if (!clean) return null;
  return kycByUid.get(clean) || null;
}

export function getKycStatusForUid(uid?: string | null): KycVerificationStatus {
  const rec = getKycByUid(uid);
  return rec ? rec.status : 'Not Submitted';
}

export function isCustomerKycApproved(uid?: string | null): boolean {
  const rec = getKycByUid(uid);
  return Boolean(
    rec &&
      rec.status === 'Approved' &&
      ((rec.frontImageDataUrl && rec.backImageDataUrl && rec.frontImageDataUrl !== rec.backImageDataUrl) ||
        rec.reviewedBy)
  );
}

export function submitKycSubmission(params: {
  uid: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode: string;
  fullNameOnId: string;
  idNumber: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
}): KycVerificationRecord {
  const uid = String(params.uid || '').trim();
  if (!uid || uid === 'guest') {
    throw new Error('Sign in with your verified account before submitting KYC identity documents.');
  }

  const existing = kycByUid.get(uid);
  if (existing && existing.status === 'Approved') {
    throw new Error('Your KYC identity verification is already Approved.');
  }

  const normalizedCountry = String(params.countryCode || 'KE').trim().toUpperCase();
  if (!isEastAfricaCountryCode(normalizedCountry)) {
    throw new Error('KYC verification supports East Africa jurisdictions (KE, UG, TZ, RW, BI, SS, ET, SO).');
  }
  const country = getCountryByCode(normalizedCountry);

  const fullNameOnId = String(params.fullNameOnId || '').trim().slice(0, 120);
  if (fullNameOnId.length < 3) {
    throw new Error(`Enter your full legal name exactly as printed on your ${country.idDocumentName}.`);
  }

  const idNumber = String(params.idNumber || '').trim().replace(/\s+/g, ' ').slice(0, 60);
  if (idNumber.length < 4) {
    throw new Error(`Enter a valid ${country.idDocumentName} number (${country.idNumberHint}).`);
  }

  const frontImageDataUrl = validateIdImageDataUrl(params.frontImageDataUrl, 'Front', country.idDocumentName);
  const backImageDataUrl = validateIdImageDataUrl(params.backImageDataUrl, 'Back', country.idDocumentName);

  const frontDigest = crypto.createHash('sha256').update(frontImageDataUrl).digest('hex');
  const backDigest = crypto.createHash('sha256').update(backImageDataUrl).digest('hex');
  if (frontImageDataUrl === backImageDataUrl || frontDigest === backDigest) {
    throw new Error(
      `Both the Front AND Back photos of your ${country.idDocumentName} are required and cannot be the same image.`
    );
  }

  const now = new Date().toISOString();
  const record: KycVerificationRecord = {
    uid,
    customerName: params.customerName ? String(params.customerName).trim().slice(0, 120) : existing?.customerName,
    customerPhone: params.customerPhone ? String(params.customerPhone).trim().slice(0, 40) : existing?.customerPhone,
    customerEmail: params.customerEmail ? String(params.customerEmail).trim().slice(0, 160) : existing?.customerEmail,
    countryCode: country.code,
    idDocumentName: country.idDocumentName,
    fullNameOnId,
    idNumber,
    frontImageDataUrl,
    backImageDataUrl,
    status: 'Pending',
    rejectionReason: undefined,
    reviewedBy: undefined,
    reviewedAt: undefined,
    submittedAt: existing?.submittedAt || now,
    updatedAt: now,
  };

  kycByUid.set(uid, record);
  persistKycToDisk();
  syncKycMetadataToFirestore(record);
  return record;
}

export function hydrateKycFromClientBackup(params: {
  uid: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  countryCode: string;
  fullNameOnId: string;
  idNumber: string;
  frontImageDataUrl: string;
  backImageDataUrl: string;
  submittedAt?: string;
}): KycVerificationRecord {
  const existing = kycByUid.get(params.uid);
  if (existing) {
    if ((!existing.frontImageDataUrl || !existing.backImageDataUrl) && params.frontImageDataUrl && params.backImageDataUrl) {
      const front = validateIdImageDataUrl(params.frontImageDataUrl, 'Front', existing.idDocumentName);
      const back = validateIdImageDataUrl(params.backImageDataUrl, 'Back', existing.idDocumentName);
      if (front !== back) {
        existing.frontImageDataUrl = front;
        existing.backImageDataUrl = back;
        persistKycToDisk();
      }
    }
    return existing;
  }
  const created = submitKycSubmission(params);
  if (params.submittedAt) {
    created.submittedAt = params.submittedAt;
    persistKycToDisk();
  }
  return created;
}

export function listAllKycSubmissions(): PublicKycSummary[] {
  return Array.from(kycByUid.values()).sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}

export function approveKycSubmission(params: {
  uid: string;
  ownerEmail: string;
}): KycVerificationRecord {
  const uid = String(params.uid || '').trim();
  const existing = kycByUid.get(uid);
  if (!existing) {
    throw new Error('KYC submission not found for this account.');
  }
  if (!existing.frontImageDataUrl || !existing.backImageDataUrl || existing.frontImageDataUrl === existing.backImageDataUrl) {
    throw new Error('Cannot approve KYC without distinct Front and Back ID photos.');
  }
  const now = new Date().toISOString();
  const updated: KycVerificationRecord = {
    ...existing,
    status: 'Approved',
    rejectionReason: undefined,
    reviewedBy: params.ownerEmail,
    reviewedAt: now,
    updatedAt: now,
  };
  kycByUid.set(uid, updated);
  persistKycToDisk();
  syncKycMetadataToFirestore(updated);
  return updated;
}

export function rejectKycSubmission(params: {
  uid: string;
  ownerEmail: string;
  reason?: string;
}): KycVerificationRecord {
  const uid = String(params.uid || '').trim();
  const existing = kycByUid.get(uid);
  if (!existing) {
    throw new Error('KYC submission not found for this account.');
  }
  const now = new Date().toISOString();
  const updated: KycVerificationRecord = {
    ...existing,
    status: 'Rejected',
    rejectionReason:
      String(params.reason || '').trim().slice(0, 240) ||
      `Front or Back photo of ${existing.idDocumentName} was unclear or mismatched. Please re-upload clear photos of both sides.`,
    reviewedBy: params.ownerEmail,
    reviewedAt: now,
    updatedAt: now,
  };
  kycByUid.set(uid, updated);
  persistKycToDisk();
  syncKycMetadataToFirestore(updated);
  return updated;
}
