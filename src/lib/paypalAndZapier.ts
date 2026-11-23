import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { adminDb } from './firebase-admin.ts';
import { resolvePlatformOrigin } from '../utils/platformUrl.ts';

export interface GeneratedPayPalLink {
  id: string;
  itemName: string;
  amountUsd: number;
  packageId?: string;
  checkoutUrl: string;
  payPalMeUrl: string;
  htmlButtonSnippet: string;
  createdAt: string;
}

export interface ZapierWorkflowLog {
  id: string;
  direction: 'outbound' | 'inbound';
  event: string;
  status: 'Sent' | 'Received' | 'Skipped' | 'Failed';
  detail: string;
  amountUsd?: number;
  transactionId?: string;
  createdAt: string;
}

interface PersistedPayPalZapierState {
  enabled: boolean;
  primaryEmail: string;
  payPalMeHandle: string;
  mode: 'sandbox' | 'live';
  currency: 'USD';
  zapierWebhookUrl: string;
  generatedLinks: GeneratedPayPalLink[];
  zapierLogs: ZapierWorkflowLog[];
  updatedAt: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const STATE_FILE = path.join(DATA_DIR, 'paypal-zapier.json');

let state: PersistedPayPalZapierState = {
  enabled: true,
  primaryEmail: (process.env.PAYPAL_PRIMARY_EMAIL || 'nigideon36@gmail.com').trim(),
  payPalMeHandle: (process.env.PAYPAL_ME_HANDLE || 'nigideon36')
    .trim()
    .replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')
    .replace(/^@/, ''),
  mode: process.env.PAYPAL_MODE === 'sandbox' ? 'sandbox' : 'live',
  currency: 'USD',
  zapierWebhookUrl: (process.env.ZAPIER_WEBHOOK_URL || '').trim(),
  generatedLinks: [],
  zapierLogs: [],
  updatedAt: new Date().toISOString(),
};

function loadStateFromDisk() {
  try {
    if (!fs.existsSync(STATE_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    if (raw && typeof raw === 'object') {
      state = {
        enabled: raw.enabled !== false,
        primaryEmail:
          typeof raw.primaryEmail === 'string' && raw.primaryEmail.includes('@')
            ? raw.primaryEmail.trim()
            : state.primaryEmail,
        payPalMeHandle:
          typeof raw.payPalMeHandle === 'string' && raw.payPalMeHandle.trim()
            ? raw.payPalMeHandle.trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, '').replace(/^@/, '')
            : state.payPalMeHandle,
        mode: raw.mode === 'sandbox' ? 'sandbox' : 'live',
        currency: 'USD',
        zapierWebhookUrl:
          typeof raw.zapierWebhookUrl === 'string' ? raw.zapierWebhookUrl.trim() : state.zapierWebhookUrl,
        generatedLinks: Array.isArray(raw.generatedLinks) ? raw.generatedLinks.slice(0, 50) : [],
        zapierLogs: Array.isArray(raw.zapierLogs) ? raw.zapierLogs.slice(0, 60) : [],
        updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      };
    }
  } catch (err) {
    console.warn('Could not load PayPal/Zapier state:', (err as Error)?.message || err);
  }
}

function persistStateToDisk() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(
      STATE_FILE,
      JSON.stringify(
        {
          ...state,
          generatedLinks: state.generatedLinks.slice(0, 50),
          zapierLogs: state.zapierLogs.slice(0, 60),
        },
        null,
        2
      ),
      'utf8'
    );
  } catch (err) {
    console.warn('Could not persist PayPal/Zapier state:', (err as Error)?.message || err);
  }
}

function syncConfigToFirestore() {
  if (!adminDb) return;
  try {
    adminDb
      .collection('platform_settings')
      .doc('paypal_zapier')
      .set(
        JSON.parse(
          JSON.stringify({
            enabled: state.enabled,
            primaryEmail: state.primaryEmail,
            payPalMeHandle: state.payPalMeHandle,
            mode: state.mode,
            currency: state.currency,
            zapierConfigured: Boolean(state.zapierWebhookUrl),
            updatedAt: state.updatedAt,
          })
        ),
        { merge: true }
      )
      .catch(() => {});
  } catch {}
}

loadStateFromDisk();

