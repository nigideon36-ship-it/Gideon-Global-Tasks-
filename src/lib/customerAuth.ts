import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { EAST_AFRICA_COUNTRIES, isEastAfricaCountryCode, isEastAfricaPhone } from './eastAfrica.ts';

export interface CustomerRecord {
  uid: string;
  phone: string;
  countryCode: string;
  email?: string;
  displayName: string;
  passwordHash: string;
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  totpSecret?: string;
  pendingTotpSecret?: string;
  phoneVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicCustomerProfile {
  uid: string;
  phone: string;
  countryCode: string;
  email?: string;
  displayName: string;
  role: 'customer';
  twoFactorEnabled: boolean;
  twoFactorMethod: 'none' | 'sms' | 'totp';
  phoneVerified: boolean;
  createdAt: string;
}

interface OtpEntry {
  code: string;
  expiresAt: number;
  purpose: 'login-2fa' | 'enable-sms-2fa' | 'register';
  attempts: number;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CUSTOMERS_FILE = path.join(DATA_DIR, 'customers.json');
const SESSION_SECRET =
  process.env.CUSTOMER_AUTH_SECRET ||
  process.env.PAYSTACK_SECRET_KEY ||
  'gideon-global-east-africa-customer-auth-secret-v1';

const customersByUid = new Map<string, CustomerRecord>();
const uidByPhone = new Map<string, string>();
const smsOtpStore = new Map<string, OtpEntry>();

function loadCustomersFromDisk() {
  try {
    if (!fs.existsSync(CUSTOMERS_FILE)) return;
    const raw = fs.readFileSync(CUSTOMERS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const rec of parsed) {
        if (rec && rec.uid && rec.phone) {
          customersByUid.set(rec.uid, rec);
          uidByPhone.set(rec.phone, rec.uid);
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

loadCustomersFromDisk();

export function normalizeEastAfricaPhone(rawPhone: string, countryCode?: string): string {
  const cleaned = String(rawPhone || '').trim().replace(/[\s\-()]/g, '');
  if (!cleaned) return '';
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  const dialMap = new Map(EAST_AFRICA_COUNTRIES.map((c) => [c.code, c.dialCode]));
  const selectedDial = (countryCode && dialMap.get(countryCode.toUpperCase() as any)) || '+254';
  if (cleaned.startsWith('0')) {
    return `${selectedDial}${cleaned.slice(1)}`;
  }
  if (/^(254|256|255|250|257|211|251|252)\d{6,}$/.test(cleaned)) {
    return `+${cleaned}`;
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
    countryCode: rec.countryCode,
    email: rec.email,
    displayName: rec.displayName,
    role: 'customer',
    twoFactorEnabled: rec.twoFactorEnabled,
    twoFactorMethod: rec.twoFactorMethod,
    phoneVerified: rec.phoneVerified,
    createdAt: rec.createdAt,
  };
}

export function getCustomerByPhone(rawPhone: string, countryCode?: string): CustomerRecord | null {
  const normalized = normalizeEastAfricaPhone(rawPhone, countryCode);
  const uid = uidByPhone.get(normalized);
  if (!uid) return null;
  return customersByUid.get(uid) || null;
}

export function getCustomerByUid(uid: string): CustomerRecord | null {
  return customersByUid.get(uid) || null;
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
  if (uidByPhone.has(normalizedPhone)) {
    throw new Error('This mobile number is already registered. Please sign in instead.');
  }

  const trimmedEmail = params.email ? params.email.trim().toLowerCase() : undefined;
  if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    throw new Error('Please enter a valid email address or leave email blank.');
  }
  if (trimmedEmail === 'nigideon36@gmail.com') {
    throw new Error('Owner email must sign in directly via Google Auth.');
  }
  if (!params.password || params.password.length < 6) {
    throw new Error('Password / PIN must be at least 6 characters.');
  }

  return { normalizedPhone, trimmedEmail };
}

export function registerCustomerAccount(params: {
  phone: string;
  countryCode?: string;
  email?: string;
  displayName?: string;
  password: string;
  phoneVerified?: boolean;
}): CustomerRecord {
  const { normalizedPhone, trimmedEmail } = validateRegistrationInputs(params);

  const resolvedCountry = inferCountryCodeFromPhone(normalizedPhone, params.countryCode);
  const cleanName =
    (params.displayName || '').trim().slice(0, 120) ||
    `Contributor ${normalizedPhone.slice(-4)}`;
  const now = new Date().toISOString();
  const uid = `cust_${crypto.randomBytes(10).toString('hex')}`;

  const record: CustomerRecord = {
    uid,
    phone: normalizedPhone,
    countryCode: resolvedCountry,
    email: trimmedEmail || undefined,
    displayName: cleanName,
    passwordHash: hashPassword(params.password),
    twoFactorEnabled: false,
    twoFactorMethod: 'none',
    phoneVerified: Boolean(params.phoneVerified),
    createdAt: now,
    updatedAt: now,
  };

  customersByUid.set(uid, record);
  uidByPhone.set(normalizedPhone, uid);
  persistCustomersToDisk();
  return record;
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
  const now = new Date().toISOString();

  if (existing) {
    if (normalizedPhone && normalizedPhone !== existing.phone) {
      if (existing.phone) uidByPhone.delete(existing.phone);
      existing.phone = normalizedPhone;
      uidByPhone.set(normalizedPhone, existing.uid);
    }
    if (params.countryCode && isEastAfricaCountryCode(params.countryCode)) {
      existing.countryCode = params.countryCode.toUpperCase();
    }
    existing.updatedAt = now;
    persistCustomersToDisk();
    return existing;
  }

  const record: CustomerRecord = {
    uid: params.uid,
    phone: normalizedPhone,
    countryCode: isEastAfricaCountryCode(params.countryCode) ? String(params.countryCode).toUpperCase() : 'KE',
    email: params.email,
    displayName: params.displayName || params.email?.split('@')[0] || 'Contributor',
    passwordHash: '',
    twoFactorEnabled: false,
    twoFactorMethod: 'none',
    phoneVerified: false,
    createdAt: now,
    updatedAt: now,
  };
  customersByUid.set(params.uid, record);
  if (normalizedPhone) uidByPhone.set(normalizedPhone, params.uid);
  persistCustomersToDisk();
  return record;
}

export function saveCustomerRecord(record: CustomerRecord): void {
  record.updatedAt = new Date().toISOString();
  customersByUid.set(record.uid, record);
  if (record.phone) {
    uidByPhone.set(record.phone, record.uid);
  }
  persistCustomersToDisk();
}

// --- Signed Session & 2FA Challenge Tokens ---
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
  ttlSeconds = kind === 'session' ? 60 * 60 * 24 * 14 : 60 * 10
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

// --- SMS OTP Generation & Delivery (Africa's Talking / Twilio / Preview) ---
export async function sendSmsOtp(
  phone: string,
  purpose: OtpEntry['purpose']
): Promise<{
  sent: boolean;
  deliveryMode: 'africastalking' | 'twilio' | 'preview';
  previewCode?: string;
  maskedPhone: string;
}> {
  const code = String(crypto.randomInt(100000, 999999));
  const key = `${purpose}:${phone}`;
  smsOtpStore.set(key, {
    code,
    expiresAt: Date.now() + 5 * 60 * 1000,
    purpose,
    attempts: 0,
  });

  const message = `Gideon Global Tasks verification code: ${code}. Valid for 5 minutes. Do not share this code.`;

  // 1. Africa's Talking (East Africa SMS Gateway) if configured
  const atKey = process.env.AT_API_KEY;
  const atUser = process.env.AT_USERNAME;
  if (atKey && atUser) {
    try {
      const endpoint =
        atUser === 'sandbox'
          ? 'https://api.sandbox.africastalking.com/version1/messaging'
          : 'https://api.africastalking.com/version1/messaging';
      const body = new URLSearchParams({
        username: atUser,
        to: phone,
        message,
      });
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          apiKey: atKey,
          Accept: 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });
      if (resp.ok) {
        return { sent: true, deliveryMode: 'africastalking', maskedPhone: maskPhone(phone) };
      }
    } catch (err) {
      console.warn('Africa\'s Talking SMS fallback triggered:', (err as Error)?.message || err);
    }
  }

  // 2. Twilio SMS if configured
  const twSid = process.env.TWILIO_ACCOUNT_SID;
  const twToken = process.env.TWILIO_AUTH_TOKEN;
  const twFrom = process.env.TWILIO_FROM_NUMBER;
  if (twSid && twToken && twFrom) {
    try {
      const auth = Buffer.from(`${twSid}:${twToken}`).toString('base64');
      const body = new URLSearchParams({
        To: phone,
        From: twFrom,
        Body: message,
      });
      const resp = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${twSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: body.toString(),
        }
      );
      if (resp.ok) {
        return { sent: true, deliveryMode: 'twilio', maskedPhone: maskPhone(phone) };
      }
    } catch (err) {
      console.warn('Twilio SMS fallback triggered:', (err as Error)?.message || err);
    }
  }

  // 3. Preview / Test mode when carrier API keys are not yet configured in environment
  return {
    sent: true,
    deliveryMode: 'preview',
    previewCode: code,
    maskedPhone: maskPhone(phone),
  };
}

export function verifySmsOtp(
  phone: string,
  purpose: OtpEntry['purpose'],
  inputCode: string
): boolean {
  const key = `${purpose}:${phone}`;
  const entry = smsOtpStore.get(key);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    smsOtpStore.delete(key);
    return false;
  }
  entry.attempts += 1;
  if (entry.attempts > 5) {
    smsOtpStore.delete(key);
    return false;
  }
  const clean = String(inputCode || '').trim();
  if (clean === entry.code) {
    smsOtpStore.delete(key);
    return true;
  }
  return false;
}
