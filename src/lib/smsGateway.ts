import fs from 'fs';
import path from 'path';

export type SmsProviderType = 'none' | 'africastalking' | 'textsms' | 'twilio';

export interface SmsGatewayConfig {
  provider: SmsProviderType;
  // Africa's Talking
  atUsername: string;
  atApiKey: string;
  atSenderId: string;
  // TextSMS / Advanta Kenya
  textsmsApiKey: string;
  textsmsPartnerId: string;
  textsmsShortcode: string;
  textsmsEndpoint: string;
  // Twilio
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioFromNumber: string;
  updatedAt: string;
}

export interface SmsDeliveryLogEntry {
  id: string;
  timestamp: string;
  maskedPhone: string;
  purpose: string;
  provider: string;
  status: 'delivered' | 'sandbox' | 'failed' | 'instant-fallback';
  detail: string;
  messageId?: string;
}

export interface SmsDispatchResult {
  carrierDelivered: boolean;
  deliveryMode: 'africastalking' | 'textsms' | 'twilio' | 'instant-fallback';
  providerLabel: string;
  carrierMessageId?: string;
  fallbackReason?: string;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const SMS_CONFIG_FILE = path.join(DATA_DIR, 'sms-config.json');
const SMS_LOGS_FILE = path.join(DATA_DIR, 'sms-logs.json');

const DEFAULT_CONFIG: SmsGatewayConfig = {
  provider: 'none',
  atUsername: process.env.AT_USERNAME || '',
  atApiKey: process.env.AT_API_KEY || '',
  atSenderId: process.env.AT_SENDER_ID || '',
  textsmsApiKey: process.env.TEXTSMS_API_KEY || '',
  textsmsPartnerId: process.env.TEXTSMS_PARTNER_ID || '',
  textsmsShortcode: process.env.TEXTSMS_SHORTCODE || 'TextSMS',
  textsmsEndpoint: process.env.TEXTSMS_ENDPOINT || 'https://sms.textsms.co.ke/api/services/sendsms/',
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  updatedAt: new Date().toISOString(),
};

let cachedConfig: SmsGatewayConfig | null = null;
let recentLogs: SmsDeliveryLogEntry[] = [];

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadLogsFromDisk() {
  try {
    if (!fs.existsSync(SMS_LOGS_FILE)) return;
    const raw = JSON.parse(fs.readFileSync(SMS_LOGS_FILE, 'utf8'));
    if (Array.isArray(raw)) {
      recentLogs = raw.slice(0, 30);
    }
  } catch {
    recentLogs = [];
  }
}

loadLogsFromDisk();

export function recordSmsDeliveryLog(entry: Omit<SmsDeliveryLogEntry, 'id' | 'timestamp'>) {
  const full: SmsDeliveryLogEntry = {
    id: `sms_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    ...entry,
  };
  recentLogs = [full, ...recentLogs].slice(0, 30);
  try {
    ensureDataDir();
    fs.writeFileSync(SMS_LOGS_FILE, JSON.stringify(recentLogs, null, 2), 'utf8');
  } catch {
    // ignore disk error
  }
}

export function getRecentSmsLogs(): SmsDeliveryLogEntry[] {
  return recentLogs;
}

export function getSmsGatewayConfig(): SmsGatewayConfig {
  if (cachedConfig) return cachedConfig;

  let diskConfig: Partial<SmsGatewayConfig> = {};
  try {
    if (fs.existsSync(SMS_CONFIG_FILE)) {
      diskConfig = JSON.parse(fs.readFileSync(SMS_CONFIG_FILE, 'utf8')) || {};
    }
  } catch {
    diskConfig = {};
  }

  const merged: SmsGatewayConfig = {
    provider: diskConfig.provider || 'none',
    atUsername: diskConfig.atUsername || process.env.AT_USERNAME || DEFAULT_CONFIG.atUsername,
    atApiKey: diskConfig.atApiKey || process.env.AT_API_KEY || DEFAULT_CONFIG.atApiKey,
    atSenderId: diskConfig.atSenderId || process.env.AT_SENDER_ID || DEFAULT_CONFIG.atSenderId,
    textsmsApiKey: diskConfig.textsmsApiKey || process.env.TEXTSMS_API_KEY || DEFAULT_CONFIG.textsmsApiKey,
    textsmsPartnerId: diskConfig.textsmsPartnerId || process.env.TEXTSMS_PARTNER_ID || DEFAULT_CONFIG.textsmsPartnerId,
    textsmsShortcode: diskConfig.textsmsShortcode || process.env.TEXTSMS_SHORTCODE || DEFAULT_CONFIG.textsmsShortcode,
    textsmsEndpoint: diskConfig.textsmsEndpoint || process.env.TEXTSMS_ENDPOINT || DEFAULT_CONFIG.textsmsEndpoint,
    twilioAccountSid: diskConfig.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID || DEFAULT_CONFIG.twilioAccountSid,
    twilioAuthToken: diskConfig.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN || DEFAULT_CONFIG.twilioAuthToken,
    twilioFromNumber: diskConfig.twilioFromNumber || process.env.TWILIO_FROM_NUMBER || DEFAULT_CONFIG.twilioFromNumber,
    updatedAt: diskConfig.updatedAt || DEFAULT_CONFIG.updatedAt,
  };

  // Auto-select configured provider from env if disk config didn't specify one
  if (merged.provider === 'none') {
    if (merged.atApiKey && merged.atUsername) {
      merged.provider = 'africastalking';
    } else if (merged.textsmsApiKey && merged.textsmsPartnerId) {
      merged.provider = 'textsms';
    } else if (merged.twilioAccountSid && merged.twilioAuthToken && merged.twilioFromNumber) {
      merged.provider = 'twilio';
    }
  }

  cachedConfig = merged;
  return merged;
}

export function saveSmsGatewayConfig(partial: Partial<SmsGatewayConfig>): SmsGatewayConfig {
  const current = getSmsGatewayConfig();
  const next: SmsGatewayConfig = {
    provider: partial.provider || current.provider,
    atUsername: partial.atUsername !== undefined ? String(partial.atUsername).trim() : current.atUsername,
    atApiKey: partial.atApiKey !== undefined && partial.atApiKey !== '********' ? String(partial.atApiKey).trim() : current.atApiKey,
    atSenderId: partial.atSenderId !== undefined ? String(partial.atSenderId).trim() : current.atSenderId,
    textsmsApiKey: partial.textsmsApiKey !== undefined && partial.textsmsApiKey !== '********' ? String(partial.textsmsApiKey).trim() : current.textsmsApiKey,
    textsmsPartnerId: partial.textsmsPartnerId !== undefined ? String(partial.textsmsPartnerId).trim() : current.textsmsPartnerId,
    textsmsShortcode: partial.textsmsShortcode !== undefined ? String(partial.textsmsShortcode).trim() || 'TextSMS' : current.textsmsShortcode,
    textsmsEndpoint: partial.textsmsEndpoint !== undefined ? String(partial.textsmsEndpoint).trim() || DEFAULT_CONFIG.textsmsEndpoint : current.textsmsEndpoint,
    twilioAccountSid: partial.twilioAccountSid !== undefined ? String(partial.twilioAccountSid).trim() : current.twilioAccountSid,
    twilioAuthToken: partial.twilioAuthToken !== undefined && partial.twilioAuthToken !== '********' ? String(partial.twilioAuthToken).trim() : current.twilioAuthToken,
    twilioFromNumber: partial.twilioFromNumber !== undefined ? String(partial.twilioFromNumber).trim() : current.twilioFromNumber,
    updatedAt: new Date().toISOString(),
  };

  cachedConfig = next;
  try {
    ensureDataDir();
    fs.writeFileSync(SMS_CONFIG_FILE, JSON.stringify(next, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist SMS config:', (err as Error)?.message || err);
  }
  return next;
}

function maskSecret(val: string): string {
  if (!val) return '';
  if (val.length <= 6) return '******';
  return `${val.slice(0, 4)}****${val.slice(-3)}`;
}

export function getPublicSmsGatewayStatus() {
  const cfg = getSmsGatewayConfig();
  const atConfigured = Boolean(cfg.atApiKey && cfg.atUsername);
  const atIsSandbox = cfg.atUsername.toLowerCase() === 'sandbox';
  const textsmsConfigured = Boolean(cfg.textsmsApiKey && cfg.textsmsPartnerId && cfg.textsmsShortcode);
  const twilioConfigured = Boolean(cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioFromNumber);

  const liveCarrierReady =
    (cfg.provider === 'africastalking' && atConfigured && !atIsSandbox) ||
    (cfg.provider === 'textsms' && textsmsConfigured) ||
    (cfg.provider === 'twilio' && twilioConfigured);

  return {
    activeProvider: cfg.provider,
    liveCarrierReady,
    atIsSandbox,
    updatedAt: cfg.updatedAt,
    config: {
      provider: cfg.provider,
      atUsername: cfg.atUsername,
      atApiKeyMasked: maskSecret(cfg.atApiKey),
      atConfigured,
      atSenderId: cfg.atSenderId,
      textsmsPartnerId: cfg.textsmsPartnerId,
      textsmsApiKeyMasked: maskSecret(cfg.textsmsApiKey),
      textsmsShortcode: cfg.textsmsShortcode,
      textsmsEndpoint: cfg.textsmsEndpoint,
      textsmsConfigured,
      twilioAccountSid: cfg.twilioAccountSid,
      twilioAuthTokenMasked: maskSecret(cfg.twilioAuthToken),
      twilioFromNumber: cfg.twilioFromNumber,
      twilioConfigured,
    },
    recentLogs: recentLogs.slice(0, 12),
  };
}

export async function dispatchSmsViaGateway(
  phone: string,
  message: string,
  maskedPhone: string,
  purpose: string
): Promise<SmsDispatchResult> {
  const cfg = getSmsGatewayConfig();
  const errors: string[] = [];

  // Build priority provider order starting with the selected provider
  const order: SmsProviderType[] = [];
  if (cfg.provider !== 'none') order.push(cfg.provider);
  for (const p of ['africastalking', 'textsms', 'twilio'] as SmsProviderType[]) {
    if (!order.includes(p)) order.push(p);
  }

  for (const provider of order) {
    // 1. Africa's Talking
    if (provider === 'africastalking' && cfg.atApiKey && cfg.atUsername) {
      const isSandbox = cfg.atUsername.toLowerCase() === 'sandbox';
      if (isSandbox) {
        errors.push(
          "Africa's Talking is set to 'sandbox' username, which does not deliver SMS to physical mobile phones."
        );
        continue;
      }
      try {
        const params: Record<string, string> = {
          username: cfg.atUsername,
          to: phone,
          message,
        };
        if (cfg.atSenderId) {
          params.from = cfg.atSenderId;
        }
        const resp = await fetch('https://api.africastalking.com/version1/messaging', {
          method: 'POST',
          headers: {
            apiKey: cfg.atApiKey,
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(params).toString(),
          signal: AbortSignal.timeout(10000),
        });
        const data: any = await resp.json().catch(() => ({}));
        const recipient = data?.SMSMessageData?.Recipients?.[0];
        const statusCode = Number(recipient?.statusCode);
        const statusText = String(recipient?.status || '');
        if (resp.ok && (statusCode === 101 || statusCode === 100 || statusText.toLowerCase() === 'success')) {
          const msgId = recipient?.messageId || `AT-${Date.now()}`;
          recordSmsDeliveryLog({
            maskedPhone,
            purpose,
            provider: "Africa's Talking",
            status: 'delivered',
            detail: `Dispatched (${statusText || 'Success'})`,
            messageId: msgId,
          });
          return {
            carrierDelivered: true,
            deliveryMode: 'africastalking',
            providerLabel: "Africa's Talking SMS",
            carrierMessageId: msgId,
          };
        }
        const reason =
          recipient?.status ||
          data?.SMSMessageData?.Message ||
          `HTTP ${resp.status} rejected recipient`;
        errors.push(`Africa's Talking: ${reason}`);
        recordSmsDeliveryLog({
          maskedPhone,
          purpose,
          provider: "Africa's Talking",
          status: 'failed',
          detail: String(reason),
        });
      } catch (err: any) {
        const msg = err?.message || 'Network timeout';
        errors.push(`Africa's Talking: ${msg}`);
        recordSmsDeliveryLog({
          maskedPhone,
          purpose,
          provider: "Africa's Talking",
          status: 'failed',
          detail: msg,
        });
      }
    }