function hasRestCredentials(): boolean {
  return Boolean((process.env.PAYPAL_CLIENT_ID || '').trim() && (process.env.PAYPAL_CLIENT_SECRET || '').trim());
}

export function getPublicPayPalAndZapierStatus() {
  const baseAppUrl = resolvePlatformOrigin(process.env.APP_URL);
  const basePayPalMe = state.payPalMeHandle ? `https://www.paypal.com/paypalme/${state.payPalMeHandle}` : '';

  return {
    enabled: state.enabled,
    disabled: !state.enabled,
    eastAfricaOnly: false,
    internationalBuyersEnabled: state.enabled,
    primaryEmail: state.primaryEmail,
    payPalMeHandle: state.payPalMeHandle,
    payPalMeUrl: basePayPalMe,
    mode: state.mode,
    currency: state.currency,
    isConfigured: Boolean(state.primaryEmail || state.payPalMeHandle || hasRestCredentials()),
    restApiConfigured: hasRestCredentials(),
    zapierWebhookUrl: state.zapierWebhookUrl,
    zapierConfigured: Boolean(state.zapierWebhookUrl),
    inboundZapierWebhookUrl: `${baseAppUrl}/api/paypal/zapier-webhook`,
    generatedLinks: state.generatedLinks.slice(0, 20),
    zapierLogs: state.zapierLogs.slice(0, 30),
    updatedAt: state.updatedAt,
  };
}

