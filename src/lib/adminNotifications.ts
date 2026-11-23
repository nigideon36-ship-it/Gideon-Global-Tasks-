import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import nodemailer from 'nodemailer';
import type { Request, Response } from 'express';
import { adminDb } from './firebase-admin.ts';
import { resolvePlatformOrigin } from '../utils/platformUrl.ts';

export type AdminNotificationEventType =
  | 'new_registration'
  | 'high_reward_task'
  | 'kyc_submitted'
  | 'withdrawal_requested'
  | 'investment_deposit'
  | 'support_ticket'
  | 'ppv_status_uploaded'
  | 'auction_activity'
  | 'system_test';

export interface AdminNotificationEventToggles {
  new_registration: boolean;
  high_reward_task: boolean;
  kyc_submitted: boolean;
  withdrawal_requested: boolean;
  investment_deposit: boolean;
  support_ticket: boolean;
  ppv_status_uploaded: boolean;
  auction_activity: boolean;
}

export interface AdminNotificationDispatchLog {
  id: string;
  eventType: AdminNotificationEventType;
  title: string;
  summary: string;
  recipientMasked: string;
  deliveryStatus: 'Sent' | 'Queued' | 'Skipped' | 'Failed';
  deliveryNote: string;
  actorLabel?: string;
  amountLabel?: string;
  source: 'server-event' | 'serverless-webhook' | 'owner-test';
  createdAt: string;
}

interface PersistedAdminNotificationsState {
  adminEmail: string;
  enabled: boolean;
  highRewardThresholdKes: number;
  events: AdminNotificationEventToggles;
  logs: AdminNotificationDispatchLog[];
  updatedAt: string;
}

const DEFAULT_ADMIN_EMAIL =
  (process.env.ADMIN_NOTIFICATION_EMAIL || 'nigideon36@gmail.com').trim().toLowerCase() ||
  'nigideon36@gmail.com';

const DEFAULT_TOGGLES: AdminNotificationEventToggles = {
  new_registration: true,
  high_reward_task: true,
  kyc_submitted: true,
  withdrawal_requested: true,
  investment_deposit: true,
  support_ticket: true,
  ppv_status_uploaded: true,
  auction_activity: true,
};

const VALID_EVENT_TYPES = new Set<AdminNotificationEventType>([
  'new_registration',
  'high_reward_task',
  'kyc_submitted',
  'withdrawal_requested',
  'investment_deposit',
  'support_ticket',
  'ppv_status_uploaded',
  'auction_activity',
  'system_test',
]);

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'admin-notifications.json');
const FIRESTORE_SETTINGS_COLLECTION = 'admin_notification_settings';

let state: PersistedAdminNotificationsState = {
  adminEmail: DEFAULT_ADMIN_EMAIL,
  enabled: true,
  highRewardThresholdKes: 40,
  events: { ...DEFAULT_TOGGLES },
  logs: [],
  updatedAt: new Date().toISOString(),
};

function loadStateFromDisk() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      state = {
        adminEmail:
          typeof raw.adminEmail === 'string' && isValidEmail(raw.adminEmail)
            ? raw.adminEmail.trim().toLowerCase()
            : DEFAULT_ADMIN_EMAIL,
        enabled: raw.enabled !== false,
        highRewardThresholdKes: Math.min(
          50,
          Math.max(10, Math.round(Number(raw.highRewardThresholdKes) || 40))
        ),
        events: {
          ...DEFAULT_TOGGLES,
          ...(raw.events && typeof raw.events === 'object' ? raw.events : {}),
        },
        logs: Array.isArray(raw.logs) ? raw.logs.slice(0, 100) : [],
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Could not load admin notification state:', (err as Error)?.message || err);
  }
}

function persistStateToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify({ ...state, logs: state.logs.slice(0, 100) }, null, 2),
      'utf8'
    );
  } catch (err) {
    console.warn('Could not persist admin notification state:', (err as Error)?.message || err);
  }
}

function syncSettingsToFirestore() {
  if (!adminDb) return;
  try {
    adminDb
      .collection(FIRESTORE_SETTINGS_COLLECTION)
      .doc('owner_alerts')
      .set(
        JSON.parse(
          JSON.stringify({
            adminEmail: state.adminEmail,
            enabled: state.enabled,
            highRewardThresholdKes: state.highRewardThresholdKes,
            events: state.events,
            updatedAt: state.updatedAt,
          })
        ),
        { merge: true }
      )
      .catch(() => {});
  } catch {}
}

