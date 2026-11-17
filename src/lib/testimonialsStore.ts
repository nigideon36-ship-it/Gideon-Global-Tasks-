import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import {
  getCustomerByUid,
  isIdentifierOrAccountBanned,
  isProtectedAdminIdentifier,
} from './customerAuth.ts';

export type TestimonialStatus = 'Published' | 'Featured' | 'Hidden';

export interface CustomerTestimonialRecord {
  id: string;
  userUid: string;
  authorName: string;
  city: string;
  countryCode: string;
  rating: number; // 1 to 5
  headline: string;
  message: string;
  experienceCategory: string;
  verifiedCustomer: boolean;
  status: TestimonialStatus;
  ownerReply?: string;
  createdAt: string;
  updatedAt: string;
}

export class TestimonialError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const TESTIMONIALS_FILE = path.join(DATA_DIR, 'testimonials.json');
const FIRESTORE_TESTIMONIALS_COLLECTION = 'testimonials';

const testimonialsById = new Map<string, CustomerTestimonialRecord>();

function loadTestimonialsFromDisk() {
  try {
    if (!fs.existsSync(TESTIMONIALS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(TESTIMONIALS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      for (const rec of raw) {
        if (rec && rec.id) {
          testimonialsById.set(rec.id, rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load testimonials store:', (err as Error)?.message || err);
  }
}

function persistTestimonialsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const records = Array.from(testimonialsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(TESTIMONIALS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist testimonials store:', (err as Error)?.message || err);
  }
}

function syncTestimonialToFirestore(rec: CustomerTestimonialRecord) {
  if (!adminDb) return;
  try {
    const clean = JSON.parse(JSON.stringify(rec));
    adminDb
      .collection(FIRESTORE_TESTIMONIALS_COLLECTION)
      .doc(rec.id)
      .set(clean, { merge: true })
      .catch(() => {});
  } catch {
    // non-blocking
  }
}

async function hydrateTestimonialsFromFirestore() {
  if (!adminDb) return;
  try {
    const snapshot = await adminDb.collection(FIRESTORE_TESTIMONIALS_COLLECTION).get();
    let imported = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CustomerTestimonialRecord | undefined;
      if (data && data.id && !testimonialsById.has(data.id)) {
        testimonialsById.set(data.id, data);
        imported += 1;
      }
    });
    if (imported > 0) {
      persistTestimonialsToDisk();
    }
  } catch {
    // non-blocking
  }
}

loadTestimonialsFromDisk();
void hydrateTestimonialsFromFirestore();

export function createTestimonial(params: {
  userUid: string;
  authorName?: string;
  city?: string;
  countryCode?: string;
  rating: number;
  headline: string;
  message: string;
  experienceCategory?: string;
  customerPhone?: string;
  customerEmail?: string;
}): CustomerTestimonialRecord {
  const custRec = params.userUid ? getCustomerByUid(params.userUid) : null;
  if (custRec?.deactivated) {
    throw new TestimonialError(
      `Account deactivated: ${custRec.deactivatedReason || 'Contact Support (+254712727558) to restore access.'}`,
      403
    );
  }

  const banCheck = isIdentifierOrAccountBanned({
    uid: params.userUid,
    phone: params.customerPhone || custRec?.phone,
    email: params.customerEmail || custRec?.email,
    countryCode: params.countryCode || custRec?.countryCode,
  });
  if (
    banCheck.banned &&
    !isProtectedAdminIdentifier({
      phone: params.customerPhone || custRec?.phone,
      email: params.customerEmail || custRec?.email,
      countryCode: params.countryCode || custRec?.countryCode,
    })
  ) {
    throw new TestimonialError(
      `Account permanently banned 🚫 forever (no second chance): ${banCheck.reason || 'Policy violation.'}`,
      403
    );
  }

  const cleanAuthor = String(params.authorName || custRec?.displayName || '').trim().slice(0, 80);
  if (cleanAuthor.length < 2) {
    throw new TestimonialError('Please enter your name (at least 2 characters).', 400);
  }

  const cleanHeadline = String(params.headline || '').trim().slice(0, 120);
  if (cleanHeadline.length < 4) {
    throw new TestimonialError('Please enter a short headline (at least 4 characters).', 400);
  }

  const cleanMessage = String(params.message || '').trim().slice(0, 1000);
  if (cleanMessage.length < 12) {
    throw new TestimonialError('Please write a genuine testimonial of at least 12 characters.', 400);
  }

  const ratingNum = Math.min(5, Math.max(1, Math.round(Number(params.rating) || 5)));
  const cleanCity = String(params.city || custRec?.city || 'East Africa').trim().slice(0, 60) || 'East Africa';
  const cleanCountry = String(params.countryCode || custRec?.countryCode || 'KE').toUpperCase().slice(0, 4);
  const cleanCategory = String(params.experienceCategory || 'Overall Platform').trim().slice(0, 60);

  const nowIso = new Date().toISOString();
  const id = `TST-${crypto.randomInt(1000, 9999)}${crypto.randomBytes(2).toString('hex').toUpperCase()}`;

  const record: CustomerTestimonialRecord = {
    id,
    userUid: String(params.userUid || 'guest').slice(0, 128),
    authorName: cleanAuthor,
    city: cleanCity,
    countryCode: cleanCountry,
    rating: ratingNum,
    headline: cleanHeadline,
    message: cleanMessage,
    experienceCategory: cleanCategory,
    verifiedCustomer: Boolean(custRec?.phoneVerified || (params.userUid && params.userUid !== 'guest')),
    status: 'Published',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  testimonialsById.set(record.id, record);
  persistTestimonialsToDisk();
  syncTestimonialToFirestore(record);
  return record;
}

export function listPublicTestimonials(): CustomerTestimonialRecord[] {
  return Array.from(testimonialsById.values())
    .filter((t) => t.status === 'Published' || t.status === 'Featured')
    .sort((a, b) => {
      if (a.status === 'Featured' && b.status !== 'Featured') return -1;
      if (b.status === 'Featured' && a.status !== 'Featured') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
}

export function listAllTestimonialsForOwner(): CustomerTestimonialRecord[] {
  return Array.from(testimonialsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function ownerUpdateTestimonial(params: {
  id: string;
  status?: TestimonialStatus;
  headline?: string;
  message?: string;
  rating?: number;
  ownerReply?: string;
}): CustomerTestimonialRecord {
  const rec = testimonialsById.get(params.id);
  if (!rec) throw new Error('Testimonial not found.');

  if (params.status && ['Published', 'Featured', 'Hidden'].includes(params.status)) {
    rec.status = params.status;
  }
  if (params.headline !== undefined) {
    const h = String(params.headline || '').trim().slice(0, 120);
    if (h.length >= 4) rec.headline = h;
  }
  if (params.message !== undefined) {
    const m = String(params.message || '').trim().slice(0, 1000);
    if (m.length >= 12) rec.message = m;
  }
  if (params.rating !== undefined) {
    rec.rating = Math.min(5, Math.max(1, Math.round(Number(params.rating) || rec.rating)));
  }
  if (params.ownerReply !== undefined) {
    rec.ownerReply = String(params.ownerReply || '').trim().slice(0, 400) || undefined;
  }
  rec.updatedAt = new Date().toISOString();

  testimonialsById.set(rec.id, rec);
  persistTestimonialsToDisk();
  syncTestimonialToFirestore(rec);
  return rec;
}

export function deleteTestimonial(id: string): boolean {
  const existed = testimonialsById.delete(id);
  if (!existed) return false;
  persistTestimonialsToDisk();
  if (adminDb) {
    try {
      adminDb.collection(FIRESTORE_TESTIMONIALS_COLLECTION).doc(id).delete().catch(() => {});
    } catch {
      // non-blocking
    }
  }
  return true;
}