    // 2. TextSMS / Advanta Africa (Kenya & East Africa)
    if (provider === 'textsms' && cfg.textsmsApiKey && cfg.textsmsPartnerId) {
      try {
        const cleanMsisdn = phone.replace(/^\+/, '');
        const resp = await fetch(cfg.textsmsEndpoint || DEFAULT_CONFIG.textsmsEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            apikey: cfg.textsmsApiKey,
            partnerID: cfg.textsmsPartnerId,
            message,
            shortcode: cfg.textsmsShortcode || 'TextSMS',
            mobile: cleanMsisdn,
          }),
          signal: AbortSignal.timeout(10000),
        });
        const data: any = await resp.json().catch(() => ({}));
        const first = Array.isArray(data?.responses) ? data.responses[0] : data;
        const code = Number(first?.['response-code'] ?? first?.code);
        if (resp.ok && code === 200) {
          const msgId = String(first?.messageid || `TXTSMS-${Date.now()}`);
          recordSmsDeliveryLog({
            maskedPhone,
            purpose,
            provider: 'TextSMS Kenya',
            status: 'delivered',
            detail: first?.['response-description'] || 'Success',
            messageId: msgId,
          });
          return {
            carrierDelivered: true,
            deliveryMode: 'textsms',
            providerLabel: 'TextSMS East Africa',
            carrierMessageId: msgId,
          };
        }
        const reason = first?.['response-description'] || data?.message || `HTTP ${resp.status}`;
        errors.push(`TextSMS: ${reason}`);
        recordSmsDeliveryLog({
          maskedPhone,
          purpose,
          provider: 'TextSMS Kenya',
          status: 'failed',
          detail: String(reason),
        });
      } catch (err: any) {
        const msg = err?.message || 'Network timeout';
        errors.push(`TextSMS: ${msg}`);
        recordSmsDeliveryLog({
          maskedPhone,
          purpose,
          provider: 'TextSMS Kenya',
          status: 'failed',
          detail: msg,
        });
      }
    }

    // 3. Twilio
    if (provider === 'twilio' && cfg.twilioAccountSid && cfg.twilioAuthToken && cfg.twilioFromNumber) {
      try {
        const auth = Buffer.from(`${cfg.twilioAccountSid}:${cfg.twilioAuthToken}`).toString('base64');
        const body = new URLSearchParams({
          To: phone,
          From: cfg.twilioFromNumber,
          Body: message,
        });
        const resp = await fetch(
          `https://api.twilio.com/2010-04-01/Accounts/${cfg.twilioAccountSid}/Messages.json`,
          {
            method: 'POST',
            headers: {
              Authorization: `Basic ${auth}`,
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            signal: AbortSignal.timeout(10000),
          }
        );
        const data: any = await resp.json().catch(() => ({}));
        if (resp.ok && data?.sid) {
          recordSmsDeliveryLog({
            maskedPhone,
            purpose,
            provider: 'Twilio SMS',
            status: 'delivered',
            detail: `Queued (${data.status || 'sent'})`,
            messageId: data.sid,
          });
          return {
            carrierDelivered: true,
            deliveryMode: 'twilio',
            providerLabel: 'Twilio Carrier SMS',
            carrierMessageId: data.sid,
          };
        }
        const reason = data?.message || `HTTP ${resp.status}`;
        errors.push(`Twilio: ${reason}`);
        recordSmsDeliveryLog({
          maskedPhone,
          purpose,
          provider: 'Twilio SMS',
          status: 'failed',
          detail: String(reason),
        });
      } catch (err: any) {
        const msg = err?.message || 'Network timeout';
        errors.push(`Twilio: ${msg}`);
        recordSmsDeliveryLog({
          maskedPhone,
          purpose,
          provider: 'Twilio SMS',
          status: 'failed',
          detail: msg,
        });
      }
    }
  }

  const fallbackReason =
    errors.length > 0
      ? errors.join(' | ')
      : 'No live SMS carrier API key is configured on the server yet (Africa\'s Talking, TextSMS, or Twilio).';

  recordSmsDeliveryLog({
    maskedPhone,
    purpose,
    provider: 'Instant On-Screen Fallback',
    status: 'instant-fallback',
    detail: fallbackReason,
  });

  return {
    carrierDelivered: false,
    deliveryMode: 'instant-fallback',
    providerLabel: 'Instant On-Screen Verification',
    fallbackReason,
  };
}