loadStateFromDisk();

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(String(email || '').trim()) && email.length <= 200;
}

function maskEmail(email: string): string {
  const parts = String(email || '').split('@');
  if (parts.length !== 2) return '***';
  const [local, domain] = parts;
  const vis = local.slice(0, Math.min(3, local.length));
  return `${vis}***@${domain}`;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function getResolvedSmtpStatus() {
  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || '').trim();
  const from = (process.env.SMTP_FROM || '').trim() || (user ? `"Gideon Global Tasks" <${user}>` : '');
  const configured = Boolean(host && user && pass);
  return {
    host,
    port,
    user,
    pass,
    from,
    configured,
    maskedHost: host || 'Not set in environment',
    maskedUser: user ? maskEmail(user) : 'Not set in environment',
    fromLabel: from || 'Not set in environment',
  };
}

export function getPublicAdminNotificationStatus() {
  const smtp = getResolvedSmtpStatus();
  return {
    adminEmail: state.adminEmail,
    enabled: state.enabled,
    highRewardThresholdKes: state.highRewardThresholdKes,
    events: state.events,
    updatedAt: state.updatedAt,
    smtp: {
      configured: smtp.configured,
      host: smtp.maskedHost,
      port: smtp.port,
      userMasked: smtp.maskedUser,
      fromLabel: smtp.fromLabel,
    },
    serverlessEndpoint: '/api/serverless/admin-notify',
    logs: state.logs.slice(0, 60),
  };
}

export function updateAdminNotificationSettings(patch: {
  adminEmail?: string;
  enabled?: boolean;
  highRewardThresholdKes?: number;
  events?: Partial<AdminNotificationEventToggles>;
}) {
  if (patch.adminEmail !== undefined) {
    const cleanEmail = String(patch.adminEmail || '').trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      throw new Error('Please enter a valid Admin notification email address.');
    }
    state.adminEmail = cleanEmail;
  }
  if (patch.enabled !== undefined) {
    state.enabled = Boolean(patch.enabled);
  }
  if (patch.highRewardThresholdKes !== undefined) {
    const num = Math.round(Number(patch.highRewardThresholdKes));
    if (!Number.isFinite(num) || num < 10 || num > 50) {
      throw new Error('High-reward task threshold must be between 10 and 50 KSh.');
    }
    state.highRewardThresholdKes = num;
  }
  if (patch.events && typeof patch.events === 'object') {
    const nextEvents = { ...state.events };
    (Object.keys(DEFAULT_TOGGLES) as Array<keyof AdminNotificationEventToggles>).forEach((key) => {
      if (patch.events && key in patch.events && typeof patch.events[key] === 'boolean') {
        nextEvents[key] = Boolean(patch.events[key]);
      }
    });
    state.events = nextEvents;
  }
  state.updatedAt = new Date().toISOString();
  persistStateToDisk();
  syncSettingsToFirestore();
  return getPublicAdminNotificationStatus();
}

export interface AdminNotificationPayload {
  eventType: AdminNotificationEventType;
  title: string;
  summary: string;
  actorName?: string;
  actorEmail?: string;
  actorPhone?: string;
  countryCode?: string;
  rewardKes?: number;
  rewardUsd?: number;
  amountLabel?: string;
  details?: Record<string, string | number | boolean | undefined | null>;
}

function getEventBadgeLabel(eventType: AdminNotificationEventType): { badge: string; accent: string } {
  switch (eventType) {
    case 'new_registration':
      return { badge: 'NEW CUSTOMER', accent: '#047857' };
    case 'high_reward_task':
      return { badge: 'HIGH-REWARD TASK', accent: '#1d4ed8' };
    case 'kyc_submitted':
      return { badge: 'KYC ID SUBMITTED', accent: '#b45309' };
    case 'withdrawal_requested':
      return { badge: 'PAYPAL WITHDRAWAL', accent: '#be123c' };
    case 'investment_deposit':
      return { badge: 'INVESTMENT DEPOSIT', accent: '#0f766e' };
    case 'support_ticket':
      return { badge: 'SUPPORT TICKET', accent: '#7c2d12' };
    case 'ppv_status_uploaded':
      return { badge: 'PAY-PER-VIEW UPLOAD', accent: '#4338ca' };
    case 'auction_activity':
      return { badge: 'AUCTION ACTIVITY', accent: '#6d28d9' };
    case 'system_test':
    default:
      return { badge: 'SYSTEM TEST', accent: '#1e3a8a' };
  }
}

