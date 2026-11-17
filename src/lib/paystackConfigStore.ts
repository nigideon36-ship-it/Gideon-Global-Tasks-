import fs from 'fs';
import path from 'path';

export interface PaystackPaymentPages {
  starter: string;
  pro: string;
  vip: string;
  customDeposit: string;
}

export interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  isTest: boolean;
  webhookUrl: string;
  paymentPages: PaystackPaymentPages;
}

const DATA_DIR = path.resolve(process.cwd(), '.data');
const CONFIG_FILE = path.join(DATA_DIR, 'paystack-config.json');

export function sanitizePaymentPageUrl(raw: unknown): string {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  try {
    const withProto = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(withProto);
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'paystack.com' ||
      host.endsWith('.paystack.com') ||
      host === 'paystack.shop' ||
      host.endsWith('.paystack.shop')
    ) {
      return `https://${parsed.host}${parsed.pathname}${parsed.search}`.replace(/\/+$/, '');
    }
    return '';
  } catch {
    return '';
  }
}

export function inferPackageIdFromPaystackData(params: {
  metadata?: any;
  amountKes?: number;
  pageSlug?: string;
  paymentPages?: PaystackPaymentPages;
}): 'starter' | 'pro' | 'vip' | undefined {
  const metaPkg = String(params.metadata?.packageId || '').toLowerCase();
  if (metaPkg === 'starter' || metaPkg === 'pro' || metaPkg === 'vip') {
    return metaPkg;
  }

  const pageSlug = String(params.pageSlug || params.metadata?.referrer || '').toLowerCase();
  if (pageSlug && params.paymentPages) {
    if (params.paymentPages.vip && pageSlug.includes(params.paymentPages.vip.toLowerCase())) return 'vip';
    if (params.paymentPages.pro && pageSlug.includes(params.paymentPages.pro.toLowerCase())) return 'pro';
    if (params.paymentPages.starter && pageSlug.includes(params.paymentPages.starter.toLowerCase())) return 'starter';
  }

  const kes = Number(params.amountKes || 0);
  if (kes >= 200) return 'vip';
  if (kes >= 100) return 'pro';
  if (kes >= 50) return 'starter';
  return undefined;
}

export function loadInitialPaystackConfig(): PaystackConfig {
  const defaultSecret = process.env.PAYSTACK_SECRET_KEY || '';
  const defaultPublic = process.env.PAYSTACK_PUBLIC_KEY || '';
  const baseConfig: PaystackConfig = {
    publicKey: defaultPublic,
    secretKey: defaultSecret,
    isTest: defaultSecret
      ? defaultSecret.startsWith('sk_test_')
      : process.env.PAYSTACK_ENVIRONMENT !== 'live',
    webhookUrl: `${(process.env.APP_URL || 'https://gideon-global-tasks.ai.studio').replace(/\/$/, '')}/api/paystack/webhook`,
    paymentPages: {
      starter: sanitizePaymentPageUrl(process.env.PAYSTACK_PAGE_STARTER || ''),
      pro: sanitizePaymentPageUrl(process.env.PAYSTACK_PAGE_PRO || ''),
      vip: sanitizePaymentPageUrl(process.env.PAYSTACK_PAGE_VIP || ''),
      customDeposit: sanitizePaymentPageUrl(process.env.PAYSTACK_PAGE_DEPOSIT || ''),
    },
  };

  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const saved = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      if (saved && typeof saved === 'object') {
        if (typeof saved.publicKey === 'string' && saved.publicKey.trim()) {
          baseConfig.publicKey = saved.publicKey.trim();
        }
        if (typeof saved.secretKey === 'string' && saved.secretKey.trim()) {
          baseConfig.secretKey = saved.secretKey.trim();
          baseConfig.isTest =
            typeof saved.isTest === 'boolean'
              ? saved.isTest
              : baseConfig.secretKey.startsWith('sk_test_');
        } else if (typeof saved.isTest === 'boolean') {
          baseConfig.isTest = saved.isTest;
        }
        if (typeof saved.webhookUrl === 'string' && saved.webhookUrl.trim()) {
          baseConfig.webhookUrl = saved.webhookUrl.trim();
        }
        if (saved.paymentPages && typeof saved.paymentPages === 'object') {
          baseConfig.paymentPages = {
            starter: sanitizePaymentPageUrl(saved.paymentPages.starter) || baseConfig.paymentPages.starter,
            pro: sanitizePaymentPageUrl(saved.paymentPages.pro) || baseConfig.paymentPages.pro,
            vip: sanitizePaymentPageUrl(saved.paymentPages.vip) || baseConfig.paymentPages.vip,
            customDeposit:
              sanitizePaymentPageUrl(saved.paymentPages.customDeposit) ||
              baseConfig.paymentPages.customDeposit,
          };
        }
      }
    }
  } catch {
    // ignore corrupt disk config
  }

  return baseConfig;
}

export function persistPaystackConfig(config: PaystackConfig): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist Paystack config:', (err as Error)?.message || err);
  }
}
