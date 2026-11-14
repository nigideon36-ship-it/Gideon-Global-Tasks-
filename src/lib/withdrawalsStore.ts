import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type WithdrawalMethod =
  | 'M-PESA'
  | 'Airtel / MTN MoMo'
  | 'East Africa Bank'
  | 'Wise'
  | 'Crypto USDT';

export type WithdrawalStatus = 'Processing' | 'Completed' | 'Rejected';

export interface WithdrawalRecord {
  id: string;
  userUid: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  countryCode: string;
  amountUsd: number;
  method: WithdrawalMethod;
  accountDetails: string;
  status: WithdrawalStatus;
  mpesaReceipt?: string;
  disbursementChannel?: string;
  approvedBy?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const WITHDRAWALS_FILE = path.join(DATA_DIR, 'withdrawals.json');
const withdrawalsById = new Map<string, WithdrawalRecord>();

function loadWithdrawalsFromDisk() {
  try {
    if (!fs.existsSync(WITHDRAWALS_FILE)) return;
    const raw = fs.readFileSync(WITHDRAWALS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const rec of parsed) {
        if (rec && rec.id) {
          withdrawalsById.set(rec.id, rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load withdrawals store:', (err as Error)?.message || err);
  }
}

function persistWithdrawalsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const records = Array.from(withdrawalsById.values()).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    fs.writeFileSync(WITHDRAWALS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist withdrawals store:', (err as Error)?.message || err);
  }
}

loadWithdrawalsFromDisk();

const VALID_METHODS = new Set<WithdrawalMethod>([
  'M-PESA',
  'Airtel / MTN MoMo',
  'East Africa Bank',
  'Wise',
  'Crypto USDT',
]);

export function createWithdrawalRequest(params: {
  id?: string;
  userUid: string;
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  countryCode?: string;
  amountUsd: number;
  method: string;
  accountDetails: string;
  mpesaReceipt?: string;
}): WithdrawalRecord {
  const amount = Number(params.amountUsd);
  if (!Number.isFinite(amount) || amount < 20) {
    throw new Error('Minimum withdrawal threshold is $20.00.');
  }
  const method = params.method as WithdrawalMethod;
  if (!VALID_METHODS.has(method)) {
    throw new Error('Unsupported payout method.');
  }
  const details = String(params.accountDetails || '').trim().slice(0, 200);
  if (details.length < 3) {
    throw new Error('Please provide valid payout account or mobile money details.');
  }

  const now = new Date().toISOString();
  const id =
    (params.id && /^PAY-[A-Z0-9_-]{3,32}$/i.test(params.id) && params.id) ||
    `PAY-${crypto.randomInt(1000, 9999)}${crypto.randomBytes(1).toString('hex').toUpperCase()}`;

  const already = withdrawalsById.get(id);
  if (already) {
    return already;
  }

  const record: WithdrawalRecord = {
    id,
    userUid: String(params.userUid || 'guest').slice(0, 128),
    customerPhone: params.customerPhone ? String(params.customerPhone).slice(0, 40) : undefined,
    customerEmail: params.customerEmail ? String(params.customerEmail).slice(0, 160) : undefined,
    customerName: params.customerName ? String(params.customerName).slice(0, 120) : undefined,
    countryCode: String(params.countryCode || 'KE').toUpperCase().slice(0, 4),
    amountUsd: +amount.toFixed(2),
    method,
    accountDetails: details,
    status: 'Processing',
    mpesaReceipt: params.mpesaReceipt,
    createdAt: now,
    updatedAt: now,
  };

  withdrawalsById.set(record.id, record);
  persistWithdrawalsToDisk();
  return record;
}

export function listAllWithdrawals(): WithdrawalRecord[] {
  return Array.from(withdrawalsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function listCustomerWithdrawals(userUid: string): WithdrawalRecord[] {
  return listAllWithdrawals().filter((w) => w.userUid === userUid);
}

export function approveWithdrawalRequest(params: {
  id: string;
  ownerEmail: string;
  receiptCode?: string;
  disbursementChannel?: string;
}): WithdrawalRecord {
  const existing = withdrawalsById.get(params.id);
  if (!existing) {
    throw new Error('Withdrawal request not found.');
  }
  if (existing.status === 'Completed') {
    return existing;
  }
  if (existing.status === 'Rejected') {
    throw new Error('Rejected withdrawals cannot be approved.');
  }

  existing.status = 'Completed';
  existing.approvedBy = params.ownerEmail;
  existing.disbursementChannel = params.disbursementChannel || existing.method;
  existing.mpesaReceipt =
    (params.receiptCode || '').trim() ||
    existing.mpesaReceipt ||
    `MP${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  existing.updatedAt = new Date().toISOString();

  withdrawalsById.set(existing.id, existing);
  persistWithdrawalsToDisk();
  return existing;
}

export function rejectWithdrawalRequest(params: {
  id: string;
  ownerEmail: string;
  reason?: string;
}): WithdrawalRecord {
  const existing = withdrawalsById.get(params.id);
  if (!existing) {
    throw new Error('Withdrawal request not found.');
  }
  if (existing.status === 'Completed') {
    throw new Error('Completed withdrawals cannot be rejected.');
  }

  existing.status = 'Rejected';
  existing.approvedBy = params.ownerEmail;
  existing.rejectionReason =
    (params.reason || '').trim().slice(0, 200) || 'Declined by Platform Owner after verification audit.';
  existing.updatedAt = new Date().toISOString();

  withdrawalsById.set(existing.id, existing);
  persistWithdrawalsToDisk();
  return existing;
}