export async function notifyAdminPlatformEvent(
  payload: AdminNotificationPayload,
  source: 'server-event' | 'serverless-webhook' | 'owner-test' = 'server-event'
): Promise<AdminNotificationDispatchLog> {
  const now = new Date().toISOString();
  const recipient = state.adminEmail || DEFAULT_ADMIN_EMAIL;
  const actorLabel =
    [payload.actorName, payload.actorPhone, payload.actorEmail].filter(Boolean).join(' · ').slice(0, 140) ||
    undefined;
  const amountLabel =
    payload.amountLabel ||
    (typeof payload.rewardKes === 'number' && payload.rewardKes > 0
      ? `KES ${Math.round(payload.rewardKes).toLocaleString()}`
      : undefined);

  const recordLog = (
    deliveryStatus: AdminNotificationDispatchLog['deliveryStatus'],
    deliveryNote: string
  ): AdminNotificationDispatchLog => {
    const entry: AdminNotificationDispatchLog = {
      id: `ADM-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
      eventType: payload.eventType,
      title: String(payload.title || 'Platform Event').slice(0, 160),
      summary: String(payload.summary || '').slice(0, 400),
      recipientMasked: maskEmail(recipient),
      deliveryStatus,
      deliveryNote: deliveryNote.slice(0, 240),
      actorLabel,
      amountLabel,
      source,
      createdAt: now,
    };
    state.logs.unshift(entry);
    if (state.logs.length > 100) {
      state.logs.length = 100;
    }
    persistStateToDisk();
    return entry;
  };

  if (payload.eventType !== 'system_test') {
    if (!state.enabled) {
      return recordLog('Skipped', 'Admin email notifications are paused in Owner Settings.');
    }
    const toggleKey = payload.eventType as keyof AdminNotificationEventToggles;
    if (toggleKey in state.events && state.events[toggleKey] === false) {
      return recordLog('Skipped', `Notifications disabled for event type "${payload.eventType}".`);
    }
    if (
      payload.eventType === 'high_reward_task' &&
      typeof payload.rewardKes === 'number' &&
      payload.rewardKes < state.highRewardThresholdKes
    ) {
      return recordLog(
        'Skipped',
        `Task reward (${payload.rewardKes} KSh) is below configured threshold (${state.highRewardThresholdKes} KSh).`
      );
    }
  }

  const smtp = getResolvedSmtpStatus();
  if (!smtp.configured) {
    return recordLog(
      'Queued',
      'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) not set in environment — logged in Owner Console.'
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
    });

    const appUrl = resolvePlatformOrigin(process.env.APP_URL);
    const { badge, accent } = getEventBadgeLabel(payload.eventType);

    const detailEntries: Array<[string, string]> = [];
    if (payload.actorName) detailEntries.push(['Member / Actor', payload.actorName]);
    if (payload.actorPhone) detailEntries.push(['Phone Number', payload.actorPhone]);
    if (payload.actorEmail) detailEntries.push(['Email Address', payload.actorEmail]);
    if (payload.countryCode) detailEntries.push(['Country', payload.countryCode]);
    if (amountLabel) detailEntries.push(['Amount / Reward', amountLabel]);
    if (payload.details) {
      for (const [k, v] of Object.entries(payload.details)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          detailEntries.push([k, String(v).slice(0, 200)]);
        }
      }
    }
    detailEntries.push(['Trigger Source', source]);
    detailEntries.push(['Timestamp (UTC)', now]);

    const subject = `[${badge}] ${payload.title} — Gideon Global Tasks`;
    const textLines = [
      `Gideon Global Tasks — Real-Time Admin Notification`,
      `====================================================`,
      `Event: ${badge}`,
      `Title: ${payload.title}`,
      `Summary: ${payload.summary}`,
      ``,
      ...detailEntries.map(([k, v]) => `${k}: ${v}`),
      ``,
      `Open Owner Console: ${appUrl}`,
    ];

    const detailRowsHtml = detailEntries
      .map(
        ([k, v]) =>
          `<tr><td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:12px;font-weight:600;width:36%;">${escapeHtml(
            k
          )}</td><td style="padding:7px 10px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:12px;font-family:monospace;">${escapeHtml(
            v
          )}</td></tr>`
      )
      .join('');

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:24px;background:#ffffff;border:1px solid #cbd5e1;border-radius:14px;">
        <div style="display:inline-block;padding:4px 10px;border-radius:6px;background:${accent};color:#ffffff;font-size:11px;font-weight:700;letter-spacing:0.06em;">
          ${escapeHtml(badge)}
        </div>
        <h2 style="margin:12px 0 6px;color:#0f172a;font-size:19px;">${escapeHtml(payload.title)}</h2>
        <p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.55;">${escapeHtml(payload.summary)}</p>
        <table style="width:100%;border-collapse:collapse;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;margin-bottom:18px;">
          <tbody>${detailRowsHtml}</tbody>
        </table>
        <a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#1d4ed8;color:#ffffff;padding:10px 18px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:700;">
          Open Platform Owner Console
        </a>
        <p style="margin:16px 0 0;color:#64748b;font-size:11px;">
          Automated notification delivered to ${escapeHtml(recipient)} via configured SMTP (${escapeHtml(smtp.host)}).
        </p>
      </div>
    `;

    const info = await transporter.sendMail({
      from: smtp.from,
      to: recipient,
      subject,
      text: textLines.join('\n'),
      html,
    });

    return recordLog(
      'Sent',
      `Delivered to ${maskEmail(recipient)} via ${smtp.host} (msgId: ${info.messageId || 'ok'}).`
    );
  } catch (err: any) {
    return recordLog('Failed', err?.message || 'SMTP sendMail failed.');
  }
}

