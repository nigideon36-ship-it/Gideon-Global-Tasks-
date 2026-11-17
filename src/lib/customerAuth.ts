import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EAST_AFRICA_COUNTRIES, isEastAfricaCountryCode, isEastAfricaPhone } from './eastAfrica.ts';
import { dispatchSmsViaGateway } from './smsGateway.ts';
import { adminDb } from './firebase-admin.ts';

export type CustomerWithdrawalMethod =
  | 'M-PESA'
  | 'Airtel / MTN MoMo'
  | 'East Africa Bank'
  | 'Wise'
  | 'Crypto USDT';

export interface CustomerWithdrawalDetails {
  method: CustomerWithdrawalMethod;
  accountDetails: string;
  accountHolderName: string;
  locked: boolean;
  lockedAt: string;
}

export interface CustomerSocialHandles {
  facebook?: string;
  instagram?: string;
  tiktok?: string;
  whatsapp?: string;
}

export interface CustomerRecord {
  uid: string;
  phone: string;
  phoneLocked?: boolean;
  countryCode: string;
  email?: string;
  displayName: string;
  city?: string;
  bio?: string;
  socialHandles?: CustomerSocialHandles;
  withdrawalDetails?: CustomerWithdrawalDetails;
  passwordHash: string;
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  totpSecret?: string;
  pendingTotpSecret?: string;
  phoneVerified: boolean;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
  bannedBy?: string;
  deactivated?: boolean;
  deactivatedReason?: string;
  deactivatedAt?: string;
  deactivatedBy?: string;
  adminAssignedPass?: 'free' | 'starter' | 'pro' | 'vip';
  referredByCode?: string;
  referredByUid?: string;
  loginCount?: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomerProfile {
  uid: string;
  phone: string;
  phoneLocked: boolean;
  countryCode: string;
  email?: string;
  displayName: string;
  city?: string;
  bio?: string;
  socialHandles?: CustomerSocialHandles;
  withdrawalDetails?: CustomerWithdrawalDetails;
  role: 'customer';
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  phoneVerified: boolean;
  banned?: boolean;
  bannedReason?: string;
  bannedAt?: string;
  deactivated?: boolean;
  deactivatedReason?: string;
  deactivatedAt?: string;
  adminAssignedPass?: 'free' | 'starter' | 'pro' | 'vip';
  referredByCode?: string;
  loginCount: number;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface OtpEntry {
  code: string;
  expiresAt: number;
  purpose: 'login-2fa' | 'enable-sms-2fa' | 'register';
  attempts: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const FIRESTORE_CUSTOMER_COLLECTION = 'customer_accounts';
const SESSION_SECRET =
  process.env.CUSTOMER_AUTH_SECRET ||
  process.env.PAYSTACK_SECRET_KEY ||
  'gideon-global-east-africa-customer-auth-secret-v1';

const customersByUid = new Map<string, CustomerRecord>();
const uidByPhone = new Map<string, string>();
const uidByEmail = new Map<string, string>();
const smsOtpStore = new Map<string, OtpEntry>();
const bannedReasonsByKey = new Map<string, string>();
const BANNED_FILE = path.join(DATA_DIR, 'banned-identifiers.json');

function loadBannedStoreFromDisk() {
  try {
    if (!fs.existsSync(BANNED_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(BANNED_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) {
        if (typeof v === 'string' && k) bannedReasonsByKey.set(k, v);
      }
    }
  } catch {
    // ignore corrupt ban store
  }
}

function persistBannedStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const obj: Record<string, string> = {};
    for (const [k, v] of bannedReasonsByKey.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(BANNED_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

loadBannedStoreFromDisk();

export const PROTECTED_ADMIN_PHONES = new Set(['+254712727558']);
export const PROTECTED_ADMIN_EMAILS = new Set(['nigideon36@gmail.com']);

export function isProtectedAdminIdentifier(params: {
  phone?: string;
  senderPhone?: string;
  email?: string;
  countryCode?: string;
}): boolean {
  const phonesToCheck = [params.phone, params.senderPhone].filter(Boolean) as string[];
  for (const raw of phonesToCheck) {
    const trimmed = String(raw || '').replace(/[\s\-().]/g, '');
    if (
      trimmed === '0712727558' ||
      trimmed === '712727558' ||
      trimmed === '254712727558' ||
      trimmed === '+254712727558'
    ) {
      return true;
    }
    const norm = normalizeEastAfricaPhone(raw, params.countryCode || 'KE');
    if (norm && PROTECTED_ADMIN_PHONES.has(norm)) {
      return true;
    }
  }
  if (params.email && PROTECTED_ADMIN_EMAILS.has(params.email.trim().toLowerCase())) {
    return true;
  }
  return false;
}

function indexCustomerRecord(rec: CustomerRecord) {
  if (rec.banned && isProtectedAdminIdentifier({ phone: rec.phone, email: rec.email, countryCode: rec.countryCode })) {
    rec.banned = false;
    delete rec.bannedReason;
    delete rec.bannedAt;
    delete rec.bannedBy;
  }

  customersByUid.set(rec.uid, rec);
  if (rec.phone) {
    uidByPhone.set(rec.phone, rec.uid);
  }
  if (rec.email) {
    const cleanEmail = rec.email.trim().toLowerCase();
    if (cleanEmail) {
      uidByEmail.set(cleanEmail, rec.uid);
    }
  }
  if (rec.banned) {
    const reason =
      rec.bannedReason ||
      'Permanently banned 🚫 forever (no second chance): failed manual M-PESA Worker Pass proof requirement.';
    bannedReasonsByKey.set(`uid:${rec.uid}`, reason);
    if (rec.phone) bannedReasonsByKey.set(`phone:${rec.phone}`, reason);
    if (rec.email) bannedReasonsByKey.set(`email:${rec.email.trim().toLowerCase()}`, reason);
  }
}

function loadCustomersFromDisk() {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE)) return;
    const raw = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const rec of parsed) {
        if (rec && rec.uid) {
          indexCustomerRecord(rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load customers store:', (err as Error)?.message || err);
  }
}

function persistCustomersToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const records = Array.from(customersByUid.values());
    fs.writeFileSync(CUSTOMERS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist customers store:', (err as Error)?.message || err);
  }
}

function syncCustomerRecordToFirestore(rec: CustomerRecord, replaceFullDoc = false) {
  if (!adminDb) return;
  try {
    const cleanDoc = JSON.parse(JSON.stringify(rec));
    const docRef = adminDb.collection(FIRESTORE_CUSTOMER_COLLECTION).doc(rec.uid);
    const writeOp = replaceFullDoc ? docRef.set(cleanDoc) : docRef.set(cleanDoc, { merge: true });
    writeOp.catch(() => {
      // Non-blocking fallback when local ADC credentials are absent in preview
    });
  } catch {
    // Non-blocking sync guard
  }
}

export function ensureProtectedAdminAccountsUnbanned(): boolean {
  let changed = false;
  for (const phone of PROTECTED_ADMIN_PHONES) {
    const variants = [
      `phone:${phone}`,
      `phone:${phone.replace(/^\+/, '')}`,
      `phone:0${phone.replace(/^\+254/, '')}`,
    ];
    for (const key of variants) {
      if (bannedReasonsByKey.delete(key)) {
        changed = true;
      }
    }
  }
  for (const email of PROTECTED_ADMIN_EMAILS) {
    if (bannedReasonsByKey.delete(`email:${email}`)) {
      changed = true;
    }
  }

  for (const rec of customersByUid.values()) {
    if (isProtectedAdminIdentifier({ phone: rec.phone, email: rec.email, countryCode: rec.countryCode })) {
      if (bannedReasonsByKey.delete(`uid:${rec.uid}`)) {
        changed = true;
      }
      if (rec.banned || rec.bannedReason || rec.bannedAt || rec.bannedBy) {
        rec.banned = false;
        delete rec.bannedReason;
        delete rec.bannedAt;
        delete rec.bannedBy;
        rec.updatedAt = new Date().toISOString();
        syncCustomerRecordToFirestore(rec, true);
        changed = true;
      }
    }
  }

  if (changed) {
    persistBannedStoreToDisk();
    persistCustomersToDisk();
  }
  return changed;
}

async function hydrateCustomersFromFirestore() {
  if (!adminDb) return;
  try {
    const snapshot = await adminDb.collection(FIRESTORE_CUSTOMER_COLLECTION).get();
    let imported = 0;
    snapshot.forEach((docSnap) => {
      const data = docSnap.data() as CustomerRecord | undefined;
      if (!data || !data.uid) return;
      if (data.banned && isProtectedAdminIdentifier({ phone: data.phone, email: data.email, countryCode: data.countryCode })) {
        data.banned = false;
        delete data.bannedReason;
        delete data.bannedAt;
        delete data.bannedBy;
        syncCustomerRecordToFirestore(data, true);
        if (!customersByUid.has(data.uid)) {
          indexCustomerRecord(data);
          imported += 1;
        }
        return;
      }
      if (!customersByUid.has(data.uid)) {
        indexCustomerRecord(data);
        imported += 1;
      }
    });
    if (imported > 0) {
      persistCustomersToDisk();
    }
    ensureProtectedAdminAccountsUnbanned();
  } catch {
    // Non-blocking when Admin Firestore credentials aren't active locally
  }
}

loadCustomersFromDisk();
ensureProtectedAdminAccountsUnbanned();
void hydrateCustomersFromFirestore();

const OTP_FILE = path.join(DATA_DIR, 'otp-store.json');

function loadOtpStoreFromDisk() {
  try {
    if (!fs.existsSync(OTP_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(OTP_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      const now = Date.now();
      for (const [k, v] of Object.entries<any>(raw)) {
        if (v && v.code && v.expiresAt > now) {
          smsOtpStore.set(k, v);
        }
      }
    }
  } catch {
    // ignore corrupt otp file
  }
}

function persistOtpStoreToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const now = Date.now();
    const obj: Record<string, OtpEntry> = {};
    for (const [k, v] of smsOtpStore.entries()) {
      if (v.expiresAt > now) {
        obj[k] = v;
      }
    }
    fs.writeFileSync(OTP_FILE, JSON.stringify(obj, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

loadOtpStoreFromDisk();

export function normalizeEastAfricaPhone(rawPhone: string, countryCode?: string): string {
  let cleaned = String(rawPhone || '').trim().replace(/[\s\-().]/g, '');
  if (!cleaned) return '';

  // Convert international 00 prefix (e.g. 00254712...) to +254712...
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  // Strip stray trunk '0' immediately following an East Africa country dial code (+25407... -> +2547...)
  const withPlus = cleaned.startsWith('+')
    ? cleaned
    : /^(254|256|255|250|257|211|251|252)/.test(cleaned)
    ? `+${cleaned}`
    : '';

  if (withPlus) {
    return withPlus.replace(/^\+(254|256|255|250|257|211|251|252)0+(\d+)/, '+$1$2');
  }

  const dialMap = new Map(EAST_AFRICA_COUNTRIES.map((c) => [c.code, c.dialCode]));
  const selectedDial = (countryCode && dialMap.get(countryCode.toUpperCase() as any)) || '+254';
  if (cleaned.startsWith('0')) {
    return `${selectedDial}${cleaned.slice(1)}`;
  }
  return `${selectedDial}${cleaned}`;
}

export function inferCountryCodeFromPhone(normalizedPhone: string, fallbackCode?: string): string {
  for (const country of EAST_AFRICA_COUNTRIES) {
    if (normalizedPhone.startsWith(country.dialCode)) {
      return country.code;
    }
  }
  return isEastAfricaCountryCode(fallbackCode) ? String(fallbackCode).toUpperCase() : 'KE';
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 7) return phone;
  return `${phone.slice(0, 6)}****${phone.slice(-3)}`;
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(keyHex, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function toPublicCustomerProfile(rec: CustomerRecord): PublicCustomerProfile {
  return {
    uid: rec.uid,
    phone: rec.phone,
    phoneLocked: Boolean(rec.phone && (rec.phoneLocked ?? true)),
    countryCode: rec.countryCode,
    email: rec.email,
    displayName: rec.displayName,
    city: rec.city,
    bio: rec.bio,
    socialHandles: rec.socialHandles,
    withdrawalDetails: rec.withdrawalDetails,
    role: 'customer',
    twoFactorEnabled: rec.twoFactorEnabled,
    twoFactorMethod: rec.twoFactorMethod,
    phoneVerified: rec.phoneVerified,
    banned: Boolean(rec.banned),
    bannedReason: rec.bannedReason,
    bannedAt: rec.bannedAt,
    deactivated: Boolean(rec.deactivated),
    deactivatedReason: rec.deactivatedReason,
    deactivatedAt: rec.deactivatedAt,
    adminAssignedPass: rec.adminAssignedPass,
    referredByCode: rec.referredByCode,
    loginCount: rec.loginCount || 0,
    lastLoginAt: rec.lastLoginAt,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

export function getCustomerByPhone(rawPhone: string, countryCode?: string): CustomerRecord | null {
  const normalized = normalizeEastAfricaPhone(rawPhone, countryCode);
  const uid = uidByPhone.get(normalized);
  if (!uid) return null;
  return customersByUid.get(uid) || null;
}

export function getCustomerByEmail(rawEmail: string): CustomerRecord | null {
  const cleanEmail = String(rawEmail || '').trim().toLowerCase();
  if (!cleanEmail) return null;
  const uid = uidByEmail.get(cleanEmail);
  if (!uid) return null;
  return customersByUid.get(uid) || null;
}

export function getCustomerByIdentifier(identifier: string, countryCode?: string): CustomerRecord | null {
  const clean = String(identifier || '').trim();
  if (!clean) return null;
  if (clean.includes('@')) {
    return getCustomerByEmail(clean);
  }
  return getCustomerByPhone(clean, countryCode);
}

export function getCustomerByUid(uid: string): CustomerRecord | null {
  return customersByUid.get(uid) || null;
}

export function isPhoneOwnedByDifferentCustomer(rawPhone: string, ownUid: string, countryCode?: string): boolean {
  const normalized = normalizeEastAfricaPhone(rawPhone, countryCode);
  if (!normalized) return false;
  const ownerUid = uidByPhone.get(normalized);
  return Boolean(ownerUid && ownerUid !== ownUid);
}

export function listAllCustomerProfiles(): PublicCustomerProfile[] {
  return Array.from(customersByUid.values())
    .sort((a, b) => {
      const timeA = Date.parse(a.lastLoginAt || a.createdAt || '0');
      const timeB = Date.parse(b.lastLoginAt || b.createdAt || '0');
      return timeB - timeA;
    })
    .map(toPublicCustomerProfile);
}

export function validateRegistrationInputs(params: {
  phone: string;
  countryCode?: string;
  email?: string;
  password: string;
}): { normalizedPhone: string; trimmedEmail?: string } {
  const normalizedPhone = normalizeEastAfricaPhone(params.phone, params.countryCode);
  if (!isEastAfricaPhone(normalizedPhone)) {
    throw new Error(
      'Please enter a valid East Africa mobile number (+254, +256, +255, +250, +257, +211, +251, or +252).'
    );
  }
  const phoneBan = bannedReasonsByKey.get(`phone:${normalizedPhone}`);
  if (phoneBan) {
    throw new Error(
      `This mobile number is permanently banned 🚫 forever (no second chance): ${phoneBan}`
    );
  }
  if (uidByPhone.has(normalizedPhone)) {
    throw new Error(
      'This mobile number is already registered on the portal. Duplicate accounts are not allowed — please use Sign In instead.'
    );
  }

  const trimmedEmail = params.email ? params.email.trim().toLowerCase() : undefined;
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address or leave email blank.');
  }
  if (trimmedEmail === 'nigideon36@gmail.com') {
    throw new Error('Owner email must sign in directly via Google Auth.');
  }
  if (trimmedEmail) {
    const emailBan = bannedReasonsByKey.get(`email:${trimmedEmail}`);
    if (emailBan) {
      throw new Error(
        `This email address is permanently banned 🚫 forever (no second chance): ${emailBan}`
      );
    }
  }
  if (trimmedEmail && uidByEmail.has(trimmedEmail)) {
    throw new Error(
      'This email address is already registered on the portal. Duplicate accounts are not allowed — please sign in with your existing account.'
    );
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('Password / PIN must be at least 6 characters.');
  }

  return { normalizedPhone, trimmedEmail };
}

const VALID_WITHDRAWAL_METHODS: readonly CustomerWithdrawalMethod[] = [
  'M-PESA',
  'Airtel / MTN MoMo',
  'East Africa Bank',
  'Wise',
  'Crypto USDT',
];

export function validateWithdrawalInput(params: {
  method: string;
  accountDetails: string;
  accountHolderName?: string;
  countryCode?: string;
}): {
  method: CustomerWithdrawalMethod;
  accountDetails: string;
  accountHolderName: string;
} {
  const method = params.method as CustomerWithdrawalMethod;
  if (!VALID_WITHDRAWAL_METHODS.includes(method)) {
    throw new Error('Select a valid withdrawal method (M-PESA, Airtel / MTN MoMo, East Africa Bank, Wise, or Crypto USDT).');
  }
  let cleanAccount = String(params.accountDetails || '').trim().slice(0, 160);
  if (!cleanAccount) {
    throw new Error('Withdrawal account details or mobile number are required.');
  }
  if (method === 'M-PESA' || method === 'Airtel / MTN MoMo') {
    const normalized = normalizeEastAfricaPhone(cleanAccount, params.countryCode);
    if (!isEastAfricaPhone(normalized)) {
      throw new Error('Mobile money withdrawal details must be a valid East Africa phone number (+254, +256, +255, +250, +257, +211, +251, or +252).');
    }
    cleanAccount = normalized;
  } else if (method === 'Wise') {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanAccount)) {
      throw new Error('Wise withdrawal details must be a valid email address.');
    }
  } else if (cleanAccount.length < 6) {
    throw new Error('Enter complete bank account or crypto wallet details (at least 6 characters).');
  }

  const cleanHolder = String(params.accountHolderName || '').trim().slice(0, 120);
  return {
    method,
    accountDetails: cleanAccount,
    accountHolderName: cleanHolder,
  };
}

export function registerCustomerAccount(params: {
  phone: string;
  countryCode?: string;
  email?: string;
  displayName?: string;
  city?: string;
  password: string;
  phoneVerified?: boolean;
  withdrawalMethod?: string;
  withdrawalAccount?: string;
  withdrawalAccountHolder?: string;
  referralCode?: string;
}): CustomerRecord {
  const { normalizedPhone, trimmedEmail } = validateRegistrationInputs(params);

  const resolvedCountry = inferCountryCodeFromPhone(normalizedPhone, params.countryCode);
  const cleanName =
    (params.displayName || '').trim().slice(0, 120) ||
    `Contributor ${normalizedPhone.slice(-4)}`;
  const now = new Date().toISOString();
  const uid = `cust_${crypto.randomBytes(10).toString('hex')}`;

  const defaultMethod: CustomerWithdrawalMethod =
    resolvedCountry === 'KE' ? 'M-PESA' : 'Airtel / MTN MoMo';
  const chosenMethod = params.withdrawalMethod || defaultMethod;
  const chosenAccount = (params.withdrawalAccount || '').trim() || normalizedPhone;
  const validatedWithdrawal = validateWithdrawalInput({
    method: chosenMethod,
    accountDetails: chosenAccount,
    accountHolderName: params.withdrawalAccountHolder || cleanName,
    countryCode: resolvedCountry,
  });

  const cleanRefCode = params.referralCode ? String(params.referralCode).trim().toUpperCase().slice(0, 40) : undefined;

  const record: CustomerRecord = {
    uid,
    phone: normalizedPhone,
    phoneLocked: true,
    countryCode: resolvedCountry,
    email: trimmedEmail || undefined,
    displayName: cleanName,
    city: params.city ? String(params.city).trim().slice(0, 80) : undefined,
    withdrawalDetails: {
      method: validatedWithdrawal.method,
      accountDetails: validatedWithdrawal.accountDetails,
      accountHolderName: validatedWithdrawal.accountHolderName || cleanName,
      locked: true,
      lockedAt: now,
    },
    passwordHash: hashPassword(params.password),
    twoFactorEnabled: false,
    twoFactorMethod: 'none',
    phoneVerified: Boolean(params.phoneVerified),
    referredByCode: cleanRefCode || undefined,
    loginCount: 1,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };

  indexCustomerRecord(record);
  persistCustomersToDisk();
  syncCustomerRecordToFirestore(record);
  return record;
}

export function recordCustomerLoginSuccess(record: CustomerRecord): void {
  const now = new Date().toISOString();
  record.loginCount = (record.loginCount || 0) + 1;
  record.lastLoginAt = now;
  record.updatedAt = now;
  indexCustomerRecord(record);
  persistCustomersToDisk();
  syncCustomerRecordToFirestore(record);
}

export function ensureShadowCustomerForGoogleUid(params: {
  uid: string;
  email?: string;
  displayName?: string;
  phone?: string;
  countryCode?: string;
}): CustomerRecord {
  const existing = customersByUid.get(params.uid);
  const normalizedPhone = params.phone
    ? normalizeEastAfricaPhone(params.phone, params.countryCode)
    : existing?.phone || '';
  const cleanEmail = params.email ? params.email.trim().toLowerCase() : existing?.email;
  const now = new Date().toISOString();

  if (existing) {
    if (normalizedPhone && normalizedPhone !== existing.phone) {
      const existingPhoneOwner = uidByPhone.get(normalizedPhone);
      if (!existingPhoneOwner || existingPhoneOwner === existing.uid) {
        if (existing.phone) uidByPhone.delete(existing.phone);
        existing.phone = normalizedPhone;
        uidByPhone.set(normalizedPhone, existing.uid);
      }
    }
    if (cleanEmail && cleanEmail !== existing.email) {
      const existingEmailOwner = uidByEmail.get(cleanEmail);
      if (!existingEmailOwner || existingEmailOwner === existing.uid) {
        if (existing.email) uidByEmail.delete(existing.email.toLowerCase());
        existing.email = cleanEmail;
        uidByEmail.set(cleanEmail, existing.uid);
      }
    }
    if (params.countryCode && isEastAfricaCountryCode(params.countryCode)) {
      existing.countryCode = params.countryCode.toUpperCase();
    }
    existing.updatedAt = now;
    persistCustomersToDisk();
    syncCustomerRecordToFirestore(existing);
    return existing;
  }

  const safePhone =
    normalizedPhone && !uidByPhone.has(normalizedPhone) ? normalizedPhone : '';
  const safeEmail =
    cleanEmail && !uidByEmail.has(cleanEmail) ? cleanEmail : undefined;

  const record: CustomerRecord = {
    uid: params.uid,
    phone: safePhone,
    countryCode: isEastAfricaCountryCode(params.countryCode) ? String(params.countryCode).toUpperCase() : 'KE',
    email: safeEmail,
    displayName: params.displayName || cleanEmail?.split('@')[0] || 'Contributor',
    passwordHash: '',
    twoFactorEnabled: false,
    twoFactorMethod: 'none',
    phoneVerified: false,
    loginCount: 1,
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };
  indexCustomerRecord(record);
  persistCustomersToDisk();
  syncCustomerRecordToFirestore(record);
  return record;
}

export function saveCustomerRecord(record: CustomerRecord): void {
  record.updatedAt = new Date().toISOString();
  indexCustomerRecord(record);
  persistCustomersToDisk();
  syncCustomerRecordToFirestore(record);
}

export class ImmutableFieldError extends Error {
  statusCode = 403;
}

export function updateCustomerProfileDetails(
  uid: string,
  updates: {
    displayName?: string;
    email?: string;
    city?: string;
    bio?: string;
    socialHandles?: CustomerSocialHandles;
    phone?: string;
    withdrawalMethod?: string;
    withdrawalAccount?: string;
    withdrawalAccountHolder?: string;
  }
): CustomerRecord {
  const record = customersByUid.get(uid);
  if (!record) {
    throw new Error('Customer account not found.');
  }

  // 1. Strict Phone Immutability Enforcement
  if (updates.phone !== undefined) {
    const incomingPhoneRaw = String(updates.phone || '').trim();
    if (record.phone) {
      const normalizedIncoming = normalizeEastAfricaPhone(incomingPhoneRaw, record.countryCode);
      if (incomingPhoneRaw && normalizedIncoming !== record.phone) {
        throw new ImmutableFieldError(
          'Your registered mobile phone number is permanently locked and cannot be changed. Contact support (+254712727558 / WhatsApp 0785909543) for verified account recovery.'
        );
      }
    } else if (incomingPhoneRaw) {
      // Allow Google-authenticated accounts with no phone yet to bind & lock their phone once
      const normalized = normalizeEastAfricaPhone(incomingPhoneRaw, record.countryCode);
      if (!isEastAfricaPhone(normalized)) {
        throw new Error('Enter a valid East Africa mobile number (+254, +256, +255, +250, +257, +211, +251, or +252).');
      }
      const existingOwner = uidByPhone.get(normalized);
      if (existingOwner && existingOwner !== uid) {
        throw new Error('This mobile number is already registered to another portal account.');
      }
      record.phone = normalized;
      record.phoneLocked = true;
      record.countryCode = inferCountryCodeFromPhone(normalized, record.countryCode);
    }
  }

  // 2. Strict Withdrawal Details Immutability Enforcement
  const hasWithdrawalInput = Boolean(
    updates.withdrawalMethod !== undefined ||
      updates.withdrawalAccount !== undefined ||
      updates.withdrawalAccountHolder !== undefined
  );

  if (hasWithdrawalInput) {
    if (record.withdrawalDetails?.locked) {
      const incomingMethod = String(updates.withdrawalMethod || record.withdrawalDetails.method).trim();
      const incomingAccount = String(updates.withdrawalAccount || record.withdrawalDetails.accountDetails).trim();
      const normalizedIncomingAcct =
        incomingMethod === 'M-PESA' || incomingMethod === 'Airtel / MTN MoMo'
          ? normalizeEastAfricaPhone(incomingAccount, record.countryCode)
          : incomingAccount;

      const incomingHolder = String(
        updates.withdrawalAccountHolder ?? record.withdrawalDetails.accountHolderName
      ).trim();

      if (
        incomingMethod !== record.withdrawalDetails.method ||
        normalizedIncomingAcct !== record.withdrawalDetails.accountDetails ||
        incomingHolder !== record.withdrawalDetails.accountHolderName
      ) {
        throw new ImmutableFieldError(
          'Your withdrawal details are locked after registration and cannot be changed by customers. Contact the Owner/Support (+254712727558 / WhatsApp 0785909543) for verified payout changes.'
        );
      }
    } else if (updates.withdrawalAccount && updates.withdrawalMethod) {
      // First-time one-time lock for legacy/Google accounts without withdrawal details yet
      const validated = validateWithdrawalInput({
        method: updates.withdrawalMethod,
        accountDetails: updates.withdrawalAccount,
        accountHolderName: updates.withdrawalAccountHolder || record.displayName,
        countryCode: record.countryCode,
      });
      record.withdrawalDetails = {
        method: validated.method,
        accountDetails: validated.accountDetails,
        accountHolderName: validated.accountHolderName || record.displayName,
        locked: true,
        lockedAt: new Date().toISOString(),
      };
    }
  }

  // 3. Allowed Editable Customer Fields
  if (updates.displayName !== undefined) {
    const cleanName = String(updates.displayName || '').trim().slice(0, 120);
    if (cleanName.length < 2) {
      throw new Error('Display name must be at least 2 characters.');
    }
    record.displayName = cleanName;
  }

  if (updates.email !== undefined) {
    const cleanEmail = String(updates.email || '').trim().toLowerCase();
    if (cleanEmail) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Please enter a valid email address or leave email blank.');
      }
      if (cleanEmail === 'nigideon36@gmail.com' && record.email !== 'nigideon36@gmail.com') {
        throw new Error('This email address is reserved for the platform owner.');
      }
      const existingEmailOwner = uidByEmail.get(cleanEmail);
      if (existingEmailOwner && existingEmailOwner !== uid) {
        throw new Error('This email address is already registered to another portal account.');
      }
      if (record.email && record.email.toLowerCase() !== cleanEmail) {
        uidByEmail.delete(record.email.toLowerCase());
      }
      record.email = cleanEmail;
    } else {
      if (record.email) {
        uidByEmail.delete(record.email.toLowerCase());
      }
      record.email = undefined;
    }
  }

  if (updates.city !== undefined) {
    record.city = String(updates.city || '').trim().slice(0, 80) || undefined;
  }

  if (updates.bio !== undefined) {
    record.bio = String(updates.bio || '').trim().slice(0, 300) || undefined;
  }

  if (updates.socialHandles !== undefined && typeof updates.socialHandles === 'object') {
    const cleanHandle = (v: unknown) => String(v || '').trim().slice(0, 100);
    const cleanedHandles: CustomerSocialHandles = {};
    const fb = cleanHandle(updates.socialHandles.facebook);
    const ig = cleanHandle(updates.socialHandles.instagram);
    const tt = cleanHandle(updates.socialHandles.tiktok);
    const wa = cleanHandle(updates.socialHandles.whatsapp);
    if (fb) cleanedHandles.facebook = fb;
    if (ig) cleanedHandles.instagram = ig;
    if (tt) cleanedHandles.tiktok = tt;
    if (wa) cleanedHandles.whatsapp = wa;
    record.socialHandles = Object.keys(cleanedHandles).length > 0 ? cleanedHandles : undefined;
  }

  saveCustomerRecord(record);
  return record;
}

export function ownerResetCustomerWithdrawalLock(uid: string): CustomerRecord {
  const record = customersByUid.get(uid);
  if (!record) {
    throw new Error('Customer account not found.');
  }
  if (record.withdrawalDetails) {
    record.withdrawalDetails = {
      ...record.withdrawalDetails,
      locked: false,
    };
  }
  saveCustomerRecord(record);
  return record;
}

export function deactivateCustomerAccount(params: {
  uid: string;
  ownerEmail: string;
  reason?: string;
}): CustomerRecord {
  const record = customersByUid.get(params.uid);
  if (!record) {
    throw new Error('Customer account not found.');
  }
  if (isProtectedAdminIdentifier({ phone: record.phone, email: record.email, countryCode: record.countryCode })) {
    throw new Error(
      'Protected Platform Owner / Admin account (+254712727558 / nigideon36@gmail.com) cannot be deactivated.'
    );
  }
  const now = new Date().toISOString();
  record.deactivated = true;
  record.deactivatedReason =
    String(params.reason || '').trim().slice(0, 240) ||
    'Account temporarily deactivated by Platform Owner.';
  record.deactivatedAt = now;
  record.deactivatedBy = params.ownerEmail;
  saveCustomerRecord(record);
  return record;
}

export function reactivateCustomerAccount(params: {
  uid: string;
  ownerEmail: string;
}): CustomerRecord {
  const record = customersByUid.get(params.uid);
  if (!record) {
    throw new Error('Customer account not found.');
  }
  record.deactivated = false;
  delete record.deactivatedReason;
  delete record.deactivatedAt;
  delete record.deactivatedBy;
  record.updatedAt = new Date().toISOString();
  indexCustomerRecord(record);
  persistCustomersToDisk();
  syncCustomerRecordToFirestore(record, true);
  return record;
}

export function deleteCustomerAccountPermanently(params: {
  uid: string;
}): { deletedUid: string; deletedName: string; deletedPhone?: string } {
  const uid = String(params.uid || '').trim();
  const record = customersByUid.get(uid);
  if (!record) {
    throw new Error('Customer account not found.');
  }
  if (isProtectedAdminIdentifier({ phone: record.phone, email: record.email, countryCode: record.countryCode })) {
    throw new Error(
      'Protected Platform Owner / Admin account (+254712727558 / nigideon36@gmail.com) cannot be deleted.'
    );
  }

  const deletedName = record.displayName || record.phone || uid;
  const deletedPhone = record.phone || undefined;

  customersByUid.delete(uid);
  if (record.phone) {
    if (uidByPhone.get(record.phone) === uid) {
      uidByPhone.delete(record.phone);
    }
    const norm = normalizeEastAfricaPhone(record.phone, record.countryCode || 'KE');
    if (norm && uidByPhone.get(norm) === uid) {
      uidByPhone.delete(norm);
    }
    bannedReasonsByKey.delete(`phone:${record.phone}`);
    if (norm) bannedReasonsByKey.delete(`phone:${norm}`);
  }
  if (record.email) {
    const cleanEmail = record.email.trim().toLowerCase();
    if (uidByEmail.get(cleanEmail) === uid) {
      uidByEmail.delete(cleanEmail);
    }
    bannedReasonsByKey.delete(`email:${cleanEmail}`);
  }
  bannedReasonsByKey.delete(`uid:${uid}`);

  persistCustomersToDisk();
  persistBannedStoreToDisk();

  if (adminDb) {
    try {
      adminDb.collection(FIRESTORE_CUSTOMER_COLLECTION).doc(uid).delete().catch(() => {});
      adminDb.collection('users').doc(uid).delete().catch(() => {});
    } catch {
      // non-blocking
    }
  }

  return { deletedUid: uid, deletedName, deletedPhone };
}

export function ownerUpdateCustomerRecord(
  uid: string,
  updates: {
    displayName?: string;
    phone?: string;
    countryCode?: string;
    email?: string;
    city?: string;
    bio?: string;
    phoneLocked?: boolean;
    phoneVerified?: boolean;
    withdrawalMethod?: string;
    withdrawalAccount?: string;
    withdrawalAccountHolder?: string;
    withdrawalLocked?: boolean;
    adminAssignedPass?: 'free' | 'starter' | 'pro' | 'vip' | null;
    reset2FA?: boolean;
  }
): CustomerRecord {
  const record = customersByUid.get(uid);
  if (!record) {
    throw new Error('Customer account not found.');
  }

  if (updates.countryCode && isEastAfricaCountryCode(updates.countryCode)) {
    record.countryCode = String(updates.countryCode).toUpperCase();
  }

  if (updates.displayName !== undefined) {
    const cleanName = String(updates.displayName || '').trim().slice(0, 120);
    if (cleanName.length >= 2) {
      record.displayName = cleanName;
    }
  }

  if (updates.phone !== undefined) {
    const rawPhone = String(updates.phone || '').trim();
    if (!rawPhone) {
      if (isProtectedAdminIdentifier({ phone: record.phone, email: record.email })) {
        throw new Error('Cannot clear protected admin phone number.');
      }
      if (record.phone) uidByPhone.delete(record.phone);
      record.phone = '';
      record.phoneLocked = false;
    } else {
      const normalized = normalizeEastAfricaPhone(rawPhone, record.countryCode);
      if (!isEastAfricaPhone(normalized)) {
        throw new Error('Enter a valid East Africa mobile number (+254, +256, +255, +250, +257, +211, +251, or +252).');
      }
      const existingOwner = uidByPhone.get(normalized);
      if (existingOwner && existingOwner !== uid) {
        throw new Error('That mobile number is already assigned to another customer account.');
      }
      if (record.phone && record.phone !== normalized) {
        uidByPhone.delete(record.phone);
      }
      record.phone = normalized;
      uidByPhone.set(normalized, uid);
      record.countryCode = inferCountryCodeFromPhone(normalized, record.countryCode);
    }
  }

  if (updates.email !== undefined) {
    const cleanEmail = String(updates.email || '').trim().toLowerCase();
    if (!cleanEmail) {
      if (record.email) uidByEmail.delete(record.email.toLowerCase());
      record.email = undefined;
    } else {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        throw new Error('Enter a valid email address or leave blank.');
      }
      const existingEmailOwner = uidByEmail.get(cleanEmail);
      if (existingEmailOwner && existingEmailOwner !== uid) {
        throw new Error('That email address belongs to another customer account.');
      }
      if (record.email && record.email.toLowerCase() !== cleanEmail) {
        uidByEmail.delete(record.email.toLowerCase());
      }
      record.email = cleanEmail;
      uidByEmail.set(cleanEmail, uid);
    }
  }

  if (updates.city !== undefined) {
    record.city = String(updates.city || '').trim().slice(0, 80) || undefined;
  }

  if (updates.bio !== undefined) {
    record.bio = String(updates.bio || '').trim().slice(0, 300) || undefined;
  }

  if (typeof updates.phoneLocked === 'boolean') {
    record.phoneLocked = updates.phoneLocked;
  }

  if (typeof updates.phoneVerified === 'boolean') {
    record.phoneVerified = updates.phoneVerified;
  }

  if (
    updates.withdrawalMethod !== undefined ||
    updates.withdrawalAccount !== undefined ||
    updates.withdrawalAccountHolder !== undefined
  ) {
    const methodToUse = updates.withdrawalMethod || record.withdrawalDetails?.method || 'M-PESA';
    const accountToUse = updates.withdrawalAccount ?? record.withdrawalDetails?.accountDetails ?? '';
    const holderToUse =
      updates.withdrawalAccountHolder ??
      record.withdrawalDetails?.accountHolderName ??
      record.displayName;
    if (String(accountToUse).trim()) {
      const validated = validateWithdrawalInput({
        method: methodToUse,
        accountDetails: String(accountToUse),
        accountHolderName: String(holderToUse),
        countryCode: record.countryCode,
      });
      record.withdrawalDetails = {
        method: validated.method,
        accountDetails: validated.accountDetails,
        accountHolderName: validated.accountHolderName || record.displayName,
        locked:
          typeof updates.withdrawalLocked === 'boolean'
            ? updates.withdrawalLocked
            : record.withdrawalDetails?.locked ?? true,
        lockedAt: record.withdrawalDetails?.lockedAt || new Date().toISOString(),
      };
    }
  } else if (typeof updates.withdrawalLocked === 'boolean' && record.withdrawalDetails) {
    record.withdrawalDetails = {
      ...record.withdrawalDetails,
      locked: updates.withdrawalLocked,
    };
  }

  if (updates.adminAssignedPass !== undefined) {
    if (updates.adminAssignedPass === null) {
      delete record.adminAssignedPass;
    } else if (['free', 'starter', 'pro', 'vip'].includes(updates.adminAssignedPass)) {
      record.adminAssignedPass = updates.adminAssignedPass;
    }
  }

  if (updates.reset2FA) {
    record.twoFactorEnabled = false;
    record.twoFactorMethod = 'none';
    record.totpSecret = undefined;
    record.pendingTotpSecret = undefined;
  }

  record.updatedAt = new Date().toISOString();
  indexCustomerRecord(record);
  persistCustomersToDisk();
  syncCustomerRecordToFirestore(record, true);
  return record;
}

export function isIdentifierOrAccountBanned(params: {
  uid?: string;
  phone?: string;
  email?: string;
  countryCode?: string;
}): { banned: boolean; reason?: string } {
  if (isProtectedAdminIdentifier(params)) {
    return { banned: false };
  }
  if (params.uid) {
    const rec = customersByUid.get(params.uid);
    if (rec && isProtectedAdminIdentifier({ phone: rec.phone, email: rec.email, countryCode: rec.countryCode })) {
      return { banned: false };
    }
    if (rec?.banned) {
      return {
        banned: true,
        reason:
          rec.bannedReason ||
          'Permanently banned 🚫 forever (no second chance): failed manual M-PESA Worker Pass proof requirement.',
      };
    }
    const uidBan = bannedReasonsByKey.get(`uid:${params.uid}`);
    if (uidBan) return { banned: true, reason: uidBan };
  }
  if (params.phone) {
    const norm = normalizeEastAfricaPhone(params.phone, params.countryCode);
    const phoneBan = norm ? bannedReasonsByKey.get(`phone:${norm}`) : undefined;
    if (phoneBan) return { banned: true, reason: phoneBan };
  }
  if (params.email) {
    const clean = params.email.trim().toLowerCase();
    const emailBan = clean ? bannedReasonsByKey.get(`email:${clean}`) : undefined;
    if (emailBan) return { banned: true, reason: emailBan };
  }
  return { banned: false };
}

export function banCustomerPermanently(params: {
  uid?: string;
  phone?: string;
  senderPhone?: string;
  email?: string;
  countryCode?: string;
  ownerEmail: string;
  reason?: string;
}): CustomerRecord | null {
  if (isProtectedAdminIdentifier(params)) {
    throw new Error(
      'Protected Platform Owner / Admin number (+254712727558) or email (nigideon36@gmail.com) cannot be banned.'
    );
  }

  let target: CustomerRecord | undefined = params.uid
    ? customersByUid.get(params.uid)
    : undefined;
  if (!target && params.phone) {
    const norm = normalizeEastAfricaPhone(params.phone, params.countryCode);
    const matchedUid = norm ? uidByPhone.get(norm) : undefined;
    if (matchedUid) target = customersByUid.get(matchedUid);
  }
  if (!target && params.senderPhone) {
    const norm = normalizeEastAfricaPhone(params.senderPhone, params.countryCode);
    const matchedUid = norm ? uidByPhone.get(norm) : undefined;
    if (matchedUid) target = customersByUid.get(matchedUid);
  }
  if (!target && params.email) {
    const matchedUid = uidByEmail.get(params.email.trim().toLowerCase());
    if (matchedUid) target = customersByUid.get(matchedUid);
  }

  if (target && isProtectedAdminIdentifier({ phone: target.phone, email: target.email, countryCode: target.countryCode })) {
    throw new Error(
      'Protected Platform Owner / Admin number (+254712727558) or email (nigideon36@gmail.com) cannot be banned.'
    );
  }

  const cleanReason =
    String(params.reason || '').trim().slice(0, 240) ||
    'Failed to submit valid M-PESA code & screenshot proof for manual Worker Pass payment.';
  const now = new Date().toISOString();

  if (params.uid) bannedReasonsByKey.set(`uid:${params.uid}`, cleanReason);
  if (params.phone) {
    const norm = normalizeEastAfricaPhone(params.phone, params.countryCode);
    if (norm) bannedReasonsByKey.set(`phone:${norm}`, cleanReason);
  }
  if (params.senderPhone) {
    const normSender = normalizeEastAfricaPhone(params.senderPhone, params.countryCode);
    if (normSender) bannedReasonsByKey.set(`phone:${normSender}`, cleanReason);
  }
  if (params.email) {
    const cleanEmail = params.email.trim().toLowerCase();
    if (cleanEmail) bannedReasonsByKey.set(`email:${cleanEmail}`, cleanReason);
  }
  persistBannedStoreToDisk();

  if (target) {
    target.banned = true;
    target.bannedReason = cleanReason;
    target.bannedAt = now;
    target.bannedBy = params.ownerEmail;
    saveCustomerRecord(target);
    return target;
  }

  return null;
}

export function unbanCustomerByOwner(params: {
  uid?: string;
  phone?: string;
  email?: string;
  countryCode?: string;
  ownerEmail: string;
}): {
  unbannedCustomer: CustomerRecord | null;
  clearedKeys: string[];
  normalizedPhone?: string;
} {
  const clearedKeys: string[] = [];
  const rawPhone = params.phone ? String(params.phone).trim() : '';
  const normPhone = rawPhone ? normalizeEastAfricaPhone(rawPhone, params.countryCode || 'KE') : '';
  const cleanEmail = params.email ? params.email.trim().toLowerCase() : '';

  let target: CustomerRecord | undefined = params.uid ? customersByUid.get(params.uid) : undefined;
  if (!target && normPhone) {
    const matchedUid = uidByPhone.get(normPhone);
    if (matchedUid) target = customersByUid.get(matchedUid);
  }
  if (!target && cleanEmail) {
    const matchedUid = uidByEmail.get(cleanEmail);
    if (matchedUid) target = customersByUid.get(matchedUid);
  }
  if (!target && normPhone) {
    for (const rec of customersByUid.values()) {
      const recNorm = rec.phone ? normalizeEastAfricaPhone(rec.phone, rec.countryCode || 'KE') : '';
      if (recNorm === normPhone) {
        target = rec;
        break;
      }
    }
  }

  const keysToDelete = new Set<string>();
  if (params.uid) keysToDelete.add(`uid:${params.uid}`);
  if (normPhone) {
    keysToDelete.add(`phone:${normPhone}`);
    keysToDelete.add(`phone:${normPhone.replace(/^\+/, '')}`);
    if (normPhone.startsWith('+254')) {
      keysToDelete.add(`phone:0${normPhone.slice(4)}`);
    }
  }
  if (rawPhone) keysToDelete.add(`phone:${rawPhone}`);
  if (cleanEmail) keysToDelete.add(`email:${cleanEmail}`);

  if (target) {
    keysToDelete.add(`uid:${target.uid}`);
    if (target.phone) {
      const targetNorm = normalizeEastAfricaPhone(target.phone, target.countryCode || 'KE');
      keysToDelete.add(`phone:${target.phone}`);
      if (targetNorm) keysToDelete.add(`phone:${targetNorm}`);
    }
    if (target.email) {
      keysToDelete.add(`email:${target.email.trim().toLowerCase()}`);
    }
  }

  for (const key of keysToDelete) {
    if (bannedReasonsByKey.delete(key)) {
      clearedKeys.push(key);
    }
  }
  persistBannedStoreToDisk();

  if (target) {
    target.banned = false;
    delete target.bannedReason;
    delete target.bannedAt;
    delete target.bannedBy;
    target.updatedAt = new Date().toISOString();
    indexCustomerRecord(target);
    persistCustomersToDisk();
    syncCustomerRecordToFirestore(target, true);
    return {
      unbannedCustomer: target,
      clearedKeys,
      normalizedPhone: normPhone || target.phone || undefined,
    };
  }

  return {
    unbannedCustomer: null,
    clearedKeys,
    normalizedPhone: normPhone || undefined,
  };
}

// --- Signed Session & 2FA Challenge Tokens (30-day ease-login session) ---
interface TokenPayload {
  sub: string;
  kind: 'session' | '2fa-challenge';
  phone: string;
  email?: string;
  name?: string;
  exp: number;
}

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function base64UrlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4);
  return Buffer.from(padded, 'base64');
}

export function signCustomerToken(
  record: CustomerRecord,
  kind: 'session' | '2fa-challenge' = 'session',
  ttlSeconds = kind === 'session' ? 60 * 60 * 24 * 30 : 60 * 10
): string {
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'CUST' }));
  const payloadObj: TokenPayload = {
    sub: record.uid,
    kind,
    phone: record.phone,
    email: record.email,
    name: record.displayName,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const payload = base64UrlEncode(JSON.stringify(payloadObj));
  const sig = base64UrlEncode(
    crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest()
  );
  return `${header}.${payload}.${sig}`;
}

export function verifyCustomerToken(
  token: string,
  expectedKind: 'session' | '2fa-challenge' = 'session'
): TokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const expectedSig = base64UrlEncode(
      crypto.createHmac('sha256', SESSION_SECRET).update(`${header}.${payload}`).digest()
    );
    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }
    const decoded = JSON.parse(base64UrlDecode(payload).toString('utf8')) as TokenPayload;
    if (decoded.kind !== expectedKind) return null;
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

