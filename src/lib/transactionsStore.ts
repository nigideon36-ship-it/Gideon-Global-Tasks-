import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export type TransactionKind =
  | 'withdrawal'
  | 'pass_purchase'
  | 'task_reward'
  | 'referral_commission';

export interface PlatformTransaction {
  id: string;
  kind: TransactionKind;
  title: string;
  customerLabel: string;
  gatewayOrMethod: string;
  currency: string;
  amountLocal?: number;
  amountUsd: number;
  status: 'Completed' | 'Processing' | 'Pending' | 'Rejected' | 'Failed';
  reference: string;
  countryCode: string;
  metadata?: Record<string, string | number | boolean | undefined>;
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const TRANSACTIONS_FILE = path.join(DATA_DIR, 'transactions.json');
const transactionsById = new Map<string, PlatformTransaction>();

function loadTransactionsFromDisk() {
  try {
    if (!fs.existsSync(TRANSACTIONS_FILE)) return;
    const raw = fs.readFileSync(TRANSACTIONS_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      for (const rec of parsed) {
        if (rec && rec.id) {
          transactionsById.set(rec.id, rec);
        }
      }
    }
  } catch (err) {
    console.warn('Could not load transactions store:', (err as Error)?.message || err);
  }
}

function persistTransactionsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const records = Array.from(transactionsById.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 1000);
    fs.writeFileSync(TRANSACTIONS_FILE, JSON.stringify(records, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist transactions store:', (err as Error)?.message || err);
  }
}

loadTransactionsFromDisk();

export function upsertPlatformTransaction(input: {
  id?: string;
  kind: TransactionKind;
  title: string;
  customerLabel: string;
  gatewayOrMethod: string;
  currency?: string;
  amountLocal?: number;
  amountUsd: number;
  status: PlatformTransaction['status'];
  reference?: string;
  countryCode?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}): PlatformTransaction {
  const now = new Date().toISOString();
  const id =
    (input.id && String(input.id).trim().slice(0, 80)) ||
    `TXN-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

  const existing = transactionsById.get(id);
  const record: PlatformTransaction = {
    id,
    kind: input.kind,
    title: String(input.title || 'Platform Transaction').slice(0, 180),
    customerLabel: String(input.customerLabel || 'Contributor').slice(0, 140),
    gatewayOrMethod: String(input.gatewayOrMethod || 'Platform').slice(0, 80),
    currency: String(input.currency || 'USD').toUpperCase().slice(0, 8),
    amountLocal: typeof input.amountLocal === 'number' && Number.isFinite(input.amountLocal)
      ? +input.amountLocal.toFixed(2)
      : existing?.amountLocal,
    amountUsd: Number.isFinite(Number(input.amountUsd)) ? +Number(input.amountUsd).toFixed(2) : 0,
    status: input.status,
    reference: String(input.reference || existing?.reference || id).slice(0, 120),
    countryCode: String(input.countryCode || existing?.countryCode || 'KE').toUpperCase().slice(0, 4),
    metadata: { ...(existing?.metadata || {}), ...(input.metadata || {}) },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  transactionsById.set(id, record);
  persistTransactionsToDisk();
  return record;
}

export function listAllPlatformTransactions(): PlatformTransaction[] {
  return Array.from(transactionsById.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