export async function sendAdminTestEmail(): Promise<AdminNotificationDispatchLog> {
  return notifyAdminPlatformEvent(
    {
      eventType: 'system_test',
      title: 'SMTP Admin Alert Connection Verified',
      summary:
        'Live test email triggered from Owner Console to verify SMTP delivery for new customer registrations, high-reward tasks, KYC ID submissions, PayPal withdrawals, and platform activity.',
      details: {
        Recipient: state.adminEmail,
        HighRewardThreshold: `KES ${state.highRewardThresholdKes}`,
      },
    },
    'owner-test'
  );
}

/**
 * Serverless HTTP Function Handler (Express & Google Cloud Functions compatible)
 * Triggers real SMTP email alerts to the configured Admin when invoked for new registrations,
 * high-reward task publications, or platform events.
 */
export async function adminEmailNotificationHandler(req: Request, res: Response) {
  try {
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, any>;
    const rawType = String(body.eventType || 'system_test').trim() as AdminNotificationEventType;
    const eventType: AdminNotificationEventType = VALID_EVENT_TYPES.has(rawType)
      ? rawType
      : 'system_test';

    const title = String(
      body.title ||
        (eventType === 'new_registration'
          ? `New Customer Registered: ${body.actorName || body.actorPhone || 'East Africa Member'}`
          : eventType === 'high_reward_task'
          ? `High-Reward Task Published: ${body.taskTitle || 'New Task'}`
          : 'Platform Activity Alert')
    ).trim();

    const summary = String(
      body.summary ||
        (eventType === 'new_registration'
          ? 'A new customer created a Gideon Global Tasks account.'
          : eventType === 'high_reward_task'
          ? `A high-reward task (${body.rewardKes || state.highRewardThresholdKes} KSh) was published on the marketplace.`
          : 'Serverless admin notification event received.')
    ).trim();

    const dispatch = await notifyAdminPlatformEvent(
      {
        eventType,
        title,
        summary,
        actorName: body.actorName ? String(body.actorName) : undefined,
        actorEmail: body.actorEmail ? String(body.actorEmail) : undefined,
        actorPhone: body.actorPhone ? String(body.actorPhone) : undefined,
        countryCode: body.countryCode ? String(body.countryCode) : undefined,
        rewardKes: body.rewardKes !== undefined ? Number(body.rewardKes) : undefined,
        rewardUsd: body.rewardUsd !== undefined ? Number(body.rewardUsd) : undefined,
        amountLabel: body.amountLabel ? String(body.amountLabel) : undefined,
        details:
          body.details && typeof body.details === 'object'
            ? (body.details as Record<string, string | number | boolean>)
            : undefined,
      },
      'serverless-webhook'
    );

    const status = getPublicAdminNotificationStatus();
    return res.status(dispatch.deliveryStatus === 'Failed' ? 502 : 200).json({
      success: dispatch.deliveryStatus !== 'Failed',
      dispatch,
      smtpConfigured: status.smtp.configured,
      adminEmail: status.adminEmail,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Invalid serverless notification payload.',
    });
  }
}
