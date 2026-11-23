import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import { adminDb } from './firebase-admin.ts';
import { KES_PER_USD } from './eastAfrica.ts';
import { resolvePlatformOrigin } from '../utils/platformUrl.ts';

export type TaskAlertFrequency = 'instant' | 'daily_digest';

export interface TaskAlertSubscription {
  id: string;
  userUid: string;
  email: string;
  categories: string[]; // ['all'] or TaskCategory values
  minRewardKes: number;
  frequency: TaskAlertFrequency;
  active: boolean;
  matchCount: number;
  lastNotifiedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskAlertDispatch {
  id: string;
  subscriptionId: string;
  userUid: string;
  emailMasked: string;
  taskId: string;
  taskTitle: string;
  taskCategory: string;
  taskRewardKes: number;
  taskRewardUsd: number;
  deliveryChannel: 'SMTP Email' | 'In-App Alert Feed';
  deliveryStatus: 'Sent' | 'Queued' | 'Failed';
  deliveryNote: string;
  createdAt: string;
}

interface PersistedTaskAlertsState {
  subscriptions: TaskAlertSubscription[];
  dispatches: TaskAlertDispatch[];
}

const VALID_ALERT_CATEGORIES = new Set([
  'all',
  'creator-campaign',
  'survey',
  'annotation',
  'data-entry',
  'writing',
  'meme-content',
  'micro',
]);

const DATA_DIR = path.resolve(process.cwd(), '.data');
const ALERTS_FILE = path.join(DATA_DIR, 'task-alerts.json');
const COLLECTION_NAME = 'task_alert_subscriptions';

const subscriptionsById = new Map<string, TaskAlertSubscription>();
const dispatches: TaskAlertDispatch[] = [];

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  const vis = local.slice(0, Math.min(2, local.length));
  return `${vis}***@${domain}`;
}

function persistAlertsToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const payload: PersistedTaskAlertsState = {
      subscriptions: Array.from(subscriptionsById.values()).sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      ),
      dispatches: dispatches.slice(0, 200),
    };
    fs.writeFileSync(ALERTS_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist task alerts:', (err as Error)?.message || err);
  }
}

function loadAlertsFromDisk() {
  try {
    if (!fs.existsSync(ALERTS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(ALERTS_FILE, 'utf8')) as PersistedTaskAlertsState;
    if (Array.isArray(raw?.subscriptions)) {
      for (const s of raw.subscriptions) {
        if (s?.id && s?.email) {
          subscriptionsById.set(s.id, s);
        }
      }
    }
    if (Array.isArray(raw?.dispatches)) {
      dispatches.push(...raw.dispatches.slice(0, 200));
    }
  } catch (err) {
    console.warn('Could not load task alerts:', (err as Error)?.message || err);
  }
}

loadAlertsFromDisk();

function syncSubscriptionToFirestore(sub: TaskAlertSubscription) {
  if (!adminDb) return;
  try {
    adminDb
      .collection(COLLECTION_NAME)
      .doc(sub.id)
      .set(JSON.parse(JSON.stringify(sub)), { merge: true })
      .catch(() => {});
  } catch {}
}

export function isValidAlertEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim()) && email.trim().length <= 200;
}

export function sanitizeCategories(input: unknown): string[] {
  if (!Array.isArray(input) || input.length === 0) return ['all'];
  const cleaned = Array.from(
    new Set(
      input
        .map((c) => String(c || '').trim().toLowerCase())
        .filter((c) => VALID_ALERT_CATEGORIES.has(c))
    )
  ).slice(0, 10);
  if (cleaned.length === 0 || cleaned.includes('all')) return ['all'];
  return cleaned;
}