export function updatePayPalAndZapierConfig(patch: {
  enabled?: boolean;
  primaryEmail?: string;
  payPalMeHandle?: string;
  mode?: 'sandbox' | 'live';
  zapierWebhookUrl?: string;
}) {
  if (patch.enabled !== undefined) {
    state.enabled = Boolean(patch.enabled);
  }
  if (patch.primaryEmail !== undefined) {
    const email = String(patch.primaryEmail || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
      throw new Error('Enter a valid PayPal business email address.');
    }
    state.primaryEmail = email || 'nigideon36@gmail.com';
  }
  if (patch.payPalMeHandle !== undefined) {
    state.payPalMeHandle = String(patch.payPalMeHandle || '')
      .trim()
      .replace(/^https?:\/\/(www\.)?paypal\.me\//i, '')
      .replace(/^https?:\/\/(www\.)?paypal\.com\/paypalme\//i, '')
      .replace(/^@/, '')
      .replace(/[^a-zA-Z0-9._-]/g, '');
  }
  if (patch.mode !== undefined) {
    state.mode = patch.mode === 'sandbox' ? 'sandbox' : 'live';
  }
  if (patch.zapierWebhookUrl !== undefined) {
    const cleanUrl = String(patch.zapierWebhookUrl || '').trim();
    if (cleanUrl && !/^https:\/\/hooks\.zapier\.com\/hooks\/catch\/.+/i.test(cleanUrl) && !/^https:\/\/.+/i.test(cleanUrl)) {
      throw new Error('Zapier Webhook URL must start with https:// (e.g. https://hooks.zapier.com/hooks/catch/...).');
    }
    state.zapierWebhookUrl = cleanUrl;
  }

  state.updatedAt = new Date().toISOString();
  persistStateToDisk();
  syncConfigToFirestore();
  return getPublicPayPalAndZapierStatus();
}

function sanitizeAmountUsd(raw: unknown): number {
  const num = Number(raw);
  if (!Number.isFinite(num) || num <= 0) {
    return 1.0;
  }
  return Math.max(0.5, Math.min(25000, +num.toFixed(2)));
}

function escapeHtmlAttr(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildPayPalCheckoutLinks(params: {
  itemName: string;
  amountUsd: number;
  packageId?: string;
  customId?: string;
  returnUrl?: string;
}): GeneratedPayPalLink {
  const cleanItem = String(params.itemName || 'Gideon Global Tasks Order').trim().slice(0, 120);
  const amountUsd = sanitizeAmountUsd(params.amountUsd);
  const appBase = resolvePlatformOrigin(params.returnUrl || process.env.APP_URL);
  const webscrHost =
    state.mode === 'sandbox' ? 'https://www.sandbox.paypal.com' : 'https://www.paypal.com';

  const query = new URLSearchParams({
    cmd: '_xclick',
    business: state.primaryEmail,
    item_name: cleanItem,
    amount: amountUsd.toFixed(2),
    currency_code: 'USD',
    no_shipping: '1',
    return: `${appBase}/?paypal_status=success&pkg=${encodeURIComponent(params.packageId || 'custom')}`,
    cancel_return: `${appBase}/?paypal_status=cancelled`,
    notify_url: `${appBase}/api/paypal/webhook`,
  });
  if (params.customId) {
    query.set('custom', String(params.customId).slice(0, 120));
  }

  const checkoutUrl = `${webscrHost}/cgi-bin/webscr?${query.toString()}`;
  const payPalMeUrl = state.payPalMeHandle
    ? `https://www.paypal.com/paypalme/${state.payPalMeHandle}/${amountUsd.toFixed(2)}`
    : checkoutUrl;

  const htmlButtonSnippet = `<form action="${webscrHost}/cgi-bin/webscr" method="post" target="_blank">
  <input type="hidden" name="cmd" value="_xclick" />
  <input type="hidden" name="business" value="${escapeHtmlAttr(state.primaryEmail)}" />
  <input type="hidden" name="item_name" value="${escapeHtmlAttr(cleanItem)}" />
  <input type="hidden" name="amount" value="${amountUsd.toFixed(2)}" />
  <input type="hidden" name="currency_code" value="USD" />
  <input type="hidden" name="no_shipping" value="1" />
  <button type="submit" style="background:#0070ba;color:#fff;border:none;padding:12px 22px;border-radius:8px;font-weight:700;cursor:pointer;">
    Pay $${amountUsd.toFixed(2)} USD with PayPal
  </button>
</form>`;

  const entry: GeneratedPayPalLink = {
    id: `PPLNK-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    itemName: cleanItem,
    amountUsd,
    packageId: params.packageId,
    checkoutUrl,
    payPalMeUrl,
    htmlButtonSnippet,
    createdAt: new Date().toISOString(),
  };

  state.generatedLinks.unshift(entry);
  if (state.generatedLinks.length > 50) {
    state.generatedLinks.length = 50;
  }
  persistStateToDisk();
  return entry;
}

async function getPayPalRestAccessToken(): Promise<string | null> {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return null;

  const base =
    state.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const res = await fetch(`${base}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) return null;
  const json: any = await res.json();
  return json?.access_token ? String(json.access_token) : null;
}

export async function createPayPalOrderOrLink(params: {
  itemName: string;
  amountUsd: number;
  packageId?: string;
  customId?: string;
  returnUrl?: string;
}) {
  if (!state.enabled) {
    throw new Error('PayPal checkout is currently paused by the Platform Owner.');
  }

  const linkData = buildPayPalCheckoutLinks(params);
  const accessToken = await getPayPalRestAccessToken().catch(() => null);

  if (!accessToken) {
    const orderId = `PP_LINK_${Date.now()}_${crypto.randomInt(1000, 9999)}`;
    return {
      orderId,
      restApiOrder: false,
      approveUrl: linkData.checkoutUrl,
      payPalMeUrl: linkData.payPalMeUrl,
      htmlButtonSnippet: linkData.htmlButtonSnippet,
      amountUsd: linkData.amountUsd,
      itemName: linkData.itemName,
      primaryEmail: state.primaryEmail,
      mode: state.mode,
    };
  }

  const base =
    state.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const appBase = resolvePlatformOrigin(params.returnUrl || process.env.APP_URL);

  const orderRes = await fetch(`${base}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          description: linkData.itemName,
          custom_id: params.customId || params.packageId || 'custom',
          amount: {
            currency_code: 'USD',
            value: linkData.amountUsd.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'Gideon Global Tasks',
        user_action: 'PAY_NOW',
        return_url: `${appBase}/?paypal_status=success&pkg=${encodeURIComponent(params.packageId || 'custom')}`,
        cancel_url: `${appBase}/?paypal_status=cancelled`,
      },
    }),
  });

  const orderJson: any = await orderRes.json();
  if (!orderRes.ok || !orderJson?.id) {
    return {
      orderId: `PP_LINK_${Date.now()}`,
      restApiOrder: false,
      approveUrl: linkData.checkoutUrl,
      payPalMeUrl: linkData.payPalMeUrl,
      htmlButtonSnippet: linkData.htmlButtonSnippet,
      amountUsd: linkData.amountUsd,
      itemName: linkData.itemName,
      primaryEmail: state.primaryEmail,
      mode: state.mode,
    };
  }

  const approveLink = Array.isArray(orderJson.links)
    ? orderJson.links.find((l: any) => l.rel === 'approve')?.href
    : undefined;

  return {
    orderId: String(orderJson.id),
    restApiOrder: true,
    approveUrl: approveLink || linkData.checkoutUrl,
    payPalMeUrl: linkData.payPalMeUrl,
    htmlButtonSnippet: linkData.htmlButtonSnippet,
    amountUsd: linkData.amountUsd,
    itemName: linkData.itemName,
    primaryEmail: state.primaryEmail,
    mode: state.mode,
  };
}

export async function capturePayPalRestOrder(orderId: string) {
  const accessToken = await getPayPalRestAccessToken().catch(() => null);
  if (!accessToken) {
    return {
      captured: false,
      requiresManualOrZapier: true,
      orderId,
      message: 'PayPal REST API secret not set; submit your PayPal Transaction ID or trigger Zapier webhook.',
    };
  }

  const base =
    state.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const res = await fetch(`${base}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });
  const data: any = await res.json();
  const status = String(data?.status || '');
  const captureUnit = data?.purchase_units?.[0]?.payments?.captures?.[0];
  return {
    captured: res.ok && status === 'COMPLETED',
    requiresManualOrZapier: false,
    orderId: String(data?.id || orderId),
    status,
    transactionId: String(captureUnit?.id || data?.id || orderId),
    payerEmail: data?.payer?.email_address ? String(data.payer.email_address) : undefined,
    amountUsd: captureUnit?.amount?.value ? Number(captureUnit.amount.value) : undefined,
  };
}

export function recordZapierLog(entry: Omit<ZapierWorkflowLog, 'id' | 'createdAt'>): ZapierWorkflowLog {
  const log: ZapierWorkflowLog = {
    id: `ZAP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  state.zapierLogs.unshift(log);
  if (state.zapierLogs.length > 60) {
    state.zapierLogs.length = 60;
  }
  persistStateToDisk();
  return log;
}

export async function dispatchZapierWorkflowEvent(params: {
  event: string;
  amountUsd?: number;
  transactionId?: string;
  payerEmail?: string;
  payerName?: string;
  packageId?: string;
  itemName?: string;
  data?: Record<string, unknown>;
}): Promise<ZapierWorkflowLog> {
  const url = state.zapierWebhookUrl;
  if (!url) {
    return recordZapierLog({
      direction: 'outbound',
      event: params.event,
      status: 'Skipped',
      detail: 'Zapier Catch Hook URL not configured yet in Owner Console → PayPal & Zapier.',
      amountUsd: params.amountUsd,
      transactionId: params.transactionId,
    });
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'Gideon Global Tasks',
        event: params.event,
        amountUsd: params.amountUsd,
        transactionId: params.transactionId,
        payerEmail: params.payerEmail,
        payerName: params.payerName,
        packageId: params.packageId,
        itemName: params.itemName,
        paypalBusinessEmail: state.primaryEmail,
        timestamp: new Date().toISOString(),
        ...(params.data || {}),
      }),
    });

    if (!res.ok) {
      return recordZapierLog({
        direction: 'outbound',
        event: params.event,
        status: 'Failed',
        detail: `Zapier webhook responded HTTP ${res.status}.`,
        amountUsd: params.amountUsd,
        transactionId: params.transactionId,
      });
    }

    return recordZapierLog({
      direction: 'outbound',
      event: params.event,
      status: 'Sent',
      detail: `Dispatched "${params.event}" to Zapier Catch Hook.`,
      amountUsd: params.amountUsd,
      transactionId: params.transactionId,
    });
  } catch (err: any) {
    return recordZapierLog({
      direction: 'outbound',
      event: params.event,
      status: 'Failed',
      detail: err?.message || 'Network error calling Zapier Catch Hook.',
      amountUsd: params.amountUsd,
      transactionId: params.transactionId,
    });
  }
}