// --- RFC 6238 TOTP Authenticator App Helpers ---
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(byteLength = 20): string {
  const bytes = crypto.randomBytes(byteLength);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpCode(secret: string, counterOffset = 0): string {
  const key = decodeBase32(secret);
  const counter = Math.floor(Date.now() / 1000 / 30) + counterOffset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

export function verifyTotpCode(secret: string, inputCode: string): boolean {
  const cleanCode = String(inputCode || '').trim().replace(/\s+/g, '');
  if (!/^\d{6}$/.test(cleanCode)) return false;
  for (const offset of [-1, 0, 1]) {
    if (generateTotpCode(secret, offset) === cleanCode) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(accountLabel: string, secret: string): string {
  const issuer = 'Gideon Global Tasks';
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(accountLabel)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

// --- SMS OTP Generation & Delivery (Africa's Talking / TextSMS / Twilio / Instant Fallback) ---
export async function sendSmsOtp(
  phone: string,
  purpose: OtpEntry['purpose']
): Promise<{
  sent: boolean;
  carrierDelivered: boolean;
  deliveryMode: 'africastalking' | 'textsms' | 'twilio' | 'instant-fallback';
  providerLabel: string;
  carrierMessageId?: string;
  fallbackReason?: string;
  previewCode?: string;
  maskedPhone: string;
}> {
  const code = String(crypto.randomInt(100000, 999999));
  const key = `${purpose}:${phone}`;
  smsOtpStore.set(key, {
    code,
    expiresAt: Date.now() + 10 * 60 * 1000,
    purpose,
    attempts: 0,
  });
  persistOtpStoreToDisk();

  const masked = maskPhone(phone);
  const message = `Gideon Global Tasks verification code: ${code}. Valid for 10 minutes. Do not share this code.`;

  const dispatch = await dispatchSmsViaGateway(phone, message, masked, purpose);

  return {
    sent: true,
    carrierDelivered: dispatch.carrierDelivered,
    deliveryMode: dispatch.deliveryMode,
    providerLabel: dispatch.providerLabel,
    carrierMessageId: dispatch.carrierMessageId,
    fallbackReason: dispatch.fallbackReason,
    ...(!dispatch.carrierDelivered ? { previewCode: code } : {}),
    maskedPhone: masked,
  };
}

export function verifySmsOtp(
  phone: string,
  purpose: OtpEntry['purpose'],
  inputCode: string
): boolean {
  const key = `${purpose}:${phone}`;
  let entry = smsOtpStore.get(key);
  if (!entry) {
    loadOtpStoreFromDisk();
    entry = smsOtpStore.get(key);
  }
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    smsOtpStore.delete(key);
    persistOtpStoreToDisk();
    return false;
  }
  entry.attempts += 1;
  if (entry.attempts > 6) {
    smsOtpStore.delete(key);
    persistOtpStoreToDisk();
    return false;
  }
  const clean = String(inputCode || '').trim();
  if (clean === entry.code) {
    smsOtpStore.delete(key);
    persistOtpStoreToDisk();
    return true;
  }
  persistOtpStoreToDisk();
  return false;
}