export function upsertTaskAlertSubscription(params: {
  userUid: string;
  email: string;
  categories?: unknown;
  minRewardKes?: number;
  frequency?: TaskAlertFrequency;
  active?: boolean;
}): TaskAlertSubscription {
  const email = String(params.email || '').trim().toLowerCase();
  if (!isValidAlertEmail(email)) {
    throw new Error('Please enter a valid email address for high-reward task notifications.');
  }

  const minRewardKes = Math.min(
    10000,
    Math.max(10, Math.round(Number(params.minRewardKes) || 40))
  );
  const categories = sanitizeCategories(params.categories);
  const frequency: TaskAlertFrequency =
    params.frequency === 'daily_digest' ? 'daily_digest' : 'instant';
  const active = params.active !== false;

  const existing = Array.from(subscriptionsById.values()).find(
    (s) => s.userUid === params.userUid || s.email.toLowerCase() === email
  );

  const now = new Date().toISOString();
  const sub: TaskAlertSubscription = existing
    ? {
        ...existing,
        userUid: params.userUid,
        email,
        categories,
        minRewardKes,
        frequency,
        active,
        updatedAt: now,
      }
    : {
        id: `ALRT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
        userUid: params.userUid,
        email,
        categories,
        minRewardKes,
        frequency,
        active,
        matchCount: 0,
        createdAt: now,
        updatedAt: now,
      };

  subscriptionsById.set(sub.id, sub);
  persistAlertsToDisk();
  syncSubscriptionToFirestore(sub);
  return sub;
}

export function getTaskAlertsForUser(uid: string, email?: string | null) {
  const lowerEmail = email?.trim().toLowerCase() || '';
  const userSubs = Array.from(subscriptionsById.values()).filter(
    (s) => s.userUid === uid || (lowerEmail && s.email.toLowerCase() === lowerEmail)
  );
  const subIds = new Set(userSubs.map((s) => s.id));
  const userDispatches = dispatches
    .filter((d) => d.userUid === uid || subIds.has(d.subscriptionId))
    .slice(0, 25);

  return {
    subscription: userSubs[0] || null,
    subscriptions: userSubs,
    dispatches: userDispatches,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
  };
}

export function deleteTaskAlertSubscription(id: string, uid: string, isOwner: boolean): boolean {
  const sub = subscriptionsById.get(id);
  if (!sub) return false;
  if (!isOwner && sub.userUid !== uid) {
    throw new Error('You may only remove your own task alert subscription.');
  }
  subscriptionsById.delete(id);
  persistAlertsToDisk();
  if (adminDb) {
    try {
      adminDb.collection(COLLECTION_NAME).doc(id).delete().catch(() => {});
    } catch {}
  }
  return true;
}

export function listAllTaskAlertsForOwner() {
  const subs = Array.from(subscriptionsById.values())
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .map((s) => ({
      id: s.id,
      userUid: s.userUid,
      emailMasked: maskEmail(s.email),
      categories: s.categories,
      minRewardKes: s.minRewardKes,
      frequency: s.frequency,
      active: s.active,
      matchCount: s.matchCount,
      lastNotifiedAt: s.lastNotifiedAt,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

  return {
    activeCount: subs.filter((s) => s.active).length,
    totalCount: subs.length,
    smtpConfigured: Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
    subscriptions: subs,
    recentDispatches: dispatches.slice(0, 50),
  };
}

export function hydrateTaskAlertFromClient(sub: TaskAlertSubscription) {
  if (!sub?.id || !sub?.userUid || !sub?.email) return;
  if (!isValidAlertEmail(sub.email)) return;
  const existing = subscriptionsById.get(sub.id);
  if (!existing || (sub.updatedAt || '') > existing.updatedAt) {
    subscriptionsById.set(sub.id, {
      ...sub,
      categories: sanitizeCategories(sub.categories),
      minRewardKes: Math.min(10000, Math.max(10, Number(sub.minRewardKes) || 40)),
    });
    persistAlertsToDisk();
  }
}

async function sendSmtpTaskEmail(
  sub: TaskAlertSubscription,
  task: { id: string; title: string; category: string; rewardUsd: number; rewardKes: number; description: string }
): Promise<{ sent: boolean; note: string }> {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  if (!host || !user || !pass) {
    return {
      sent: false,
      note: 'SMTP gateway not configured in env — delivered to live subscriber alert feed.',
    };
  }

  const port = Number(process.env.SMTP_PORT) || 587;
  const from = process.env.SMTP_FROM?.trim() || `"Gideon Global Tasks" <${user}>`;
  const appUrl = resolvePlatformOrigin(process.env.APP_URL);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const subject = `High-Reward Task Alert (${task.rewardKes} KSh): ${task.title}`;
  const text = [
    `Hello Contributor,`,
    ``,
    `A new high-reward task matching your alert preferences has been posted on Gideon Global Tasks:`,
    `Title: ${task.title}`,
    `Category: ${task.category}`,
    `Reward: ${task.rewardKes} KSh (~$${task.rewardUsd.toFixed(2)} USD equivalent)`,
    ``,
    `${task.description}`,
    ``,
    `Open Marketplace: ${appUrl}`,
    `To update your alert settings, visit the Task Marketplace alert banner.`,
  ].join('\n');

  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px;border:1px solid #e2e8f0;border-radius:12px;">
      <h2 style="color:#1e3a8a;margin:0 0 12px;">New High-Reward Task Posted</h2>
      <p style="color:#334155;font-size:14px;line-height:1.6;">
        A new task matching your <strong>${sub.categories.join(', ')}</strong> interest and minimum reward of <strong>${sub.minRewardKes} KSh</strong> is now live:
      </p>
      <div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:10px;padding:16px;margin:16px 0;">
        <div style="font-size:16px;font-weight:700;color:#0f172a;">${task.title}</div>
        <div style="font-size:13px;color:#059669;font-weight:700;margin-top:6px;">Reward: ${task.rewardKes} KSh · Category: ${task.category}</div>
        <p style="font-size:13px;color:#475569;margin-top:8px;">${task.description}</p>
      </div>
      <a href="${appUrl}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;">
        View Task on Marketplace
      </a>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: sub.email,
    subject,
    text,
    html,
  });

  return {
    sent: true,
    note: `Email dispatched via ${host} to ${maskEmail(sub.email)}.`,
  };
}

export async function dispatchAlertsForNewTask(task: {
  id: string;
  title: string;
  category: string;
  reward: number;
  description?: string;
}): Promise<{ matchedCount: number; emailedCount: number; queuedCount: number; dispatches: TaskAlertDispatch[] }> {
  const rewardUsd = Math.max(0, Number(task.reward) || 0);
  const rewardKes = Math.round(rewardUsd * KES_PER_USD);
  const categoryLower = String(task.category || 'micro').trim().toLowerCase();

  const matchingSubs = Array.from(subscriptionsById.values()).filter((sub) => {
    if (!sub.active) return false;
    if (rewardKes < sub.minRewardKes) return false;
    if (sub.categories.includes('all')) return true;
    return sub.categories.includes(categoryLower);
  });

  const createdDispatches: TaskAlertDispatch[] = [];
  let emailedCount = 0;
  let queuedCount = 0;

  for (const sub of matchingSubs) {
    let channel: 'SMTP Email' | 'In-App Alert Feed' = 'In-App Alert Feed';
    let status: 'Sent' | 'Queued' | 'Failed' = 'Queued';
    let note = 'Recorded in subscriber live alert feed.';

    try {
      const smtpRes = await sendSmtpTaskEmail(sub, {
        id: task.id,
        title: task.title,
        category: task.category,
        rewardUsd,
        rewardKes,
        description: String(task.description || '').slice(0, 400),
      });
      if (smtpRes.sent) {
        channel = 'SMTP Email';
        status = 'Sent';
        note = smtpRes.note;
        emailedCount += 1;
      } else {
        queuedCount += 1;
        note = smtpRes.note;
      }
    } catch (err: any) {
      channel = 'SMTP Email';
      status = 'Failed';
      note = err?.message || 'SMTP dispatch failed.';
    }

    const now = new Date().toISOString();
    const record: TaskAlertDispatch = {
      id: `DSP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      subscriptionId: sub.id,
      userUid: sub.userUid,
      emailMasked: maskEmail(sub.email),
      taskId: task.id,
      taskTitle: String(task.title).slice(0, 160),
      taskCategory: task.category,
      taskRewardKes: rewardKes,
      taskRewardUsd: +rewardUsd.toFixed(4),
      deliveryChannel: channel,
      deliveryStatus: status,
      deliveryNote: note,
      createdAt: now,
    };

    dispatches.unshift(record);
    createdDispatches.push(record);

    sub.matchCount = (sub.matchCount || 0) + 1;
    sub.lastNotifiedAt = now;
    sub.updatedAt = now;
    subscriptionsById.set(sub.id, sub);
    syncSubscriptionToFirestore(sub);
  }

  if (dispatches.length > 200) {
    dispatches.length = 200;
  }
  persistAlertsToDisk();

  return {
    matchedCount: matchingSubs.length,
    emailedCount,
    queuedCount,
    dispatches: createdDispatches,
  };
}
