import express from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { adminDb } from './src/lib/firebase-admin.ts';
import { GoogleGenAI, Type } from '@google/genai';
import { requireAuth, optionalAuth, requireOwner, OWNER_EMAIL, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { completedTasks, referrals, payouts } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { generateSitemapXml } from './src/utils/sitemapGenerator.ts';
import { CANONICAL_PLATFORM_ORIGIN, CANONICAL_PLATFORM_URL, resolvePlatformOrigin } from './src/utils/platformUrl.ts';
import QRCode from 'qrcode';
import {
  EAST_AFRICA_COUNTRIES,
  getCountryByCode,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
  WITHDRAWAL_THRESHOLD_KES,
  WITHDRAWAL_THRESHOLD_USD,
  meetsWithdrawalThreshold,
  isEastAfricaCountryCode,
  isEastAfricaPhone,
} from './src/lib/eastAfrica.ts';
import {
  validateRegistrationInputs,
  registerCustomerAccount,
  getCustomerByIdentifier,
  getCustomerByUid,
  ensureShadowCustomerForGoogleUid,
  isPhoneOwnedByDifferentCustomer,
  listAllCustomerProfiles,
  recordCustomerLoginSuccess,
  verifyPassword,
  saveCustomerRecord,
  updateCustomerProfileDetails,
  ownerResetCustomerWithdrawalLock,
  ImmutableFieldError,
  toPublicCustomerProfile,
  signCustomerToken,
  verifyCustomerToken,
  generateBase32Secret,
  verifyTotpCode,
  buildOtpAuthUri,
  sendSmsOtp,
  verifySmsOtp,
  normalizeEastAfricaPhone,
  maskPhone,
  banCustomerPermanently,
  unbanCustomerByOwner,
  isIdentifierOrAccountBanned,
  deactivateCustomerAccount,
  reactivateCustomerAccount,
  deleteCustomerAccountPermanently,
  ownerUpdateCustomerRecord,
  hydrateCustomerFromClientFirestore,
} from './src/lib/customerAuth.ts';
import {
  listAuctions,
  getAuctionById,
  createAuction,
  placeAuctionBid,
  buyNowAuction,
  closeOrCancelAuction,
  ownerUpdateAuction,
  deleteAuction,
  hydrateAuctionFromClient,
} from './src/lib/auctionsStore.ts';
import {
  listPpvFeed,
  createPpvPost,
  recordPpvView,
  resolvePpvMediaFilePath,
  deletePpvPost,
  ownerForceSettlePpvPost,
  processMaturePpvStatuses,
  hydratePpvFromClient,
} from './src/lib/ppvStore.ts';
import {
  createSupportTicket,
  listAllSupportTickets,
  updateSupportTicket,
} from './src/lib/supportTicketsStore.ts';
import {
  upsertTaskAlertSubscription,
  getTaskAlertsForUser,
  deleteTaskAlertSubscription,
  listAllTaskAlertsForOwner,
  dispatchAlertsForNewTask,
  hydrateTaskAlertFromClient,
} from './src/lib/taskAlertsStore.ts';
import {
  adminEmailNotificationHandler,
  getPublicAdminNotificationStatus,
  notifyAdminPlatformEvent,
  sendAdminTestEmail,
  updateAdminNotificationSettings,
} from './src/lib/adminNotifications.ts';
import {
  buildPayPalCheckoutLinks,
  capturePayPalRestOrder,
  createPayPalOrderOrLink,
  dispatchZapierWorkflowEvent,
  getPublicPayPalAndZapierStatus,
  recordZapierLog,
  updatePayPalAndZapierConfig,
} from './src/lib/paypalAndZapier.ts';
import {
  getKycByUid,
  getOrHydrateKycByUid,
  getKycStatusForUid,
  isCustomerKycApproved,
  submitKycSubmission,
  hydrateKycFromClientBackup,
  listAllKycSubmissions,
  approveKycSubmission,
  rejectKycSubmission,
} from './src/lib/kycStore.ts';
import {
  createWithdrawalRequest,
  hydrateWithdrawalsFromFirestore,
  listAllWithdrawals,
  listCustomerWithdrawals,
  getWithdrawalById,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
} from './src/lib/withdrawalsStore.ts';
import {
  hydrateCustomerStatesFromFirestore,
  getOrCreateCustomerState,
  saveMergedCustomerState,
  registerReferralAttribution,
  recordServerWithdrawalDebit,
  syncServerWithdrawalDecision,
  ownerUpdateCustomerStateSupport,
  listAllCustomerStatesSummary,
} from './src/lib/customerStateStore.ts';
import {
  upsertPlatformTransaction,
  listAllPlatformTransactions,
} from './src/lib/transactionsStore.ts';
import {
  INVESTMENT_PLANS,
  MIN_INVESTMENT_KES,
  createInvestmentDeposit,
  listAllInvestments,
  listCustomerInvestments,
  approveInvestment,
  rejectInvestment,
  settleInvestment,
  ownerUpdateInvestment,
  deleteInvestment,
  InvestmentValidationError,
} from './src/lib/investmentsStore.ts';
import {
  createTestimonial,
  listPublicTestimonials,
  listAllTestimonialsForOwner,
  ownerUpdateTestimonial,
  deleteTestimonial,
  TestimonialError,
} from './src/lib/testimonialsStore.ts';
import {
  executeLiveOutboundTransfer,
  getGatewayReadiness,
  type PayoutGatewayMode,
} from './src/lib/payoutGateway.ts';
import {
  getPublicSmsGatewayStatus,
  saveSmsGatewayConfig,
  dispatchSmsViaGateway,
  type SmsProviderType,
} from './src/lib/smsGateway.ts';
import {
  createCreatorCampaignSubmission,
  listCreatorCampaignSubmissions,
} from './src/lib/creatorCampaignStore.ts';
import {
  OPEN_ACCESS_DAILY_LIMIT,
  DAILY_DROP_TASK_IDS,
  getEatNowInfo,
  formatCountdownHms,
  getDailyDroppedTaskId,
  getUserDailyQuotaRecord,
  validateAndRecordDailyTaskUsage,
} from './src/lib/dailyQuotaStore.ts';

dotenv.config();
void hydrateWithdrawalsFromFirestore();
void hydrateCustomerStatesFromFirestore();

const app = express();
app.use(compression({
  filter: (req, res) => {
    if (req.path === '/api/chat/stream' || req.headers.accept === 'text/event-stream') {
      return false;
    }
    return compression.filter(req, res);
  },
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Security Headers for AdSense & Browser Hardening (HSTS, CSP, nosniff)
app.use((_req, res, next) => {
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self' https: data: blob: 'unsafe-inline' 'unsafe-eval'; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.gstatic.com https://apis.google.com https://adservice.google.com https://*.google-analytics.com https://unpkg.com https://www.paypal.com https://*.paypal.com https://*.paypalobjects.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.paypal.com https://*.paypalobjects.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob: https://*.paypal.com https://*.paypalobjects.com; " +
    "frame-src 'self' https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.firebaseapp.com https://www.paypal.com https://*.paypal.com; " +
    "connect-src 'self' https: wss: https://firestore.googleapis.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.paypal.com https://api-m.paypal.com https://api-m.sandbox.paypal.com;"
  );
  next();
});

// Shared Gemini client utility
const apiKey = process.env.GEMINI_API_KEY || '';
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Publisher & Search Engine Configuration
const DEFAULT_CANONICAL_URL = CANONICAL_PLATFORM_URL;

const PUBLISHER_CONFIG_FILE = path.resolve(process.cwd(), '.data', 'publisher-config.json');

interface PublisherConfigState {
  searchConsoleToken: string;
  adsensePublisherId: string;
  adsenseClientId: string;
  monetagEnabled: boolean;
  monetagDomain: string;
  monetagZoneId: string;
  monetagMetaTag: string;
  monetagScriptSrc: string;
  monetagScriptTag: string;
  monetagSwCode: string;
  monetagSourceAsset: string;
  canonicalUrl: string;
}

const DEFAULT_PUBLISHER_CONFIG: PublisherConfigState = {
  searchConsoleToken: 'google2d71976008fafb8e',
  adsensePublisherId: 'pub-8366092986496846',
  adsenseClientId: 'ca-pub-8366092986496846',
  monetagEnabled: true,
  monetagDomain: '5gvci.com',
  monetagZoneId: '12292827',
  monetagMetaTag: '',
  monetagScriptSrc: '',
  monetagScriptTag: '',
  monetagSwCode:
    'self.options = {\n    "domain": "5gvci.com",\n    "zoneId": 12292827\n}\nself.lary = ""\nimportScripts(\'https://5gvci.com/act/files/service-worker.min.js?r=sw\')',
  monetagSourceAsset: '/assets/aistudio/sw_563a301a.js',
  canonicalUrl: DEFAULT_CANONICAL_URL
};

function loadPublisherConfig(): PublisherConfigState {
  try {
    if (fs.existsSync(PUBLISHER_CONFIG_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(PUBLISHER_CONFIG_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') {
        const merged = { ...DEFAULT_PUBLISHER_CONFIG, ...parsed };
        if (/run\.app|gideonglobal\.com|localhost/i.test(String(merged.canonicalUrl || ''))) {
          merged.canonicalUrl = DEFAULT_CANONICAL_URL;
        }
        return merged;
      }
    }
  } catch {
    // fallback to defaults
  }
  return { ...DEFAULT_PUBLISHER_CONFIG };
}

function persistPublisherConfig(cfg: PublisherConfigState, updatedBy = OWNER_EMAIL) {
  try {
    const dir = path.dirname(PUBLISHER_CONFIG_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PUBLISHER_CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.warn('Could not persist publisher config:', (err as Error)?.message || err);
  }
  if (adminDb) {
    try {
      adminDb
        .collection('platform_settings')
        .doc('global')
        .set(
          {
            searchConsoleToken: cfg.searchConsoleToken,
            adsensePublisherId: cfg.adsensePublisherId,
            adsenseClientId: cfg.adsenseClientId,
            monetagEnabled: cfg.monetagEnabled,
            monetagDomain: cfg.monetagDomain,
            monetagZoneId: cfg.monetagZoneId,
            monetagMetaTag: cfg.monetagMetaTag,
            monetagScriptSrc: cfg.monetagScriptSrc,
            monetagScriptTag: cfg.monetagScriptTag,
            monetagSwCode: cfg.monetagSwCode,
            monetagSourceAsset: cfg.monetagSourceAsset,
            updatedBy,
            updatedAt: new Date(),
          },
          { merge: true }
        )
        .catch(() => {});
    } catch {
      // non-blocking
    }
  }
}

let publisherConfig: PublisherConfigState = loadPublisherConfig();

if (adminDb) {
  adminDb
    .collection('platform_settings')
    .doc('global')
    .get()
    .then((snap) => {
      if (snap.exists) {
        const d = snap.data() || {};
        publisherConfig = {
          ...publisherConfig,
          ...(typeof d.searchConsoleToken === 'string' && d.searchConsoleToken ? { searchConsoleToken: d.searchConsoleToken } : {}),
          ...(typeof d.adsensePublisherId === 'string' && d.adsensePublisherId ? { adsensePublisherId: d.adsensePublisherId } : {}),
          ...(typeof d.adsenseClientId === 'string' && d.adsenseClientId ? { adsenseClientId: d.adsenseClientId } : {}),
          ...(typeof d.monetagEnabled === 'boolean' ? { monetagEnabled: d.monetagEnabled } : {}),
          ...(typeof d.monetagDomain === 'string' && d.monetagDomain ? { monetagDomain: d.monetagDomain } : {}),
          ...(typeof d.monetagZoneId === 'string' && d.monetagZoneId ? { monetagZoneId: d.monetagZoneId } : {}),
          ...(typeof d.monetagMetaTag === 'string' ? { monetagMetaTag: d.monetagMetaTag } : {}),
          ...(typeof d.monetagScriptSrc === 'string' ? { monetagScriptSrc: d.monetagScriptSrc } : {}),
          ...(typeof d.monetagScriptTag === 'string' ? { monetagScriptTag: d.monetagScriptTag } : {}),
          ...(typeof d.monetagSwCode === 'string' ? { monetagSwCode: d.monetagSwCode } : {}),
        };
      }
    })
    .catch(() => {});
}

function resolveCanonicalOrigin(req: express.Request): string {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.get('host') || '';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  if (host) {
    return resolvePlatformOrigin(`${proto}://${host}`);
  }
  return resolvePlatformOrigin(publisherConfig.canonicalUrl);
}

// --- East Africa Exclusive Region Enforcement ---
function extractHeaderCountry(req: express.Request): string | null {
  const candidates = [
    req.headers['cf-ipcountry'],
    req.headers['x-appengine-country'],
    req.headers['x-vercel-ip-country'],
    req.headers['fastly-client-country'],
    req.headers['x-country-code'],
    req.headers['x-geo-country'],
  ];
  for (const val of candidates) {
    if (typeof val === 'string' && val.trim().length === 2) {
      const upper = val.trim().toUpperCase();
      if (upper !== 'ZZ' && upper !== 'XX' && upper !== 'T1') {
        return upper;
      }
    }
  }
  return null;
}

function requireEastAfrica(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authedUser = (req as AuthRequest).user;
  if (authedUser?.email?.toLowerCase() === 'nigideon36@gmail.com' && authedUser?.email_verified) {
    return next();
  }

  const headerCountry = extractHeaderCountry(req);
  const explicitCountry =
    (typeof req.headers['x-ea-country'] === 'string' && req.headers['x-ea-country']) ||
    (req.body && typeof req.body.countryCode === 'string' && req.body.countryCode) ||
    '';

  if (explicitCountry && !isEastAfricaCountryCode(explicitCountry)) {
    return res.status(403).json({
      error: 'East Africa Access Only: Gideon Global Tasks is exclusively available in Kenya, Uganda, Tanzania, Rwanda, Burundi, South Sudan, Ethiopia, and Somalia.'
    });
  }

  const hasEaVerifiedHeader = req.headers['x-ea-verified'] === 'true';
  if (headerCountry && !isEastAfricaCountryCode(headerCountry) && !hasEaVerifiedHeader) {
    return res.status(403).json({
      error: `East Africa Access Only: Access from ${headerCountry} is restricted. Only East African countries are supported.`
    });
  }

  next();
}

app.get('/api/region/status', (req, res) => {
  const detectedCountry = extractHeaderCountry(req);
  const blockedByHeader = Boolean(detectedCountry && !isEastAfricaCountryCode(detectedCountry));
  const allowedByHeader = Boolean(detectedCountry && isEastAfricaCountryCode(detectedCountry));
  res.json({
    eastAfricaOnly: true,
    allowedCountries: EAST_AFRICA_COUNTRIES,
    detectedCountry,
    blockedByHeader,
    allowedByHeader,
  });
});

app.post('/api/region/verify', (req, res) => {
  const { countryCode, phone } = req.body || {};
  if (!isEastAfricaCountryCode(countryCode)) {
    return res.status(403).json({
      success: false,
      error: 'Access denied: Only East African countries (KE, UG, TZ, RW, BI, SS, ET, SO) are permitted.'
    });
  }
  if (phone && !isEastAfricaPhone(String(phone))) {
    return res.status(400).json({
      success: false,
      error: 'Please provide a valid East Africa mobile number (e.g. +254, +256, +255, +250).'
    });
  }
  return res.json({
    success: true,
    countryCode: String(countryCode).toUpperCase(),
    eastAfricaOnly: true
  });
});

// --- Google Search Console & AdSense Routes ---
app.get('/google2d71976008fafb8e.html', (_req, res) => {
  res.type('text/html').send('google-site-verification: google2d71976008fafb8e.html\n');
});

app.get('/robots.txt', (req, res) => {
  const baseUrl = resolveCanonicalOrigin(req);
  res.type('text/plain; charset=utf-8').send([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Mediapartners-Google',
    'Allow: /',
    '',
    `Sitemap: ${baseUrl}/sitemap.xml`
  ].join('\n') + '\n');
});

app.get('/sitemap.xml', (req, res) => {
  const baseUrl = resolveCanonicalOrigin(req);
  const xml = generateSitemapXml(baseUrl);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.type('application/xml; charset=utf-8').send(xml);
});

app.get('/ads.txt', (_req, res) => {
  const pubId = publisherConfig.adsensePublisherId.replace(/^ca-/, '');
  res.type('text/plain; charset=utf-8').send(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
});

// --- Monetag Push / Service Worker Route (/sw.js) ---
app.get('/sw.js', (_req, res) => {
  if (!publisherConfig.monetagEnabled) {
    return res
      .status(404)
      .type('application/javascript; charset=utf-8')
      .send('// Monetag monetization service worker is currently disabled.\n');
  }

  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Service-Worker-Allowed', '/');
  res.setHeader('Cache-Control', 'no-cache, must-revalidate');

  if (
    publisherConfig.monetagSwCode &&
    publisherConfig.monetagSwCode.includes('importScripts(')
  ) {
    return res.send(publisherConfig.monetagSwCode);
  }

  const domain = String(publisherConfig.monetagDomain || '3nbf4.com')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .slice(0, 120) || '3nbf4.com';
  const rawZone = String(publisherConfig.monetagZoneId || '12292694').replace(/[^0-9]/g, '');
  const zoneNum = Number(rawZone) || 12292694;

  if (domain === '3nbf4.com' && zoneNum === 12292694) {
    const attachedSw = path.resolve(process.cwd(), 'public', 'assets', 'aistudio', 'sw_563a301a.js');
    if (fs.existsSync(attachedSw)) {
      return res.send(fs.readFileSync(attachedSw, 'utf8'));
    }
  }

  return res.send(
    `self.options = {\n    "domain": "${domain}",\n    "zoneId": ${zoneNum}\n}\nself.lary = ""\nimportScripts('https://${domain}/act/files/service-worker.min.js?r=sw')\n`
  );
});

app.get('/api/publisher-config', (_req, res) => {
  res.json(publisherConfig);
});

app.post('/api/publisher-config', requireOwner, (req: AuthRequest, res) => {
  const {
    searchConsoleToken,
    adsensePublisherId,
    adsenseClientId,
    monetagEnabled,
    monetagDomain,
    monetagZoneId,
    monetagMetaTag,
    monetagScriptSrc,
    monetagScriptTag,
    monetagSwCode,
  } = req.body || {};

  if (typeof searchConsoleToken === 'string' && searchConsoleToken.trim()) {
    publisherConfig.searchConsoleToken = searchConsoleToken.trim().slice(0, 128);
  }
  if (typeof adsensePublisherId === 'string' && adsensePublisherId.trim()) {
    publisherConfig.adsensePublisherId = adsensePublisherId.trim().slice(0, 64);
  }
  if (typeof adsenseClientId === 'string' && adsenseClientId.trim()) {
    publisherConfig.adsenseClientId = adsenseClientId.trim().slice(0, 64);
  }
  if (typeof monetagEnabled === 'boolean') {
    publisherConfig.monetagEnabled = monetagEnabled;
  }
  if (typeof monetagDomain === 'string' && monetagDomain.trim()) {
    publisherConfig.monetagDomain = monetagDomain.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '').slice(0, 120);
  }
  if (typeof monetagZoneId === 'string' || typeof monetagZoneId === 'number') {
    const cleanedZone = String(monetagZoneId).replace(/[^0-9]/g, '').slice(0, 32);
    if (cleanedZone) publisherConfig.monetagZoneId = cleanedZone;
  }
  if (typeof monetagMetaTag === 'string') {
    publisherConfig.monetagMetaTag = monetagMetaTag.trim().replace(/["<>]/g, '').slice(0, 128);
  }
  if (typeof monetagScriptSrc === 'string') {
    const cleanedScript = monetagScriptSrc.trim().slice(0, 300);
    if (!cleanedScript || /^https:\/\/[a-zA-Z0-9.-]+/.test(cleanedScript)) {
      publisherConfig.monetagScriptSrc = cleanedScript;
    }
  }
  if (typeof monetagScriptTag === 'string') {
    const trimmed = monetagScriptTag.trim().slice(0, 1000);
    if (!trimmed) {
      publisherConfig.monetagScriptTag = '';
    } else if (/^<script\b[^>]*>[\s\S]*<\/script>$/i.test(trimmed) && !/<\/script>[\s\S]*<script/i.test(trimmed)) {
      publisherConfig.monetagScriptTag = trimmed;
      const srcMatch = trimmed.match(/src\s*=\s*["'](https:\/\/[^"']+)["']/i);
      if (srcMatch?.[1]) {
        publisherConfig.monetagScriptSrc = srcMatch[1].slice(0, 300);
      } else if (typeof monetagScriptSrc !== 'string' || !monetagScriptSrc.trim()) {
        publisherConfig.monetagScriptSrc = '';
      }
      const zoneMatch = trimmed.match(/data-zone\s*=\s*["']([0-9]+)["']/i);
      if (zoneMatch?.[1] && !monetagZoneId) {
        publisherConfig.monetagZoneId = zoneMatch[1].slice(0, 32);
      }
    } else if (/^https:\/\/[a-zA-Z0-9.-]+/.test(trimmed)) {
      publisherConfig.monetagScriptSrc = trimmed.slice(0, 300);
      publisherConfig.monetagScriptTag = `<script src="${trimmed.slice(0, 300)}" async data-cfasync="false"></script>`;
    }
  }
  if (typeof monetagSwCode === 'string') {
    const trimmedSw = monetagSwCode.trim().slice(0, 1000);
    if (!trimmedSw) {
      publisherConfig.monetagSwCode = '';
    } else if (trimmedSw.includes('importScripts(') && trimmedSw.includes('https://')) {
      publisherConfig.monetagSwCode = trimmedSw;
      const domMatch = trimmedSw.match(/"domain"\s*:\s*"([^"]+)"/);
      if (domMatch?.[1]) publisherConfig.monetagDomain = domMatch[1].slice(0, 120);
      const zMatch = trimmedSw.match(/"zoneId"\s*:\s*(\d+)/);
      if (zMatch?.[1]) publisherConfig.monetagZoneId = zMatch[1].slice(0, 32);
    }
  }

  persistPublisherConfig(publisherConfig, req.user?.email || OWNER_EMAIL);
  res.json({ success: true, config: publisherConfig });
});

// --- PayPal International Payment Gateway & Zapier Workflow Integration (Only Supported Gateway) ---
const payPalOrders = new Map<string, any>();

app.get('/api/paypal/config', (_req, res) => {
  return res.json({
    success: true,
    ...getPublicPayPalAndZapierStatus(),
  });
});

app.post('/api/paypal/config', requireOwner, (req, res) => {
  try {
    const { enabled, primaryEmail, payPalMeHandle, mode, zapierWebhookUrl } = req.body || {};
    const status = updatePayPalAndZapierConfig({
      enabled: enabled !== undefined ? Boolean(enabled) : undefined,
      primaryEmail: primaryEmail !== undefined ? String(primaryEmail) : undefined,
      payPalMeHandle: payPalMeHandle !== undefined ? String(payPalMeHandle) : undefined,
      mode: mode === 'sandbox' ? 'sandbox' : mode === 'live' ? 'live' : undefined,
      zapierWebhookUrl: zapierWebhookUrl !== undefined ? String(zapierWebhookUrl) : undefined,
    });
    return res.json({
      success: true,
      message: 'PayPal International & Zapier workflow settings saved.',
      ...status,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Could not update PayPal & Zapier configuration.',
    });
  }
});

app.post('/api/paypal/generate-link', optionalAuth, (req: AuthRequest, res) => {
  try {
    const { itemName, amountUsd, packageId, customId, returnUrl } = req.body || {};
    const linkEntry = buildPayPalCheckoutLinks({
      itemName: String(itemName || 'Gideon Global Tasks International Order'),
      amountUsd: Number(amountUsd || 1),
      packageId: packageId ? String(packageId) : undefined,
      customId: customId ? String(customId) : req.user?.uid,
      returnUrl: returnUrl ? String(returnUrl) : undefined,
    });

    void dispatchZapierWorkflowEvent({
      event: 'paypal_link_generated',
      amountUsd: linkEntry.amountUsd,
      transactionId: linkEntry.id,
      payerEmail: req.user?.email,
      payerName: req.user?.name,
      packageId: linkEntry.packageId,
      itemName: linkEntry.itemName,
      data: {
        checkoutUrl: linkEntry.checkoutUrl,
        payPalMeUrl: linkEntry.payPalMeUrl,
      },
    });

    return res.json({
      success: true,
      link: linkEntry,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Could not generate PayPal checkout link.',
    });
  }
});

app.post('/api/paypal/create-order', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { itemName, amountUsd, packageId, customId, returnUrl } = req.body || {};
    const result = await createPayPalOrderOrLink({
      itemName: String(itemName || 'Gideon Global Tasks Order'),
      amountUsd: Number(amountUsd || 1),
      packageId: packageId ? String(packageId) : undefined,
      customId: customId ? String(customId) : req.user?.uid,
      returnUrl: returnUrl ? String(returnUrl) : undefined,
    });

    payPalOrders.set(result.orderId, {
      ...result,
      status: 'CREATED',
      buyerEmail: req.user?.email,
      createdAt: new Date().toISOString(),
    });

    upsertPlatformTransaction({
      id: result.orderId,
      kind: 'paypal_checkout',
      title: `PayPal Checkout: ${result.itemName}`,
      customerLabel: req.user?.email || req.user?.name || 'International Buyer (PayPal)',
      gatewayOrMethod: 'PayPal (USD)',
      currency: 'USD',
      amountLocal: result.amountUsd,
      amountUsd: result.amountUsd,
      status: 'Pending',
      reference: result.orderId,
      countryCode: 'US',
      metadata: {
        packageId: packageId ? String(packageId) : 'custom',
        restApiOrder: result.restApiOrder,
        mode: result.mode,
      },
    });

    void dispatchZapierWorkflowEvent({
      event: 'paypal_order_created',
      amountUsd: result.amountUsd,
      transactionId: result.orderId,
      payerEmail: req.user?.email,
      payerName: req.user?.name,
      packageId: packageId ? String(packageId) : undefined,
      itemName: result.itemName,
      data: {
        approveUrl: result.approveUrl,
        payPalMeUrl: result.payPalMeUrl,
      },
    });

    return res.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Could not create PayPal checkout order.',
    });
  }
});

app.post('/api/paypal/capture-order', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = String(req.body?.orderId || '').trim();
    if (!orderId) {
      return res.status(400).json({ success: false, error: 'orderId is required.' });
    }
    const capture = await capturePayPalRestOrder(orderId);
    if (capture.captured) {
      const prev = payPalOrders.get(orderId);
      const amountUsd = capture.amountUsd || prev?.amountUsd || 1;
      payPalOrders.set(orderId, { ...(prev || {}), ...capture, status: 'COMPLETED' });

      upsertPlatformTransaction({
        id: orderId,
        kind: 'paypal_checkout',
        title: `PayPal Payment Captured (${prev?.itemName || orderId})`,
        customerLabel: capture.payerEmail || req.user?.email || 'International Buyer',
        gatewayOrMethod: 'PayPal (USD)',
        currency: 'USD',
        amountLocal: amountUsd,
        amountUsd,
        status: 'Completed',
        reference: capture.transactionId || orderId,
        countryCode: 'US',
        metadata: {
          orderId,
          transactionId: capture.transactionId,
        },
      });

      void notifyAdminPlatformEvent({
        eventType: 'investment_deposit',
        title: `PayPal Payment Completed: $${amountUsd.toFixed(2)} USD`,
        summary: `PayPal buyer (${capture.payerEmail || 'PayPal'}) completed order ${orderId}.`,
        actorEmail: capture.payerEmail || req.user?.email,
        amountLabel: `$${amountUsd.toFixed(2)} USD`,
        details: {
          OrderId: orderId,
          TransactionId: capture.transactionId || orderId,
          Item: prev?.itemName || 'PayPal Checkout Order',
        },
      });

      void dispatchZapierWorkflowEvent({
        event: 'paypal_payment_completed',
        amountUsd,
        transactionId: capture.transactionId || orderId,
        payerEmail: capture.payerEmail || req.user?.email,
        itemName: prev?.itemName,
      });
    }

    return res.json({ success: true, ...capture });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Could not capture PayPal order.',
    });
  }
});

app.post('/api/paypal/submit-proof', optionalAuth, (req: AuthRequest, res) => {
  try {
    const { transactionId, payerEmail, payerName, amountUsd, packageId, itemName } = req.body || {};
    const cleanTxn = String(transactionId || '').trim().toUpperCase();
    if (!/^[A-Z0-9_-]{6,40}$/.test(cleanTxn)) {
      return res.status(400).json({
        success: false,
        error: 'Enter a valid PayPal Transaction ID (6–40 letters/numbers) from your PayPal receipt.',
      });
    }
    const cleanEmail = String(payerEmail || req.user?.email || '').trim();
    const numericUsd = Math.max(0.35, Number(amountUsd || 1));

    const txRecord = upsertPlatformTransaction({
      id: `PP-${cleanTxn}`,
      kind: 'investment_deposit',
      title: `PayPal Payment Proof: ${String(itemName || packageId || 'Investment / Escrow')}`,
      customerLabel: String(payerName || cleanEmail || 'PayPal Buyer'),
      gatewayOrMethod: 'PayPal (USD)',
      currency: 'USD',
      amountLocal: numericUsd,
      amountUsd: numericUsd,
      status: 'Pending',
      reference: cleanTxn,
      countryCode: 'US',
      metadata: {
        payerEmail: cleanEmail || undefined,
        packageId: packageId ? String(packageId) : undefined,
      },
    });

    void notifyAdminPlatformEvent({
      eventType: 'investment_deposit',
      title: `PayPal Receipt Submitted: $${numericUsd.toFixed(2)} USD (${cleanTxn})`,
      summary: `${payerName || cleanEmail || 'PayPal Payer'} submitted PayPal Transaction ${cleanTxn} for ${itemName || 'Platform Deposit'}.`,
      actorName: payerName ? String(payerName) : undefined,
      actorEmail: cleanEmail || undefined,
      amountLabel: `$${numericUsd.toFixed(2)} USD`,
      details: {
        TransactionId: cleanTxn,
        Item: String(itemName || 'PayPal Payment'),
        PayerEmail: cleanEmail || 'Not provided',
      },
    });

    void dispatchZapierWorkflowEvent({
      event: 'paypal_proof_submitted',
      amountUsd: numericUsd,
      transactionId: cleanTxn,
      payerEmail: cleanEmail || undefined,
      payerName: payerName ? String(payerName) : undefined,
      packageId: packageId ? String(packageId) : undefined,
      itemName: itemName ? String(itemName) : undefined,
    });

    return res.status(201).json({
      success: true,
      message: `PayPal Transaction ${cleanTxn} received! Owner verification & Zapier automation workflow triggered.`,
      transaction: txRecord,
    });
  } catch (err: any) {
    return res.status(400).json({
      success: false,
      error: err?.message || 'Could not submit PayPal receipt.',
    });
  }
});

app.post('/api/paypal/zapier-webhook', optionalAuth, (req: AuthRequest, res) => {
  try {
    const configuredSecret = (process.env.ZAPIER_WEBHOOK_SECRET || '').trim();
    const providedSecret = String(
      req.headers['x-zapier-secret'] || req.query.secret || req.body?.secret || ''
    ).trim();

    if (configuredSecret && providedSecret !== configuredSecret && req.user?.email?.toLowerCase() !== OWNER_EMAIL) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or missing x-zapier-secret header.',
      });
    }

    const body = req.body || {};
    const eventName = String(body.event || body.event_type || 'zapier_paypal_sale').trim();
    const txnId = String(body.transactionId || body.txn_id || body.id || `ZAP-${Date.now()}`).trim();
    const payerEmail = body.payerEmail || body.payer_email || body.email;
    const payerName = body.payerName || body.payer_name || body.name;
    const amountUsd = Math.max(0.35, Number(body.amountUsd || body.amount || body.mc_gross || 1));
    const itemName = String(body.itemName || body.item_name || 'Zapier PayPal Order').trim();

    const log = recordZapierLog({
      direction: 'inbound',
      event: eventName,
      status: 'Received',
      detail: `Inbound Zapier automation for "${itemName}" from ${payerEmail || payerName || 'PayPal Buyer'}.`,
      amountUsd,
      transactionId: txnId,
    });

    const txRecord = upsertPlatformTransaction({
      id: `ZAP-${txnId}`,
      kind: 'investment_deposit',
      title: `Zapier PayPal: ${itemName}`,
      customerLabel: String(payerName || payerEmail || 'Zapier Buyer'),
      gatewayOrMethod: 'PayPal + Zapier',
      currency: 'USD',
      amountLocal: amountUsd,
      amountUsd,
      status: 'Completed',
      reference: txnId,
      countryCode: 'US',
      metadata: {
        payerEmail: payerEmail ? String(payerEmail) : undefined,
        zapierEvent: eventName,
      },
    });

    void notifyAdminPlatformEvent({
      eventType: 'investment_deposit',
      title: `Zapier PayPal Webhook: $${amountUsd.toFixed(2)} USD (${itemName})`,
      summary: `Zapier workflow "${eventName}" synced PayPal transaction ${txnId} (${payerEmail || payerName || 'Buyer'}).`,
      actorEmail: payerEmail ? String(payerEmail) : undefined,
      actorName: payerName ? String(payerName) : undefined,
      amountLabel: `$${amountUsd.toFixed(2)} USD`,
      details: {
        TransactionId: txnId,
        Event: eventName,
        Item: itemName,
      },
    });

    return res.json({
      success: true,
      message: 'Zapier PayPal workflow processed cleanly.',
      log,
      transaction: txRecord,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Could not process Zapier webhook payload.',
    });
  }
});

app.post('/api/paypal/zapier-test', requireOwner, async (_req: AuthRequest, res) => {
  const log = await dispatchZapierWorkflowEvent({
    event: 'zapier_workflow_test',
    amountUsd: 1.54,
    transactionId: `TEST-ZAP-${Date.now()}`,
    payerEmail: OWNER_EMAIL,
    payerName: 'Gideon Owner Test',
    itemName: 'Growth Pool Deposit (PayPal Test)',
  });
  return res.json({
    success: log.status !== 'Failed',
    log,
    status: getPublicPayPalAndZapierStatus(),
  });
});

app.get('/api/paypal/order/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = payPalOrders.get(orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

app.post('/api/paypal/webhook', (req, res) => {
  try {
    const event = req.body || {};
    const eventType = String(event?.event_type || event?.txn_type || 'PayPal Webhook');
    const resource = event?.resource || event;
    const amountUsd = Number(resource?.amount?.value || resource?.mc_gross || 0) || undefined;
    const txnId = String(resource?.id || resource?.txn_id || `PPWH-${Date.now()}`);

    recordZapierLog({
      direction: 'inbound',
      event: eventType,
      status: 'Received',
      detail: `PayPal webhook "${eventType}" received for ${txnId}.`,
      amountUsd,
      transactionId: txnId,
    });

    void dispatchZapierWorkflowEvent({
      event: `paypal_ipn_${eventType}`,
      amountUsd,
      transactionId: txnId,
      payerEmail: resource?.payer_email || resource?.payer?.email_address,
      data: { rawEventType: eventType },
    });

    res.json({ status: 'received' });
  } catch (err) {
    res.status(500).json({ error: 'Webhook error' });
  }
});

// --- Customer Mobile Registration, Login & 2FA (SMS / Authenticator App TOTP) ---

// 1a. Request mandatory 6-digit SMS OTP before completing customer registration
app.post('/api/customer/register/request-otp', requireEastAfrica, async (req, res) => {
  try {
    const { phone, countryCode, email, password } = req.body || {};
    const { normalizedPhone } = validateRegistrationInputs({
      phone: String(phone || ''),
      countryCode: countryCode ? String(countryCode) : undefined,
      email: email ? String(email) : undefined,
      password: String(password || ''),
    });

    const smsResult = await sendSmsOtp(normalizedPhone, 'register');
    return res.json({
      success: true,
      maskedPhone: smsResult.maskedPhone,
      normalizedPhone,
      carrierDelivered: smsResult.carrierDelivered,
      smsDeliveryMode: smsResult.deliveryMode,
      providerLabel: smsResult.providerLabel,
      ...(smsResult.carrierMessageId ? { carrierMessageId: smsResult.carrierMessageId } : {}),
      ...(smsResult.fallbackReason ? { fallbackReason: smsResult.fallbackReason } : {}),
      ...(smsResult.previewCode ? { previewCode: smsResult.previewCode } : {}),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not send registration SMS OTP.',
    });
  }
});

// 1b. Verify mandatory SMS OTP & register new East Africa customer account
app.post('/api/customer/register', requireEastAfrica, async (req, res) => {
  try {
    const {
      phone,
      countryCode,
      email,
      displayName,
      city,
      password,
      otpCode,
      withdrawalMethod,
      withdrawalAccount,
      withdrawalAccountHolder,
      referralCode,
    } = req.body || {};
    const { normalizedPhone } = validateRegistrationInputs({
      phone: String(phone || ''),
      countryCode: countryCode ? String(countryCode) : undefined,
      email: email ? String(email) : undefined,
      password: String(password || ''),
    });

    const cleanOtp = String(otpCode || '').trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        error: 'A 6-digit SMS OTP sent to your phone is required to complete registration.',
      });
    }

    const otpValid = verifySmsOtp(normalizedPhone, 'register', cleanOtp);
    if (!otpValid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired SMS OTP code. Please request a new SMS code and try again.',
      });
    }

    const record = registerCustomerAccount({
      phone: normalizedPhone,
      countryCode: countryCode ? String(countryCode) : undefined,
      email: email ? String(email) : undefined,
      displayName: displayName ? String(displayName) : undefined,
      city: city ? String(city) : undefined,
      password: String(password || ''),
      phoneVerified: true,
      withdrawalMethod: withdrawalMethod ? String(withdrawalMethod) : undefined,
      withdrawalAccount: withdrawalAccount ? String(withdrawalAccount) : undefined,
      withdrawalAccountHolder: withdrawalAccountHolder ? String(withdrawalAccountHolder) : undefined,
      referralCode: referralCode ? String(referralCode) : undefined,
    });

    if (referralCode) {
      registerReferralAttribution({
        newUserUid: record.uid,
        newUserName: record.displayName,
        countryCode: record.countryCode,
        referredByCode: String(referralCode),
      });
    }

    void notifyAdminPlatformEvent({
      eventType: 'new_registration',
      title: `New Customer Registered: ${record.displayName}`,
      summary: `${record.displayName} (${record.countryCode}) completed SMS-verified registration on Gideon Global Tasks.`,
      actorName: record.displayName,
      actorPhone: record.phone,
      actorEmail: record.email,
      countryCode: record.countryCode,
      details: {
        UID: record.uid,
        City: record.city || 'Not provided',
        PayoutMethod: record.withdrawalDetails?.method || 'Not set',
        ReferredBy: record.referredByCode || 'Direct / Organic',
      },
    });

    const token = signCustomerToken(record, 'session');
    return res.status(201).json({
      success: true,
      token,
      customer: toPublicCustomerProfile(record),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Registration failed',
    });
  }
});

// 2. Customer Sign In with Mobile Number OR Email + Password (triggers 2FA challenge if enabled)
app.post('/api/customer/login', requireEastAfrica, async (req, res) => {
  try {
    const { identifier, phone, countryCode, password } = req.body || {};
    const loginIdentifier = String(identifier || phone || '').trim();
    const record = getCustomerByIdentifier(loginIdentifier, countryCode ? String(countryCode) : undefined);
    if (!record || !record.passwordHash || !verifyPassword(String(password || ''), record.passwordHash)) {
      const banCheck = isIdentifierOrAccountBanned({
        phone: loginIdentifier.includes('@') ? undefined : loginIdentifier,
        email: loginIdentifier.includes('@') ? loginIdentifier : undefined,
        countryCode: countryCode ? String(countryCode) : undefined,
      });
      if (banCheck.banned) {
        return res.status(403).json({
          success: false,
          error: `Account permanently banned 🚫 forever (no second chance): ${banCheck.reason || 'Policy violation.'}`,
        });
      }
      return res.status(401).json({
        success: false,
        error: 'Invalid mobile number/email or password/PIN.',
      });
    }

    if (record.banned) {
      return res.status(403).json({
        success: false,
        error: `Account permanently banned 🚫 forever (no second chance): ${record.bannedReason || 'Policy violation.'}`,
      });
    }

    if (record.deactivated) {
      return res.status(403).json({
        success: false,
        error: `Account deactivated by Platform Owner: ${record.deactivatedReason || 'Contact Support (+254712727558 / WhatsApp 0785909543) to restore access.'}`,
      });
    }

    if (record.twoFactorEnabled && record.twoFactorMethod !== 'none') {
      const challengeToken = signCustomerToken(record, '2fa-challenge', 60 * 10);
      if (record.twoFactorMethod === 'sms') {
        const smsResult = await sendSmsOtp(record.phone, 'login-2fa');
        return res.json({
          success: true,
          requires2FA: true,
          twoFactorMethod: 'sms',
          challengeToken,
          maskedPhone: smsResult.maskedPhone,
          carrierDelivered: smsResult.carrierDelivered,
          smsDeliveryMode: smsResult.deliveryMode,
          providerLabel: smsResult.providerLabel,
          ...(smsResult.fallbackReason ? { fallbackReason: smsResult.fallbackReason } : {}),
          ...(smsResult.previewCode ? { previewCode: smsResult.previewCode } : {}),
        });
      }

      return res.json({
        success: true,
        requires2FA: true,
        twoFactorMethod: 'totp',
        challengeToken,
        maskedPhone: maskPhone(record.phone),
      });
    }

    recordCustomerLoginSuccess(record);
    const token = signCustomerToken(record, 'session');
    return res.json({
      success: true,
      requires2FA: false,
      token,
      customer: toPublicCustomerProfile(record),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Sign in failed',
    });
  }
});

// 3. Complete 2FA Challenge during Login (SMS OTP or Authenticator App TOTP)
app.post('/api/customer/verify-2fa-login', async (req, res) => {
  try {
    const { challengeToken, code } = req.body || {};
    const challenge = verifyCustomerToken(String(challengeToken || ''), '2fa-challenge');
    if (!challenge) {
      return res.status(401).json({
        success: false,
        error: '2FA session expired. Please sign in again.',
      });
    }

    const record = getCustomerByUid(challenge.sub);
    if (!record || !record.twoFactorEnabled) {
      return res.status(400).json({ success: false, error: 'Account 2FA configuration not found.' });
    }

    let valid = false;
    if (record.twoFactorMethod === 'totp' && record.totpSecret) {
      valid = verifyTotpCode(record.totpSecret, String(code || ''));
    } else if (record.twoFactorMethod === 'sms') {
      valid = verifySmsOtp(record.phone, 'login-2fa', String(code || ''));
    }

    if (!valid) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired 6-digit verification code.',
      });
    }

    recordCustomerLoginSuccess(record);
    const token = signCustomerToken(record, 'session');
    return res.json({
      success: true,
      token,
      customer: toPublicCustomerProfile(record),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || '2FA verification failed',
    });
  }
});

// 4. Get Current Customer Profile & 2FA Status
app.get('/api/customer/me', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const existing = getCustomerByUid(uid);
  const record =
    existing ||
    ensureShadowCustomerForGoogleUid({
      uid,
      email: req.user?.email,
      displayName: req.user?.name,
      phone: req.user?.phone_number,
    });

  if (!existing && record.email?.toLowerCase() !== OWNER_EMAIL) {
    void notifyAdminPlatformEvent({
      eventType: 'new_registration',
      title: `New Google Sign-In Member: ${record.displayName}`,
      summary: `${record.displayName} signed in with Google for the first time and joined the East Africa contributor portal.`,
      actorName: record.displayName,
      actorPhone: record.phone || undefined,
      actorEmail: record.email,
      countryCode: record.countryCode,
      details: {
        UID: record.uid,
        AuthMethod: 'Google Sign-In',
      },
    });
  }

  return res.json({
    customer: toPublicCustomerProfile(record),
  });
});

// 4b. Customer Profile Update (Editable fields allowed; registered phone & withdrawal details strictly locked for customers; Platform Owner may update freely)
app.patch('/api/customer/profile', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const existingRec = getCustomerByUid(uid);
    if (existingRec?.banned) {
      return res.status(403).json({
        success: false,
        error: `Account permanently banned 🚫 forever (no second chance): ${existingRec.bannedReason || 'Policy violation.'}`,
      });
    }
    if (existingRec?.deactivated) {
      return res.status(403).json({
        success: false,
        error: `Account deactivated: ${existingRec.deactivatedReason || 'Contact Support (+254712727558).'}`,
      });
    }

    if (!existingRec) {
      ensureShadowCustomerForGoogleUid({
        uid,
        email: req.user?.email,
        displayName: req.user?.name,
        phone: req.user?.phone_number,
      });
    }

    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);

    const {
      displayName,
      email,
      city,
      bio,
      socialHandles,
      phone,
      withdrawalMethod,
      withdrawalAccount,
      withdrawalAccountHolder,
    } = req.body || {};

    const updated = updateCustomerProfileDetails(uid, {
      displayName,
      email,
      city,
      bio,
      socialHandles,
      phone,
      withdrawalMethod,
      withdrawalAccount,
      withdrawalAccountHolder,
      bypassLock: isOwner,
    });

    return res.json({
      success: true,
      message: isOwner
        ? 'Admin account, withdrawal & verification details updated and saved.'
        : 'My Account details saved and permanently locked. Contact Support (+254712727558) if verified recovery is ever required.',
      customer: toPublicCustomerProfile(updated),
    });
  } catch (error: any) {
    const status = error instanceof ImmutableFieldError ? 403 : 400;
    return res.status(status).json({
      success: false,
      error: error?.message || 'Could not update profile.',
    });
  }
});

// 4c. Hydrate & Merge Client Firestore Backup into Server Customer Store (prevents resets on restart)
app.post('/api/customer/hydrate-sync', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const existedBefore = Boolean(getCustomerByUid(uid));
    const hydrated = hydrateCustomerFromClientFirestore({
      uid,
      email: req.user?.email,
      displayName: req.user?.name,
      incoming: req.body || {},
    });

    if (!existedBefore && hydrated.email?.toLowerCase() !== OWNER_EMAIL) {
      void notifyAdminPlatformEvent({
        eventType: 'new_registration',
        title: `New Customer Synced: ${hydrated.displayName}`,
        summary: `${hydrated.displayName} (${hydrated.countryCode}) initialized their portal account.`,
        actorName: hydrated.displayName,
        actorPhone: hydrated.phone || undefined,
        actorEmail: hydrated.email,
        countryCode: hydrated.countryCode,
        details: { UID: hydrated.uid },
      });
    }

    return res.json({
      success: true,
      customer: toPublicCustomerProfile(hydrated),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Failed to hydrate customer profile.',
    });
  }
});

// 5. Begin 2FA Setup (Authenticator App QR/Secret OR SMS OTP)
app.post('/api/customer/2fa/setup', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { method, phone, countryCode } = req.body || {};
    if (method !== 'totp' && method !== 'sms') {
      return res.status(400).json({ error: '2FA method must be "sms" or "totp".' });
    }

    const record =
      getCustomerByUid(uid) ||
      ensureShadowCustomerForGoogleUid({
        uid,
        email: req.user?.email,
        displayName: req.user?.name,
        phone: phone ? String(phone) : undefined,
        countryCode: countryCode ? String(countryCode) : undefined,
      });

    if (method === 'totp') {
      const secret = generateBase32Secret(20);
      record.pendingTotpSecret = secret;
      saveCustomerRecord(record);

      const label = record.phone || record.email || record.displayName;
      const otpauthUrl = buildOtpAuthUri(label, secret);
      const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, {
        width: 220,
        margin: 1,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });

      return res.json({
        success: true,
        method: 'totp',
        secret,
        otpauthUrl,
        qrCodeDataUrl,
      });
    }

    // SMS 2FA setup
    const candidatePhone = phone
      ? normalizeEastAfricaPhone(String(phone), countryCode ? String(countryCode) : record.countryCode)
      : record.phone;

    if (!candidatePhone || !isEastAfricaPhone(candidatePhone)) {
      return res.status(400).json({
        error: 'Enter a valid East Africa mobile number (+254, +256, +255, +250, +257, +211, +251, or +252) to enable SMS 2FA.',
      });
    }

    if (isPhoneOwnedByDifferentCustomer(candidatePhone, uid, record.countryCode)) {
      return res.status(409).json({
        error: 'This mobile number is already registered to another portal account. Duplicate accounts are not permitted.',
      });
    }

    record.phone = candidatePhone;
    saveCustomerRecord(record);

    const smsResult = await sendSmsOtp(candidatePhone, 'enable-sms-2fa');
    return res.json({
      success: true,
      method: 'sms',
      maskedPhone: smsResult.maskedPhone,
      carrierDelivered: smsResult.carrierDelivered,
      smsDeliveryMode: smsResult.deliveryMode,
      providerLabel: smsResult.providerLabel,
      ...(smsResult.fallbackReason ? { fallbackReason: smsResult.fallbackReason } : {}),
      ...(smsResult.previewCode ? { previewCode: smsResult.previewCode } : {}),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to initiate 2FA setup' });
  }
});

// Owner SMS Gateway Config & Live Test Routes
app.get('/api/owner/sms-config', requireOwner, (_req: AuthRequest, res) => {
  res.json({ success: true, ...getPublicSmsGatewayStatus() });
});

app.post('/api/owner/sms-config', requireOwner, (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const validProviders: SmsProviderType[] = ['none', 'africastalking', 'textsms', 'twilio'];
    const provider = validProviders.includes(body.provider) ? (body.provider as SmsProviderType) : 'none';
    saveSmsGatewayConfig({
      provider,
      atUsername: body.atUsername,
      atApiKey: body.atApiKey,
      atSenderId: body.atSenderId,
      textsmsPartnerId: body.textsmsPartnerId,
      textsmsApiKey: body.textsmsApiKey,
      textsmsShortcode: body.textsmsShortcode,
      textsmsEndpoint: body.textsmsEndpoint,
      twilioAccountSid: body.twilioAccountSid,
      twilioAuthToken: body.twilioAuthToken,
      twilioFromNumber: body.twilioFromNumber,
    });
    return res.json({ success: true, ...getPublicSmsGatewayStatus() });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not save SMS config' });
  }
});

app.post('/api/owner/sms-test', requireOwner, async (req: AuthRequest, res) => {
  try {
    const rawPhone = String(req.body?.phone || '+254712727558');
    const normalized = normalizeEastAfricaPhone(rawPhone, req.body?.countryCode || 'KE');
    if (!isEastAfricaPhone(normalized)) {
      return res.status(400).json({ success: false, error: 'Enter a valid East Africa test phone number.' });
    }
    const testCode = '482910';
    const result = await dispatchSmsViaGateway(
      normalized,
      `Gideon Global Tasks LIVE SMS Test OTP: ${testCode}. Carrier routing verified.`,
      maskPhone(normalized),
      'owner-test'
    );
    return res.json({
      success: result.carrierDelivered,
      phone: maskPhone(normalized),
      ...result,
      status: getPublicSmsGatewayStatus(),
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'SMS test failed' });
  }
});

// Owner ONLY: View saved customer directory (non-secret profile metadata + locked payout/registration details)
app.get('/api/owner/customers', requireOwner, (_req: AuthRequest, res) => {
  const customers = listAllCustomerProfiles();
  const stateSummaryByUid = listAllCustomerStatesSummary();
  res.json({
    success: true,
    customers,
    stateSummaryByUid,
    stats: {
      totalCustomers: customers.length,
      phoneVerifiedCount: customers.filter((c) => c.phoneVerified).length,
      twoFactorCount: customers.filter((c) => c.twoFactorEnabled).length,
      uniqueEmailsCount: customers.filter((c) => Boolean(c.email)).length,
      lockedPayoutCount: customers.filter((c) => Boolean(c.withdrawalDetails?.locked)).length,
      bannedCount: customers.filter((c) => Boolean(c.banned)).length,
      deactivatedCount: customers.filter((c) => Boolean(c.deactivated)).length,
    },
  });
});

// Owner ONLY: Edit ANY customer profile field, phone, PayPal payout details, locks, or 2FA
app.patch('/api/owner/customers/:uid', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const updated = ownerUpdateCustomerRecord(uid, req.body || {});
    return res.json({
      success: true,
      customer: toPublicCustomerProfile(updated),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not update customer record.',
    });
  }
});

// Owner ONLY: Support adjustment of persisted customer wallet balance or VIP referral count
app.post('/api/owner/customers/:uid/state', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const updatedState = ownerUpdateCustomerStateSupport({
      uid,
      balanceDeltaUsd: typeof req.body?.balanceDeltaUsd === 'number' ? req.body.balanceDeltaUsd : undefined,
      setBalanceUsd: typeof req.body?.setBalanceUsd === 'number' ? req.body.setBalanceUsd : undefined,
      setVipReferralCount: typeof req.body?.setVipReferralCount === 'number' ? req.body.setVipReferralCount : undefined,
    });
    return res.json({ success: true, state: updatedState });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not update customer state.',
    });
  }
});

// Owner ONLY: Deactivate a customer account temporarily (blocks login, tasks, withdrawals, deposits)
app.post('/api/owner/customers/:uid/deactivate', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const updated = deactivateCustomerAccount({
      uid,
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      reason: req.body?.reason ? String(req.body.reason) : undefined,
    });
    return res.json({
      success: true,
      customer: toPublicCustomerProfile(updated),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not deactivate customer account.',
    });
  }
});

// Owner ONLY: Reactivate a deactivated customer account
app.post('/api/owner/customers/:uid/reactivate', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const updated = reactivateCustomerAccount({
      uid,
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
    });
    return res.json({
      success: true,
      customer: toPublicCustomerProfile(updated),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not reactivate customer account.',
    });
  }
});

// Owner ONLY: Permanently delete a customer account from portal storage & Firestore
app.delete('/api/owner/customers/:uid', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const result = deleteCustomerAccountPermanently({ uid });
    return res.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not delete customer account.',
    });
  }
});

// Owner ONLY: Unlock a verified customer's withdrawal details if support recovery is needed
app.post('/api/owner/customers/:uid/unlock-payout', requireOwner, (req: AuthRequest, res) => {
  try {
    const updated = ownerResetCustomerWithdrawalLock(String(req.params.uid || ''));
    return res.json({
      success: true,
      customer: toPublicCustomerProfile(updated),
    });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: error?.message || 'Customer account not found.',
    });
  }
});

// Owner ONLY: Permanently ban a customer account forever (no second chance)
app.post('/api/owner/customers/:uid/ban', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const reason = String(req.body?.reason || '').trim();
    const target = getCustomerByUid(uid);
    if (!target) {
      return res.status(404).json({ success: false, error: 'Customer account not found.' });
    }
    const banned = banCustomerPermanently({
      uid: target.uid,
      phone: target.phone,
      email: target.email,
      countryCode: target.countryCode,
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      reason:
        reason ||
        'Account permanently banned by Platform Owner for verification or integrity violation.',
    });
    return res.json({
      success: true,
      customer: banned ? toPublicCustomerProfile(banned) : undefined,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Cannot ban protected Platform Owner / Admin account.',
    });
  }
});

// Owner ONLY: Unban / recover an accidentally banned customer account by UID
app.post('/api/owner/customers/:uid/unban', requireOwner, (req: AuthRequest, res) => {
  const uid = String(req.params.uid || '').trim();
  const target = getCustomerByUid(uid);
  const ownerEmail = req.user?.email || 'nigideon36@gmail.com';
  const result = unbanCustomerByOwner({
    uid,
    phone: target?.phone,
    email: target?.email,
    countryCode: target?.countryCode || 'KE',
    ownerEmail,
  });

  if (!target && result.clearedKeys.length === 0) {
    return res.status(404).json({ success: false, error: 'No matching banned customer record found.' });
  }

  return res.json({
    success: true,
    customer: result.unbannedCustomer ? toPublicCustomerProfile(result.unbannedCustomer) : undefined,
    clearedKeys: result.clearedKeys,
  });
});

// Owner ONLY: Unban / recover any phone number (e.g. 0712727558) or email directly
app.post('/api/owner/unban-phone', requireOwner, (req: AuthRequest, res) => {
  const { phone, email, countryCode } = req.body || {};
  const cleanPhone = String(phone || '').trim();
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanPhone && !cleanEmail) {
    return res.status(400).json({ success: false, error: 'Enter a phone number or email to unban.' });
  }

  const ownerEmail = req.user?.email || 'nigideon36@gmail.com';
  const result = unbanCustomerByOwner({
    phone: cleanPhone || undefined,
    email: cleanEmail || undefined,
    countryCode: countryCode ? String(countryCode) : 'KE',
    ownerEmail,
  });

  return res.json({
    success: true,
    normalizedPhone: result.normalizedPhone || cleanPhone || undefined,
    customer: result.unbannedCustomer ? toPublicCustomerProfile(result.unbannedCustomer) : undefined,
    clearedKeys: result.clearedKeys,
  });
});

// --- Mandatory Identity KYC Verification (Front & Back of National ID per Country) ---

app.get('/api/kyc/status', optionalAuth, async (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  const customerRec = uid ? getCustomerByUid(uid) : null;
  const requestedCountry = String(
    req.query?.countryCode || customerRec?.countryCode || 'KE'
  ).toUpperCase();
  const country = getCountryByCode(requestedCountry);
  const submission = uid ? await getOrHydrateKycByUid(uid) : null;
  const kycStatus = submission ? submission.status : 'Not Submitted';

  return res.json({
    success: true,
    kycStatus,
    kycApproved: Boolean(uid && isCustomerKycApproved(uid)),
    countryCode: country.code,
    idDocumentName: submission?.idDocumentName || country.idDocumentName,
    idNumberHint: country.idNumberHint,
    submission,
  });
});

app.post('/api/kyc/hydrate', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Sign in required.' });
    }
    const customerRec = getCustomerByUid(uid);
    const {
      countryCode,
      fullNameOnId,
      idNumber,
      frontImageDataUrl,
      backImageDataUrl,
      submittedAt,
    } = req.body || {};

    const resolvedCountryCode = String(countryCode || customerRec?.countryCode || 'KE').toUpperCase();
    const record = hydrateKycFromClientBackup({
      uid,
      customerName: customerRec?.displayName || req.user?.name || String(fullNameOnId || ''),
      customerPhone: customerRec?.phone || req.user?.phone_number,
      customerEmail: customerRec?.email || req.user?.email,
      countryCode: resolvedCountryCode,
      fullNameOnId: String(fullNameOnId || ''),
      idNumber: String(idNumber || ''),
      frontImageDataUrl: String(frontImageDataUrl || ''),
      backImageDataUrl: String(backImageDataUrl || ''),
      submittedAt: submittedAt ? String(submittedAt) : undefined,
    });

    return res.json({
      success: true,
      kycStatus: record.status,
      submission: record,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not restore KYC record.',
    });
  }
});

app.post('/api/kyc/submit', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Sign in required to submit KYC.' });
    }
    const customerRec = getCustomerByUid(uid);
    if (customerRec?.banned || customerRec?.deactivated) {
      return res.status(403).json({
        success: false,
        error: customerRec.banned
          ? `Account permanently banned: ${customerRec.bannedReason || 'Policy violation.'}`
          : `Account deactivated: ${customerRec.deactivatedReason || 'Contact Support.'}`,
      });
    }

    const {
      countryCode,
      fullNameOnId,
      idNumber,
      frontImageDataUrl,
      backImageDataUrl,
    } = req.body || {};

    const resolvedCountryCode = String(countryCode || customerRec?.countryCode || 'KE').toUpperCase();
    const record = submitKycSubmission({
      uid,
      customerName: customerRec?.displayName || req.user?.name || String(fullNameOnId || ''),
      customerPhone: customerRec?.phone || req.user?.phone_number,
      customerEmail: customerRec?.email || req.user?.email,
      countryCode: resolvedCountryCode,
      fullNameOnId: String(fullNameOnId || ''),
      idNumber: String(idNumber || ''),
      frontImageDataUrl: String(frontImageDataUrl || ''),
      backImageDataUrl: String(backImageDataUrl || ''),
    });

    void notifyAdminPlatformEvent({
      eventType: 'kyc_submitted',
      title: `KYC ID Submitted: ${record.fullNameOnId} (${record.idDocumentName})`,
      summary: `${record.fullNameOnId} uploaded BOTH Front & Back of ${record.idDocumentName} (ID: ${record.idNumber}). Review and approve in Owner Console to unlock their withdrawals.`,
      actorName: record.fullNameOnId,
      actorPhone: record.customerPhone,
      actorEmail: record.customerEmail,
      countryCode: record.countryCode,
      details: {
        DocumentType: record.idDocumentName,
        IdNumber: record.idNumber,
        UID: record.uid,
      },
    });

    return res.status(201).json({
      success: true,
      message: `${record.idDocumentName} (Front & Back) submitted for KYC review. Withdrawals unlock immediately upon Owner approval.`,
      kycStatus: record.status,
      submission: record,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not submit KYC documents.',
    });
  }
});

app.get('/api/owner/kyc', requireOwner, (_req: AuthRequest, res) => {
  const submissions = listAllKycSubmissions();
  return res.json({
    success: true,
    submissions,
    stats: {
      totalCount: submissions.length,
      pendingCount: submissions.filter((s) => s.status === 'Pending').length,
      approvedCount: submissions.filter((s) => s.status === 'Approved').length,
      rejectedCount: submissions.filter((s) => s.status === 'Rejected').length,
    },
  });
});

app.post('/api/owner/kyc/:uid/approve', requireOwner, (req: AuthRequest, res) => {
  try {
    const submission = approveKycSubmission({
      uid: String(req.params.uid || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
    });
    return res.json({ success: true, submission });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not approve KYC verification.',
    });
  }
});

app.post('/api/owner/kyc/:uid/reject', requireOwner, (req: AuthRequest, res) => {
  try {
    const submission = rejectKycSubmission({
      uid: String(req.params.uid || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      reason: req.body?.reason ? String(req.body.reason) : undefined,
    });
    return res.json({ success: true, submission });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not reject KYC verification.',
    });
  }
});

// 6. Confirm & Activate 2FA (Verify 6-digit code from Authenticator App or SMS)
app.post('/api/customer/2fa/confirm', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const { method, code } = req.body || {};
    const record = getCustomerByUid(uid);
    if (!record) return res.status(404).json({ error: 'Customer account not found.' });

    if (method === 'totp') {
      if (!record.pendingTotpSecret || !verifyTotpCode(record.pendingTotpSecret, String(code || ''))) {
        return res.status(400).json({ error: 'Invalid 6-digit Authenticator code. Ensure device time is synced and try again.' });
      }
      const activatedSecret = record.pendingTotpSecret;
      record.totpSecret = activatedSecret;
      record.pendingTotpSecret = undefined;
      record.twoFactorEnabled = true;
      record.twoFactorMethod = 'totp';
      saveCustomerRecord(record);
      return res.json({
        success: true,
        customer: toPublicCustomerProfile(record),
        totpSecretBackup: activatedSecret,
      });
    }

    if (method === 'sms') {
      if (!record.phone || !verifySmsOtp(record.phone, 'enable-sms-2fa', String(code || ''))) {
        return res.status(400).json({ error: 'Invalid or expired 6-digit SMS code.' });
      }
      record.phoneVerified = true;
      record.phoneLocked = true;
      record.twoFactorEnabled = true;
      record.twoFactorMethod = 'sms';
      saveCustomerRecord(record);
      return res.json({ success: true, customer: toPublicCustomerProfile(record) });
    }

    return res.status(400).json({ error: 'Invalid 2FA method.' });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to confirm 2FA' });
  }
});

// 7. Disable 2FA
app.post('/api/customer/2fa/disable', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  const record = getCustomerByUid(uid);
  if (!record) return res.status(404).json({ error: 'Customer account not found.' });

  record.twoFactorEnabled = false;
  record.twoFactorMethod = 'none';
  record.totpSecret = undefined;
  record.pendingTotpSecret = undefined;
  saveCustomerRecord(record);

  return res.json({ success: true, customer: toPublicCustomerProfile(record) });
});

// --- Customer Withdrawal Queue & Owner-Only Approval (Strictly nigideon36@gmail.com) ---

// Customer initiates a withdrawal request (always enters as Processing; enforces locked registration withdrawal details)
app.post('/api/withdrawals/request', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const { id, amountUsd, method, accountDetails, countryCode, mpesaReceipt } = req.body || {};
    const uid = req.user?.uid || `guest_${crypto.randomBytes(6).toString('hex')}`;
    const customerRec = req.user?.uid ? getCustomerByUid(req.user.uid) : null;
    const banCheck = isIdentifierOrAccountBanned({
      uid: req.user?.uid,
      phone: customerRec?.phone || req.user?.phone_number,
      email: customerRec?.email || req.user?.email,
      countryCode: customerRec?.countryCode,
    });
    if (banCheck.banned) {
      return res.status(403).json({
        success: false,
        error: `Account permanently banned 🚫 forever (no second chance): ${banCheck.reason || 'Policy violation.'}`,
      });
    }
    if (customerRec?.deactivated) {
      return res.status(403).json({
        success: false,
        error: `Account deactivated: ${customerRec.deactivatedReason || 'Contact Support (+254712727558) to reactivate.'}`,
      });
    }

    let finalMethod = 'PayPal';
    if (method && String(method).trim() !== 'PayPal') {
      return res.status(400).json({
        success: false,
        error: 'Only PayPal is supported for withdrawals on Gideon Global Tasks.',
      });
    }
    let finalAccount = String(accountDetails || '').trim().toLowerCase();

    if (customerRec?.withdrawalDetails?.locked) {
      const locked = customerRec.withdrawalDetails;
      if (finalAccount !== locked.accountDetails.trim().toLowerCase()) {
        return res.status(403).json({
          success: false,
          error: `Withdrawals must match your locked PayPal payout email (${locked.accountDetails}). Customers cannot change withdrawal details.`,
        });
      }
      finalMethod = 'PayPal';
      finalAccount = locked.accountDetails;
    }

    const resolvedCountry = getCountryByCode(countryCode ? String(countryCode) : customerRec?.countryCode || 'KE');
    const numericAmount = Number(amountUsd);
    if (!Number.isFinite(numericAmount) || !meetsWithdrawalThreshold(numericAmount)) {
      return res.status(400).json({
        success: false,
        error: `Minimum withdrawal threshold is ${formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, resolvedCountry)} (${WITHDRAWAL_THRESHOLD_KES} shillings equivalent).`,
      });
    }

    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);

    if (!isOwner) {
      if (!req.user?.uid) {
        return res.status(401).json({
          success: false,
          error: 'Sign in and complete National ID KYC verification before requesting a PayPal withdrawal.',
        });
      }
      if (!isCustomerKycApproved(req.user.uid)) {
        const currentStatus = getKycStatusForUid(req.user.uid);
        return res.status(403).json({
          success: false,
          error:
            currentStatus === 'Pending'
              ? `Your ${resolvedCountry.idDocumentName} KYC verification is currently Pending Owner Approval. Withdrawals unlock once your Front & Back ID photos are approved.`
              : `Strict KYC Required: Upload BOTH Front & Back photos of your ${resolvedCountry.idDocumentName} in My Account / Wallet and wait for Owner approval before withdrawing via PayPal.`,
        });
      }
    }

    const record = createWithdrawalRequest({
      id: id ? String(id) : undefined,
      userUid: uid,
      customerPhone: customerRec?.phone || req.user?.phone_number,
      customerEmail: customerRec?.email || req.user?.email,
      customerName: customerRec?.displayName || req.user?.name,
      countryCode: resolvedCountry.code,
      amountUsd: numericAmount,
      method: finalMethod,
      accountDetails: finalAccount,
      mpesaReceipt: mpesaReceipt ? String(mpesaReceipt) : undefined,
    });

    if (req.user?.uid) {
      recordServerWithdrawalDebit(req.user.uid, {
        id: record.id,
        amount: record.amountUsd,
        method: record.method,
        accountDetails: record.accountDetails,
        status: 'Processing',
        timestamp: new Date(record.createdAt).toLocaleString(),
        mpesaReceipt: record.mpesaReceipt,
      });
    }

    void notifyAdminPlatformEvent({
      eventType: 'withdrawal_requested',
      title: `New Withdrawal Request: $${record.amountUsd.toFixed(2)} (${record.method})`,
      summary: `${record.customerName || 'Contributor'} requested a withdrawal via ${record.method} to ${record.accountDetails}.`,
      actorName: record.customerName,
      actorPhone: record.customerPhone,
      actorEmail: record.customerEmail,
      countryCode: record.countryCode,
      amountLabel: `$${record.amountUsd.toFixed(2)} USD (~KES ${Math.round(record.amountUsd * 130)})`,
      details: {
        WithdrawalId: record.id,
        Method: record.method,
        Account: record.accountDetails,
      },
    });

    upsertPlatformTransaction({
      id: record.id,
      kind: 'withdrawal',
      title: `Customer Withdrawal Request (${record.method})`,
      customerLabel: record.customerName || record.customerPhone || record.customerEmail || record.accountDetails,
      gatewayOrMethod: record.method,
      currency: resolvedCountry.currency,
      amountLocal: Math.round(record.amountUsd * resolvedCountry.approxRatePerUsd),
      amountUsd: record.amountUsd,
      status: 'Processing',
      reference: record.mpesaReceipt || record.id,
      countryCode: record.countryCode,
      metadata: {
        accountDetails: record.accountDetails,
        registeredPhone: customerRec?.phone || undefined,
      },
    });
    return res.status(201).json({ success: true, withdrawal: record });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not queue withdrawal request.',
    });
  }
});

// Customer fetches their own withdrawal requests & approval status
app.get('/api/withdrawals/my', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });
  return res.json({
    withdrawals: listCustomerWithdrawals(uid),
  });
});

// Owner ONLY: View configured live/test outbound PayPal payout gateway readiness
app.get('/api/owner/payout-gateways/status', requireOwner, (_req: AuthRequest, res) => {
  return res.json(getGatewayReadiness());
});

// Owner ONLY: View all customer withdrawal requests
app.get('/api/owner/withdrawals', requireOwner, (_req: AuthRequest, res) => {
  return res.json({
    withdrawals: listAllWithdrawals(),
  });
});

// Owner ONLY: Approve & execute real outbound PayPal transfer (or settle with verified manual PayPal TXN receipt)
app.post('/api/owner/withdrawals/:id/approve', requireOwner, async (req: AuthRequest, res) => {
  try {
    const { receiptCode, gatewayMode } = req.body || {};
    const ownerEmail = req.user?.email || 'nigideon36@gmail.com';
    const id = String(req.params.id);

    const existing = getWithdrawalById(id);
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Withdrawal request not found.' });
    }
    if (existing.status === 'Completed') {
      return res.json({ success: true, withdrawal: existing });
    }
    if (existing.status === 'Rejected') {
      return res.status(400).json({ success: false, error: 'Rejected withdrawals cannot be approved.' });
    }

    const transfer = await executeLiveOutboundTransfer({
      withdrawal: existing,
      gatewayMode: (gatewayMode as PayoutGatewayMode) || 'auto',
      manualReceiptCode: receiptCode ? String(receiptCode) : undefined,
    });

    const updated = approveWithdrawalRequest({
      id,
      ownerEmail,
      receiptCode: transfer.receiptCode,
      disbursementChannel: transfer.disbursementChannel,
    });

    if (updated.userUid && !updated.userUid.startsWith('guest_')) {
      syncServerWithdrawalDecision(updated.userUid, updated.id, 'Completed', updated.amountUsd, transfer.receiptCode);
    }

    upsertPlatformTransaction({
      id: updated.id,
      kind: 'withdrawal',
      title: `Customer Withdrawal Disbursed (${transfer.disbursementChannel})`,
      customerLabel: updated.customerName || updated.customerPhone || updated.customerEmail || updated.accountDetails,
      gatewayOrMethod: transfer.disbursementChannel,
      currency: transfer.currency,
      amountLocal: transfer.amountLocal,
      amountUsd: updated.amountUsd,
      status: 'Completed',
      reference: transfer.receiptCode,
      countryCode: updated.countryCode,
      metadata: {
        approvedBy: ownerEmail,
        accountDetails: updated.accountDetails,
        gateway: transfer.gateway,
        gatewayStatus: transfer.gatewayStatus,
        isSandboxOrTest: transfer.isSandboxOrTest,
      },
    });

    return res.json({ success: true, withdrawal: updated, transfer });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not execute withdrawal transfer.',
    });
  }
});

// Owner ONLY: Reject & flag withdrawal for customer wallet refund
app.post('/api/owner/withdrawals/:id/reject', requireOwner, (req: AuthRequest, res) => {
  try {
    const { reason } = req.body || {};
    const ownerEmail = req.user?.email || 'nigideon36@gmail.com';
    const updated = rejectWithdrawalRequest({
      id: String(req.params.id),
      ownerEmail,
      reason: reason ? String(reason) : undefined,
    });
    if (updated.userUid && !updated.userUid.startsWith('guest_')) {
      syncServerWithdrawalDecision(updated.userUid, updated.id, 'Rejected', updated.amountUsd);
    }
    const wCountry = getCountryByCode(updated.countryCode);
    upsertPlatformTransaction({
      id: updated.id,
      kind: 'withdrawal',
      title: `Customer Withdrawal Rejected (${updated.method})`,
      customerLabel: updated.customerName || updated.customerPhone || updated.customerEmail || updated.accountDetails,
      gatewayOrMethod: updated.method,
      currency: wCountry.currency,
      amountLocal: Math.round(updated.amountUsd * wCountry.approxRatePerUsd),
      amountUsd: updated.amountUsd,
      status: 'Rejected',
      reference: updated.id,
      countryCode: updated.countryCode,
      metadata: { rejectedBy: ownerEmail, reason: updated.rejectionReason },
    });
    return res.json({ success: true, withdrawal: updated });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not reject withdrawal.',
    });
  }
});

// Record completed tasks, pass purchases, investments, and referral commissions into the unified Owner transaction ledger
app.post('/api/transactions/record', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const { id, kind, title, customerLabel, gatewayOrMethod, currency, amountLocal, amountUsd, status, reference, countryCode, metadata } = req.body || {};
    if (!kind || !['withdrawal', 'task_reward', 'referral_commission', 'investment_deposit'].includes(String(kind))) {
      return res.status(400).json({ error: 'Invalid transaction kind' });
    }
    if (String(kind) === 'investment_deposit' && String(gatewayOrMethod || '').toLowerCase().includes('wallet')) {
      return res.status(400).json({ error: 'Investments must be funded strictly by external PayPal deposit, not Wallet balance.' });
    }
    const label =
      String(customerLabel || '').trim() ||
      req.user?.name ||
      req.user?.phone_number ||
      req.user?.email ||
      'East Africa Contributor';
    const record = upsertPlatformTransaction({
      id: id ? String(id) : undefined,
      kind,
      title: String(title || 'Platform Activity'),
      customerLabel: label,
      gatewayOrMethod: String(gatewayOrMethod || 'Platform'),
      currency: currency ? String(currency) : 'USD',
      amountLocal: typeof amountLocal === 'number' ? amountLocal : undefined,
      amountUsd: Number(amountUsd || 0),
      status: status || 'Completed',
      reference: reference ? String(reference) : undefined,
      countryCode: countryCode ? String(countryCode) : 'KE',
      metadata: metadata && typeof metadata === 'object' ? metadata : undefined,
    });
    return res.status(201).json({ success: true, transaction: record });
  } catch (error: any) {
    return res.status(400).json({ error: error?.message || 'Failed to record transaction' });
  }
});

// Creator Product Campaign Deliverable Submission (Facebook, Instagram, TikTok, WhatsApp only)
app.post('/api/creator-campaigns/submit', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const countryCode = String(body.countryCode || req.headers['x-ea-country'] || 'KE');
    const submission = createCreatorCampaignSubmission({
      taskId: String(body.taskId || ''),
      taskTitle: String(body.taskTitle || ''),
      productName: String(body.productName || ''),
      platform: String(body.platform || ''),
      format: String(body.format || ''),
      creatorHandle: String(body.creatorHandle || ''),
      postUrl: body.postUrl ? String(body.postUrl) : undefined,
      captionText: String(body.captionText || ''),
      whatsappProofAttached: Boolean(body.whatsappProofAttached),
      rewardUsd: Number(body.rewardUsd || 0),
      countryCode,
      submittedByUid: req.user?.uid,
    });
    return res.status(201).json({ success: true, submission });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not validate creator campaign submission.',
    });
  }
});

// Owner ONLY: Audit all Creator Product Campaign submissions (links, handles, platforms)
app.get('/api/owner/creator-submissions', requireOwner, (_req: AuthRequest, res) => {
  const submissions = listCreatorCampaignSubmissions();
  return res.json({ success: true, submissions });
});

// Owner ONLY: Track every transaction across withdrawals, passes, tasks, and referrals
app.get('/api/owner/transactions', requireOwner, (_req: AuthRequest, res) => {
  const transactions = listAllPlatformTransactions();
  const withdrawals = listAllWithdrawals();
  return res.json({
    transactions,
    summary: {
      totalTransactions: transactions.length,
      pendingWithdrawalsCount: withdrawals.filter((w) => w.status === 'Processing').length,
      pendingWithdrawalsUsd: +withdrawals
        .filter((w) => w.status === 'Processing')
        .reduce((sum, w) => sum + w.amountUsd, 0)
        .toFixed(2),
      approvedWithdrawalsUsd: +withdrawals
        .filter((w) => w.status === 'Completed')
        .reduce((sum, w) => sum + w.amountUsd, 0)
        .toFixed(2),
      paypalVolumeUsd: +transactions
        .filter((t) => (t.kind === 'paypal_checkout' || t.kind === 'investment_deposit') && t.status === 'Completed')
        .reduce((sum, t) => sum + t.amountUsd, 0)
        .toFixed(2),
      taskRewardsUsd: +transactions
        .filter((t) => t.kind === 'task_reward')
        .reduce((sum, t) => sum + t.amountUsd, 0)
        .toFixed(2),
      investmentDepositsUsd: +transactions
        .filter((t) => t.kind === 'investment_deposit' && t.status === 'Completed')
        .reduce((sum, t) => sum + t.amountUsd, 0)
        .toFixed(2),
    },
  });
});

// --- Cloud SQL PostgreSQL & Firebase Auth Endpoints ---

// 1. Synchronize User Profile to Cloud SQL
app.post('/api/auth/sync', requireAuth, requireEastAfrica, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || req.body?.email || '';
    const displayName = req.body?.displayName || req.user?.name || '';
    if (!uid) {
      return res.status(400).json({ error: 'Missing UID' });
    }
    if (!process.env.SQL_HOST) {
      return res.json({ uid, email, displayName, synced: 'local' });
    }
    const userRecord = await getOrCreateUser(uid, email, displayName);
    res.json(userRecord);
  } catch (error: any) {
    console.error('Error syncing user:', error);
    res.status(500).json({ error: 'Failed to sync user profile' });
  }
});

// 2. Fetch User Completed Tasks from Cloud SQL
app.get('/api/user/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    if (!process.env.SQL_HOST) {
      return res.json([]);
    }
    const records = await db
      .select()
      .from(completedTasks)
      .where(eq(completedTasks.userUid, uid))
      .orderBy(desc(completedTasks.completedAt));
    res.json(records);
  } catch (error: any) {
    console.error('Error fetching tasks from Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// 2b. Daily Single-Task Drop (8:00 AM EAT) & Open Free Access Status (No Worker Pass)
app.get('/api/user/quota', optionalAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid || 'guest';
  const now = new Date();
  const eatInfo = getEatNowInfo(now);
  const record = getUserDailyQuotaRecord(uid, eatInfo.dateKey);
  const remainingToday = Math.max(0, OPEN_ACCESS_DAILY_LIMIT - record.totalCount);
  const droppedTaskId = getDailyDroppedTaskId(DAILY_DROP_TASK_IDS, now);

  return res.json({
    success: true,
    rule: {
      tierId: 'open',
      name: 'Daily 8:00 AM EAT Task Drop (No Worker Pass)',
      priceKes: 0,
      dailyLimit: OPEN_ACCESS_DAILY_LIMIT,
      dailyUnitLabel: '1 task daily at 08:00 AM EAT',
      shortRuleLabel: 'Free access · 1 daily drop at 8:00 AM EAT · Merchant-set rewards',
    },
    eatDropInfo: {
      dateKey: eatInfo.dateKey,
      isDropWindowOpen: eatInfo.isDropWindowOpen,
      msUntilNextDrop: eatInfo.msUntilNextDrop,
      countdownLabel: formatCountdownHms(eatInfo.msUntilNextDrop),
      eatTimeLabel: eatInfo.eatTimeLabel,
      nextDropLabel: eatInfo.nextDropLabel,
      droppedTaskId,
    },
    usedToday: record.totalCount,
    surveysUsedToday: record.surveyCount,
    remainingToday,
    totalEarnedTodayUsd: record.totalEarnedTodayUsd,
    dateKey: record.dateKey,
  });
});

// 2c. Full Customer Persistent State Hydration & Monotonic Sync (Zero-Reset Guarantee)
app.get('/api/user/state', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ error: 'Unauthorized' });

  processMaturePpvStatuses();

  const state = getOrCreateCustomerState(uid);
  return res.json({
    success: true,
    state: {
      ...state,
      activePackageId: null,
    },
  });
});

app.put('/api/user/state', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });

    const body = req.body || {};
    const merged = saveMergedCustomerState(uid, {
      userStats: body.userStats,
      taskHistory: Array.isArray(body.taskHistory) ? body.taskHistory : undefined,
      referralHistory: Array.isArray(body.referralHistory) ? body.referralHistory : undefined,
      referralStats: body.referralStats,
      dailyUsage: body.dailyUsage,
      activePackageId: null,
      vipReferralCount: typeof body.vipReferralCount === 'number' ? body.vipReferralCount : undefined,
    });

    return res.json({
      success: true,
      state: {
        ...merged,
        activePackageId: null,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not persist customer state.',
    });
  }
});

// 3. Save Completed Task & Enforce Open Fair-Use Ceiling
app.post('/api/user/tasks', requireAuth, requireEastAfrica, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const cust = getCustomerByUid(uid);
    if (cust?.banned) {
      return res.status(403).json({
        success: false,
        error: `Account permanently banned 🚫 forever (no second chance): ${cust.bannedReason || 'Policy violation.'}`,
      });
    }
    if (cust?.deactivated) {
      return res.status(403).json({
        success: false,
        error: `Account deactivated: ${cust.deactivatedReason || 'Contact Support (+254712727558).'}`,
      });
    }
    const { taskId, taskTitle, category, reward, status, accuracyScore, transactionRef } = req.body;

    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);

    const normalizedCategory = typeof category === 'string' && category.trim() ? category.trim() : 'micro';
    const rawReward = typeof reward === 'number' ? reward : Number(reward) || 0.25;

    const quotaCheck = validateAndRecordDailyTaskUsage({
      userKey: uid,
      taskId: taskId || `task-${Date.now()}`,
      category: normalizedCategory,
      rewardUsd: rawReward,
      isOwner,
    });

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: quotaCheck.error || 'Daily fair-use task limit reached.',
        quota: quotaCheck.record,
      });
    }

    if (!process.env.SQL_HOST) {
      return res.json({
        userUid: uid,
        taskId: taskId || `task-${Date.now()}`,
        taskTitle: taskTitle || 'Completed Task',
        category: normalizedCategory,
        reward: quotaCheck.clampedRewardUsd,
        status: status || 'Approved',
        quota: quotaCheck.record,
      });
    }

    await getOrCreateUser(uid, req.user?.email || '', req.user?.name || '');

    const record = await db
      .insert(completedTasks)
      .values({
        userUid: uid,
        taskId: taskId || `task-${Date.now()}`,
        taskTitle: taskTitle || 'Completed Task',
        category: normalizedCategory,
        reward: quotaCheck.clampedRewardUsd,
        status: status || 'Approved',
        accuracyScore: typeof accuracyScore === 'number' ? accuracyScore : 100.0,
        transactionRef: transactionRef || `TXN-${Math.floor(100000 + Math.random() * 900000)}`
      })
      .returning();

    res.json({ ...record[0], quota: quotaCheck.record });
  } catch (error: any) {
    console.error('Error saving task to Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to save completed task' });
  }
});

// --- Customer Deposit-Only Investments (KES 50+ Minimum via PayPal Only, NO Wallet Balance) ---

app.get('/api/investments/plans', (_req, res) => {
  return res.json({
    success: true,
    minKes: MIN_INVESTMENT_KES,
    paymentGateway: 'PayPal',
    walletBalanceAllowed: false,
    plans: INVESTMENT_PLANS,
  });
});

app.get('/api/investments/my', optionalAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  const idsParam = String(req.query?.ids || '');
  const trackedIds = idsParam
    ? idsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : [];
  const list = listCustomerInvestments(uid, trackedIds).map((inv) => ({
    ...inv,
    screenshotDataUrl: inv.screenshotDataUrl ? '[UPLOADED]' : undefined,
  }));
  return res.json({ success: true, investments: list });
});

app.post('/api/investments/deposit', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || 'guest';
    const customerRec = req.user?.uid ? getCustomerByUid(req.user.uid) : null;
    const {
      planId,
      amountKes,
      depositMethod,
      useWalletBalance,
      senderPhone,
      paymentReference,
      screenshotDataUrl,
      screenshotFileName,
      countryCode,
      customerName,
    } = req.body || {};

    const record = createInvestmentDeposit({
      userUid: uid,
      customerName: customerName ? String(customerName) : customerRec?.displayName || req.user?.name,
      customerPhone: customerRec?.phone || req.user?.phone_number || String(senderPhone || ''),
      customerEmail: customerRec?.email || req.user?.email,
      countryCode: countryCode ? String(countryCode) : customerRec?.countryCode || 'KE',
      planId: String(planId || 'starter-7d'),
      amountKes: Number(amountKes),
      depositMethod: String(depositMethod || 'PayPal'),
      useWalletBalance: Boolean(useWalletBalance),
      senderPhone: senderPhone ? String(senderPhone) : undefined,
      paymentReference: String(paymentReference || ''),
      screenshotDataUrl: screenshotDataUrl ? String(screenshotDataUrl) : undefined,
      screenshotFileName: screenshotFileName ? String(screenshotFileName) : undefined,
    });

    void notifyAdminPlatformEvent({
      eventType: 'investment_deposit',
      title: `New PayPal Investment Deposit: KES ${record.amountKes.toLocaleString()} (${record.planName})`,
      summary: `${record.customerName} submitted a KES ${record.amountKes.toLocaleString()} deposit via ${record.depositMethod} (Ref: ${record.paymentReference}).`,
      actorName: record.customerName,
      actorPhone: record.senderPhone || record.customerPhone,
      actorEmail: record.customerEmail,
      countryCode: record.countryCode,
      amountLabel: `KES ${record.amountKes.toLocaleString()}`,
      details: {
        Plan: record.planName,
        Method: record.depositMethod,
        Reference: record.paymentReference,
        InvestmentId: record.id,
      },
    });

    return res.status(201).json({
      success: true,
      message: `PayPal investment deposit of KES ${record.amountKes.toLocaleString()} submitted! Pending Owner PayPal verification.`,
      investment: {
        ...record,
        screenshotDataUrl: record.screenshotDataUrl ? '[UPLOADED]' : undefined,
      },
    });
  } catch (error: any) {
    const status = error instanceof InvestmentValidationError ? error.statusCode : 400;
    return res.status(status).json({
      success: false,
      error: error?.message || 'Could not process PayPal investment deposit.',
    });
  }
});

// Owner Investment Controls
app.get('/api/owner/investments', requireOwner, (_req: AuthRequest, res) => {
  const investments = listAllInvestments();
  return res.json({
    success: true,
    investments,
    stats: {
      totalCount: investments.length,
      pendingCount: investments.filter((i) => i.status === 'Pending Owner Approval').length,
      activeCount: investments.filter((i) => i.status === 'Active').length,
      settledCount: investments.filter((i) => i.status === 'Matured & Paid').length,
      totalDepositedKes: investments
        .filter((i) => i.status !== 'Rejected')
        .reduce((sum, i) => sum + i.amountKes, 0),
    },
  });
});

app.post('/api/owner/investments/:id/approve', requireOwner, (req: AuthRequest, res) => {
  try {
    const investment = approveInvestment({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      ownerNotes: req.body?.ownerNotes ? String(req.body.ownerNotes) : undefined,
    });
    return res.json({ success: true, investment });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not approve investment.' });
  }
});

app.post('/api/owner/investments/:id/reject', requireOwner, (req: AuthRequest, res) => {
  try {
    const investment = rejectInvestment({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      reason: req.body?.reason ? String(req.body.reason) : undefined,
    });
    return res.json({ success: true, investment });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not reject investment.' });
  }
});

app.post('/api/owner/investments/:id/settle', requireOwner, (req: AuthRequest, res) => {
  try {
    const investment = settleInvestment({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      payoutReceipt: req.body?.payoutReceipt ? String(req.body.payoutReceipt) : undefined,
    });
    return res.json({ success: true, investment });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not settle investment.' });
  }
});

app.patch('/api/owner/investments/:id', requireOwner, (req: AuthRequest, res) => {
  try {
    const investment = ownerUpdateInvestment({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      ...(req.body || {}),
    });
    return res.json({ success: true, investment });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not update investment.' });
  }
});

app.delete('/api/owner/investments/:id', requireOwner, (req: AuthRequest, res) => {
  const deleted = deleteInvestment(String(req.params.id || ''));
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Investment not found.' });
  }
  return res.json({ success: true });
});

// --- Customer Testimonials & Owner Moderation ---

app.get('/api/testimonials', (_req, res) => {
  const testimonials = listPublicTestimonials();
  return res.json({
    success: true,
    testimonials,
    totalCount: testimonials.length,
  });
});

app.post('/api/testimonials', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || 'guest';
    const customerRec = req.user?.uid ? getCustomerByUid(req.user.uid) : null;
    const { authorName, city, countryCode, rating, headline, message, experienceCategory } = req.body || {};

    const testimonial = createTestimonial({
      userUid: uid,
      authorName: authorName ? String(authorName) : customerRec?.displayName || req.user?.name,
      city: city ? String(city) : customerRec?.city,
      countryCode: countryCode ? String(countryCode) : customerRec?.countryCode || 'KE',
      rating: Number(rating || 5),
      headline: String(headline || ''),
      message: String(message || ''),
      experienceCategory: experienceCategory ? String(experienceCategory) : undefined,
      customerPhone: customerRec?.phone || req.user?.phone_number,
      customerEmail: customerRec?.email || req.user?.email,
    });

    return res.status(201).json({ success: true, testimonial });
  } catch (error: any) {
    const status = error instanceof TestimonialError ? error.statusCode : 400;
    return res.status(status).json({
      success: false,
      error: error?.message || 'Could not publish testimonial.',
    });
  }
});

app.get('/api/owner/testimonials', requireOwner, (_req: AuthRequest, res) => {
  const testimonials = listAllTestimonialsForOwner();
  return res.json({ success: true, testimonials });
});

app.patch('/api/owner/testimonials/:id', requireOwner, (req: AuthRequest, res) => {
  try {
    const testimonial = ownerUpdateTestimonial({
      id: String(req.params.id || ''),
      ...(req.body || {}),
    });
    return res.json({ success: true, testimonial });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not update testimonial.' });
  }
});

app.delete('/api/owner/testimonials/:id', requireOwner, (req: AuthRequest, res) => {
  const deleted = deleteTestimonial(String(req.params.id || ''));
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Testimonial not found.' });
  }
  return res.json({ success: true });
});

// Support Tickets (AI Escalation & Contact Form when Owner is away)
app.post('/api/support/tickets', optionalAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const customerRec = uid ? getCustomerByUid(uid) : null;
    const body = req.body || {};

    const ticket = createSupportTicket({
      userUid: uid,
      customerName: String(body.customerName || customerRec?.displayName || req.user?.name || '').trim(),
      contactInfo: String(body.contactInfo || customerRec?.phone || customerRec?.email || req.user?.email || '').trim(),
      countryCode: String(body.countryCode || customerRec?.countryCode || 'KE'),
      category: String(body.category || 'General Support'),
      subject: String(body.subject || 'Customer Support Request'),
      message: String(body.message || ''),
      aiConversationSummary: body.aiConversationSummary ? String(body.aiConversationSummary) : undefined,
    });

    void notifyAdminPlatformEvent({
      eventType: 'support_ticket',
      title: `New Support Ticket: ${ticket.subject}`,
      summary: `${ticket.customerName} (${ticket.category}): ${ticket.message.slice(0, 180)}`,
      actorName: ticket.customerName,
      actorPhone: ticket.contactInfo,
      countryCode: ticket.countryCode,
      details: {
        TicketId: ticket.id,
        Category: ticket.category,
      },
    });

    return res.status(201).json({ success: true, ticket });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not submit support ticket.',
    });
  }
});

app.get('/api/owner/support-tickets', requireOwner, (_req: AuthRequest, res) => {
  const tickets = listAllSupportTickets();
  return res.json({ success: true, tickets });
});

app.patch('/api/owner/support-tickets/:id', requireOwner, (req: AuthRequest, res) => {
  try {
    const ticket = updateSupportTicket({
      id: String(req.params.id || ''),
      status: req.body?.status,
      ownerReply: req.body?.ownerReply,
    });
    return res.json({ success: true, ticket });
  } catch (error: any) {
    return res.status(404).json({
      success: false,
      error: error?.message || 'Support ticket not found.',
    });
  }
});

const GIDEON_SUPPORT_SYSTEM_INSTRUCTION = `You are the official Gideon Global Tasks 24/7 AI Customer Support & Helpdesk Assistant. You act on behalf of the platform owner Gideon N. whenever he is away so customers get fast, accurate, step-by-step troubleshooting and never feel stuck.

Follow these verified platform facts strictly (NEVER display the US dollar "$" sign; always use Kenya Shillings "KSh" or the customer's local East Africa currency symbol):
1. Platform & Region: Gideon Global Tasks is an East Africa micro-work, local auctions, and creator community platform serving Kenya (KE, KSh), Uganda (UG, USh), Tanzania (TZ, TSh), Rwanda (RW, FRw), Burundi (BI, FBu), South Sudan (SS, SSP), Ethiopia (ET, Br), and Somalia (SO, Sh.So.).
2. Registration, SMS OTP & Account Issues:
   - New customers register with a valid East Africa mobile phone number, country selection, display name, and password, and MUST enter the 6-digit SMS OTP code before activation (or sign in via Google Sign-In).
   - If SMS OTP does not arrive within 60 seconds: advise checking network bars, ensuring correct country code format (e.g. +254 / 07xx), clicking "Resend OTP", or leaving a Support Ticket right here in chat for Gideon to inspect. Optional 2FA (SMS or Authenticator App) can also be enabled after login.
3. 100% Free Task Access (No Worker Pass Required):
   - Every customer starts at KSh 0 and gets completely free access to vetted surveys, AI data annotation, data entry, copywriting, meme creation, creator campaigns, and micro-tasks without purchasing any Worker Pass or subscription.
   - Schedule & Rewards: Only 1 task drops daily at exactly 08:00 AM East Africa Time (08:00 AM EAT), so contributors must keep time. Task rewards depend on which task drops and the merchant reward set by the client/advertiser.
4. PayPal-Only Payment Gateway:
   - PayPal is the ONLY payment and payout gateway on Gideon Global Tasks (used both for Growth Investment Pool deposits and customer wallet withdrawals).
   - No M-PESA, Paystack, IntaSend, bank transfers, or crypto rails are active.
5. Free Pay-Per-View (PPV) Status Feed (100% Free Feature):
   - Uploading funny videos, funny photos, or personal photos & videos in the Pay-Per-View tab is 100% FREE.
   - Each unique registered member who views another member's status adds KSh 5 per view; the system automatically credits matured views after 24 hours.
6. Product Auctions, Investments, Streaks, Task Alerts & Referrals:
   - Product Auctions: Signed-in members list local items, place live bids, or use Buy Now.
   - Investment Pools: Separate deposit pools (Starter 7-day, Growth 14-day, VIP 30-day) funded strictly via PayPal deposit only.
   - Daily Streak & Referrals: 7-day login streak bonus + community referral tracking.
7. Withdrawals & Strict National ID KYC Verification (Minimum 150 Shillings):
   - Minimum withdrawal threshold is KSh 150 (or equivalent in the customer's East Africa currency), paid strictly via PayPal.
   - STRICT KYC REQUIREMENT: Before any customer can request a withdrawal, they MUST complete Identity KYC verification by uploading BOTH the Front AND Back photos of their valid government ID card matching their country (Kenya: Kenyan National ID Kitambulisho; Uganda: Uganda NIRA National ID Card; Tanzania: Tanzania NIDA Kitambulisho cha Taifa; Rwanda: Rwanda Indangamuntu NIDA ID; Burundi: Carte Nationale d'Identite CNI; South Sudan: South Sudan National ID Card; Ethiopia: Ethiopia Fayda / Kebele ID; Somalia: Somalia NIRA National ID Card) along with their legal name and ID number, and wait for Owner approval.
   - PayPal payout details are locked on first save for security; if a customer needs payout recovery, tell them to leave a Support Ticket so Gideon can unlock it from Owner Console.
8. Human Escalation & Leaving a Support Ticket When Gideon Is Away:
   - Always try to solve the customer's question directly first with clear steps.
   - If the customer needs account-specific review (e.g. KYC approval, PayPal withdrawal release, or wrong PayPal email unlock), invite them to click "Leave Ticket for Gideon" right at the bottom of the chat window, OR contact Gideon via Call: +254712727558, WhatsApp: 0785909543 (https://wa.me/254785909543), or Email: nigideon36@gmail.com.

Style guidelines: Be warm, reassuring, concise, honest, and practical. Use clean numbered steps or short bullets. Never fabricate balances, transaction IDs, or fake approvals, and never display "$" signs.`;

function buildChatContents(messages: any[]) {
  const sanitized = (Array.isArray(messages) ? messages : [])
    .filter((m) => m && typeof (m.content || m.text) === 'string' && (m.content || m.text).trim().length > 0)
    .map((m) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.content || m.text).trim() }],
    }));

  // Ensure the conversation starts with a user turn for Gemini multi-turn compatibility
  while (sanitized.length > 0 && sanitized[0].role === 'model') {
    sanitized.shift();
  }
  return sanitized;
}

function extractGroundingSources(candidate: any): { title: string; uri: string }[] {
  const chunks = candidate?.groundingMetadata?.groundingChunks;
  const sources: { title: string; uri: string }[] = [];
  const seen = new Set<string>();
  if (Array.isArray(chunks)) {
    for (const c of chunks) {
      if (c.web?.uri && !seen.has(c.web.uri)) {
        seen.add(c.web.uri);
        sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri });
      }
    }
  }
  return sources;
}

function extractReadableGeminiError(error: any): { status: number; message: string } {
  const status = typeof error?.status === 'number' ? error.status : 500;
  let raw = typeof error?.message === 'string' ? error.message : 'Live AI service encountered an error.';
  for (let i = 0; i < 3; i++) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.error?.message && typeof parsed.error.message === 'string') {
        raw = parsed.error.message;
      } else if (typeof parsed?.message === 'string') {
        raw = parsed.message;
      } else {
        break;
      }
    } catch {
      break;
    }
  }
  return { status, message: raw };
}

function isRetryableGeminiError(error: any): boolean {
  const status = Number(error?.status || 0);
  const msg = String(error?.message || '').toLowerCase();
  return (
    status === 429 ||
    status === 503 ||
    status === 500 ||
    msg.includes('high demand') ||
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('temporarily') ||
    msg.includes('resource_exhausted') ||
    msg.includes('unavailable')
  );
}

function buildCustomerContextAppendix(customerContext: any): string {
  if (!customerContext || typeof customerContext !== 'object') return '';
  const signedIn = customerContext.isSignedIn ? 'Signed In' : 'Guest (not signed in)';
  const name = customerContext.displayName ? `, Name=${String(customerContext.displayName).slice(0, 50)}` : '';
  const country = customerContext.country || 'East Africa';
  const bal = customerContext.formattedBalance || `KSh ${Math.round(Number(customerContext.balance || 0) * 130)}`;
  const pass = customerContext.pass || 'Free Tier (No Worker Pass)';
  const tasks = Number(customerContext.tasksCompleted || 0);
  return `\n\nSigned-in Customer Context (read-only): Status=${signedIn}${name}, Country=${country}, Balance=${bal}, ActivePass=${pass}, CompletedTasks=${tasks}.`;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      const err: any = new Error(`${label} timed out after ${ms}ms`);
      err.status = 503;
      reject(err);
    }, ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function openGeminiStreamWithResilience(params: {
  contents: any[];
  systemInstruction: string;
  useSearch: boolean;
  preferredModel: string;
}) {
  if (!ai) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const attempts: { model: string; useSearch: boolean; delayMs: number; timeoutMs: number }[] = [
    { model: params.preferredModel, useSearch: params.useSearch, delayMs: 0, timeoutMs: 9000 },
  ];

  // If grounding tool was enabled and fails/quota-limits, retry immediately without search grounding
  if (params.useSearch) {
    attempts.push({ model: params.preferredModel, useSearch: false, delayMs: 200, timeoutMs: 9000 });
  }
  // Retry same model once with short backoff on transient 503/429 spikes
  attempts.push({ model: params.preferredModel, useSearch: false, delayMs: 350, timeoutMs: 9000 });
  // Fast live Gemini failover if primary is overloaded or slow
  const alternateModel =
    params.preferredModel === 'gemini-3.1-flash-lite' ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
  attempts.push({ model: alternateModel, useSearch: false, delayMs: 150, timeoutMs: 12000 });

  let lastError: any = null;
  for (const step of attempts) {
    if (step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs));
    }
    const config: any = {
      systemInstruction: params.systemInstruction,
    };
    if (step.useSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    try {
      const responseStream = await withTimeout(
        ai.models.generateContentStream({
          model: step.model,
          contents: params.contents,
          config,
        }),
        step.timeoutMs,
        step.model
      );
      return { responseStream, modelUsed: step.model };
    } catch (err) {
      lastError = err;
      if (!isRetryableGeminiError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

async function generateGeminiReplyWithResilience(params: {
  contents: any[];
  systemInstruction: string;
  useSearch: boolean;
  preferredModel: string;
}) {
  if (!ai) {
    throw new Error('Missing GEMINI_API_KEY');
  }

  const attempts: { model: string; useSearch: boolean; delayMs: number; timeoutMs: number }[] = [
    { model: params.preferredModel, useSearch: params.useSearch, delayMs: 0, timeoutMs: 9000 },
  ];
  if (params.useSearch) {
    attempts.push({ model: params.preferredModel, useSearch: false, delayMs: 200, timeoutMs: 9000 });
  }
  attempts.push({ model: params.preferredModel, useSearch: false, delayMs: 350, timeoutMs: 9000 });
  const alternateModel =
    params.preferredModel === 'gemini-3.1-flash-lite' ? 'gemini-4-hydrogen' : 'gemini-3.1-flash-lite';
  attempts.push({ model: alternateModel, useSearch: false, delayMs: 150, timeoutMs: 12000 });

  let lastError: any = null;
  for (const step of attempts) {
    if (step.delayMs > 0) {
      await new Promise((r) => setTimeout(r, step.delayMs));
    }
    const config: any = {
      systemInstruction: params.systemInstruction,
    };
    if (step.useSearch) {
      config.tools = [{ googleSearch: {} }];
    }
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model: step.model,
          contents: params.contents,
          config,
        }),
        step.timeoutMs,
        step.model
      );
      return { response, modelUsed: step.model };
    } catch (err) {
      lastError = err;
      if (!isRetryableGeminiError(err)) {
        throw err;
      }
    }
  }
  throw lastError;
}

// 1. Live Streaming Chatbot with Google Search Grounding (SSE)
app.post('/api/chat/stream', async (req, res) => {
  try {
    const {
      messages,
      useSearch = false,
      modelMode = 'hydrogen',
      systemInstruction,
      customerContext,
    } = req.body || {};
    if (!ai) {
      return res.status(503).json({
        error: 'Live AI Chatbot is not configured yet (missing GEMINI_API_KEY). For immediate assistance, Call +254712727558 or WhatsApp 0785909543.',
      });
    }

    const contents = buildChatContents(messages);
    if (contents.length === 0) {
      return res.status(400).json({ error: 'Please enter a message to ask the AI assistant.' });
    }

    const preferredModel = modelMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const fullInstruction =
      (systemInstruction || GIDEON_SUPPORT_SYSTEM_INSTRUCTION) + buildCustomerContextAppendix(customerContext);

    const { responseStream, modelUsed } = await openGeminiStreamWithResilience({
      contents,
      systemInstruction: fullInstruction,
      useSearch: Boolean(useSearch),
      preferredModel,
    });

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    const allSources: { title: string; uri: string }[] = [];
    const seenUris = new Set<string>();

    for await (const chunk of responseStream) {
      const delta = chunk.text || '';
      const chunkSources = extractGroundingSources(chunk.candidates?.[0]);
      for (const s of chunkSources) {
        if (!seenUris.has(s.uri)) {
          seenUris.add(s.uri);
          allSources.push(s);
        }
      }
      if (delta) {
        res.write(`data: ${JSON.stringify({ chunk: delta })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true, sources: allSources, modelUsed })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('Chat stream error:', error);
    const { status, message } = extractReadableGeminiError(error);
    if (!res.headersSent) {
      res.status(status).json({ error: message });
    } else {
      res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
      res.end();
    }
  }
});

// 1b. Multi-turn Chatbot with Google Search Grounding (JSON)
app.post('/api/chat', async (req, res) => {
  try {
    const {
      messages,
      useSearch = false,
      modelMode = 'hydrogen',
      systemInstruction,
      customerContext,
    } = req.body || {};
    if (!ai) {
      return res.status(503).json({
        error: 'Live AI Chatbot requires GEMINI_API_KEY to be configured on the server. For immediate assistance, Call +254712727558 or WhatsApp 0785909543.',
      });
    }

    const contents = buildChatContents(messages);
    if (contents.length === 0) {
      return res.status(400).json({ error: 'Please enter a message to ask the AI assistant.' });
    }

    const preferredModel = modelMode === 'fast' ? 'gemini-3.1-flash-lite' : 'gemini-4-hydrogen';
    const fullInstruction =
      (systemInstruction || GIDEON_SUPPORT_SYSTEM_INSTRUCTION) + buildCustomerContextAppendix(customerContext);

    const { response, modelUsed } = await generateGeminiReplyWithResilience({
      contents,
      systemInstruction: fullInstruction,
      useSearch: Boolean(useSearch),
      preferredModel,
    });

    const text = response.text || 'No response generated.';
    const sources = extractGroundingSources(response.candidates?.[0]);

    res.json({ text, sources, modelUsed });
  } catch (error: any) {
    console.error('Chat error:', error);
    const { status, message } = extractReadableGeminiError(error);
    res.status(status).json({ error: message });
  }
});

// 2. Google Maps Grounding & Local Field Tasks
app.post('/api/maps-grounding', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    if (!ai) {
      return res.status(503).json({
        error: 'Google Maps grounding requires GEMINI_API_KEY configuration on the server.',
      });
    }

    const config: any = {
      tools: [{ googleMaps: {} }],
    };

    if (latitude && longitude) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: Number(latitude),
            longitude: Number(longitude),
          },
        },
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: query || 'Find nearby businesses, grocery markets, or retail points for mystery shopper tasks',
      config,
    });

    const text = response.text || '';
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const mapsLinks: { title: string; uri: string }[] = [];

    if (Array.isArray(chunks)) {
      chunks.forEach((c: any) => {
        if (c.maps?.uri) {
          mapsLinks.push({ title: c.maps.title || 'View on Google Maps', uri: c.maps.uri });
        }
      });
    }

    res.json({ text, mapsLinks });
  } catch (error: any) {
    console.error('Maps error:', error);
    res.status(typeof error?.status === 'number' ? error.status : 500).json({
      error: error?.message || 'Maps query failed',
    });
  }
});

// 3. Audio Transcription (gemini-3.5-transcribe)
app.post('/api/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm' } = req.body;
    if (!audioBase64) {
      return res.status(400).json({ error: 'Missing audioBase64 data' });
    }

    if (!ai) {
      return res.status(200).json({
        text: "Transcription simulation: 'Audio quality verified. Voice response captured accurately.'"
      });
    }

    const audioPart = {
      inlineData: {
        mimeType,
        data: audioBase64
      }
    };

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {
        parts: [
          audioPart,
          { text: "Transcribe this audio verbatim with correct punctuation and casing." }
        ]
      }
    });

    res.json({ text: response.text || '' });
  } catch (error: any) {
    console.error('Transcribe error:', error);
    res.status(500).json({ error: error.message || 'Audio transcription failed' });
  }
});

// 4. Image Generation & Editing (gemini-nano-banana-2.1)
app.post('/api/generate-image', async (req, res) => {
  try {
    const { prompt, aspectRatio = '1:1', imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!ai) {
      return res.status(200).json({
        imageUrl: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
        message: "Demo image placeholder"
      });
    }

    let contentsParts: any[] = [];
    if (imageBase64) {
      contentsParts.push({
        inlineData: {
          data: imageBase64,
          mimeType
        }
      });
    }
    contentsParts.push({ text: prompt || 'A futuristic vibrant digital worker logo' });

    const response = await ai.models.generateContent({
      model: 'gemini-nano-banana-2.1',
      contents: { parts: contentsParts },
      config: {
        imageConfig: {
          aspectRatio,
          imageSize: '1K'
        }
      }
    });

    let imageUrl = '';
    for (const part of response.candidates?.[0]?.content?.parts ?? []) {
      if (part.inlineData?.data) {
        const mime = part.inlineData.mimeType ?? 'image/png';
        imageUrl = `data:${mime};base64,${part.inlineData.data}`;
        break;
      }
    }

    res.json({ imageUrl, text: response.text || '' });
  } catch (error: any) {
    console.error('Image generation error:', error);
    // Fallback to flash-lite if nano banana unavailable
    try {
      if (ai) {
        const response2 = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite-image',
          contents: { parts: [{ text: req.body.prompt || 'Modern digital task abstract art' }] }
        });
        let imageUrl = '';
        for (const part of response2.candidates?.[0]?.content?.parts ?? []) {
          if (part.inlineData?.data) {
            const mime = part.inlineData.mimeType ?? 'image/png';
            imageUrl = `data:${mime};base64,${part.inlineData.data}`;
            break;
          }
        }
        return res.json({ imageUrl, text: response2.text || '' });
      }
    } catch (e2) {
      console.error('Fallback image failed', e2);
    }
    res.status(500).json({ error: error.message || 'Image generation failed' });
  }
});

// 5. Video Generation & Image Animation (gemini-omni-1.2-flash via Interactions API)
app.post('/api/generate-video', async (req, res) => {
  try {
    const { prompt, imageBase64, mimeType = 'image/jpeg', aspectRatio = '16:9' } = req.body;
    if (!ai) {
      return res.status(200).json({
        videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
        status: 'completed'
      });
    }

    // Call interactions API
    const interactionParams: any = {
      model: 'gemini-omni-1.2-flash',
      input: {
        prompt: prompt || 'Cinematic slow motion camera glide through modern creative studio',
      },
      config: {
        aspectRatio
      }
    };

    if (imageBase64) {
      interactionParams.input.image = {
        data: imageBase64,
        mimeType
      };
    }

    if ((ai as any).interactions?.create) {
      const interaction = await (ai as any).interactions.create(interactionParams);
      return res.json({ interaction, status: 'processing' });
    }

    res.json({
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      status: 'simulated'
    });
  } catch (error: any) {
    console.error('Video error:', error);
    res.status(500).json({ error: error.message || 'Video generation failed' });
  }
});

// 6. Music Generation (lyria-3-clip-preview)
app.post('/api/generate-music', async (req, res) => {
  try {
    const { prompt } = req.body;
    if (!ai) {
      return res.status(200).json({
        audioDataUrl: '',
        lyrics: 'Cinematic upbeat background music for creators.',
        demo: true
      });
    }

    const response = await ai.models.generateContentStream({
      model: 'lyria-3-clip-preview',
      contents: prompt || '30-second upbeat lofi study and work beat with chill vinyl warmth.'
    });

    const audioChunks: Buffer[] = [];
    let lyrics = '';
    let mimeType = 'audio/mpeg';

    for await (const chunk of response) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (audioChunks.length === 0 && part.inlineData.mimeType) {
            mimeType = part.inlineData.mimeType;
          }
          audioChunks.push(Buffer.from(part.inlineData.data, 'base64'));
        }
        if (part.text) {
          lyrics += part.text;
        }
      }
    }

    const audioBase64 = Buffer.concat(audioChunks).toString('base64');
    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;

    res.json({ audioDataUrl, lyrics });
  } catch (error: any) {
    console.error('Music generation error:', error);
    res.status(500).json({ error: error.message || 'Music generation failed' });
  }
});

// --- Product Auctions Marketplace API ---

// Public/Authenticated: List live & completed auctions
app.get('/api/auctions', optionalAuth, (_req: AuthRequest, res) => {
  const auctions = listAuctions({ includeSuspended: false });
  res.json({
    success: true,
    auctions,
    stats: {
      totalCount: auctions.length,
      liveCount: auctions.filter((a) => a.status === 'Live').length,
      soldCount: auctions.filter((a) => a.status === 'Sold').length,
      totalBidsCount: auctions.reduce((sum, a) => sum + (a.bidCount || 0), 0),
    },
  });
});

// Authenticated: Customer uploads a product & launches an auction
app.post('/api/auctions', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Sign in required to list an auction.' });

    const cust = getCustomerByUid(uid);
    const banCheck = isIdentifierOrAccountBanned({
      uid,
      phone: cust?.phone || req.user?.phone_number,
      email: cust?.email || req.user?.email,
      countryCode: cust?.countryCode,
    });
    if (banCheck.banned) {
      return res.status(403).json({
        success: false,
        error: `Account permanently banned 🚫 forever: ${banCheck.reason || 'Policy violation.'}`,
      });
    }
    if (cust?.deactivated) {
      return res.status(403).json({
        success: false,
        error: `Account deactivated: ${cust.deactivatedReason || 'Contact Support (+254712727558).'}`,
      });
    }

    const {
      title,
      description,
      category,
      condition,
      location,
      imageUrls,
      startingBidKes,
      minIncrementKes,
      buyNowKes,
      durationHours,
      deliveryTerms,
      countryCode,
      sellerDepositPaypalRef,
    } = req.body || {};

    const auction = createAuction({
      sellerUid: uid,
      sellerName: cust?.displayName || req.user?.name || req.user?.email?.split('@')[0] || 'Verified Seller',
      sellerPhone: cust?.phone || req.user?.phone_number,
      sellerCountryCode: String(countryCode || cust?.countryCode || 'KE'),
      title: String(title || ''),
      description: String(description || ''),
      category: String(category || 'Other'),
      condition: String(condition || 'Like New'),
      location: String(location || cust?.city || 'Nairobi, Kenya'),
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      startingBidKes: Number(startingBidKes),
      minIncrementKes: Number(minIncrementKes),
      buyNowKes: buyNowKes ? Number(buyNowKes) : undefined,
      durationHours: Number(durationHours) || 24,
      deliveryTerms: deliveryTerms ? String(deliveryTerms) : undefined,
      sellerDepositPaypalRef: String(sellerDepositPaypalRef || ''),
    });

    void notifyAdminPlatformEvent({
      eventType: 'auction_activity',
      title: `New Escrow-Protected Auction: ${auction.title}`,
      summary: `${auction.sellerName} paid 50% escrow deposit (KES ${auction.escrowDepositKes.toLocaleString()} · PayPal Ref ${auction.sellerDepositPaypalRef}) and listed "${auction.title}" starting at KES ${auction.startingBidKes.toLocaleString()}.`,
      actorName: auction.sellerName,
      actorPhone: auction.sellerPhone,
      countryCode: auction.sellerCountryCode,
      amountLabel: `Escrow KES ${auction.escrowDepositKes.toLocaleString()} (50%)`,
      details: {
        AuctionId: auction.id,
        Category: auction.category,
        Location: auction.location,
        PayPalEscrowRef: auction.sellerDepositPaypalRef,
      },
    });

    return res.status(201).json({ success: true, auction });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not create product auction.',
    });
  }
});

// Authenticated: Place bid on live auction
app.post('/api/auctions/:id/bid', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Sign in required to place a bid.' });

    const cust = getCustomerByUid(uid);
    const banCheck = isIdentifierOrAccountBanned({
      uid,
      phone: cust?.phone || req.user?.phone_number,
      email: cust?.email || req.user?.email,
      countryCode: cust?.countryCode,
    });
    if (banCheck.banned || cust?.deactivated) {
      return res.status(403).json({
        success: false,
        error: banCheck.banned
          ? `Account permanently banned: ${banCheck.reason || 'Policy violation.'}`
          : `Account deactivated: ${cust?.deactivatedReason || 'Contact Support.'}`,
      });
    }

    const updated = placeAuctionBid({
      auctionId: String(req.params.id || ''),
      bidderUid: uid,
      bidderName: cust?.displayName || req.user?.name || req.user?.email?.split('@')[0] || 'Contributor',
      bidderPhone: cust?.phone || req.user?.phone_number,
      amountKes: Number(req.body?.amountKes),
      bidderDepositPaypalRef: String(req.body?.bidderDepositPaypalRef || ''),
    });

    return res.json({ success: true, auction: updated });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Bid rejected.',
    });
  }
});

// Authenticated: Instant Buy Now on live auction
app.post('/api/auctions/:id/buy-now', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Sign in required to buy now.' });

    const cust = getCustomerByUid(uid);
    if (cust?.deactivated || isIdentifierOrAccountBanned({ uid, phone: cust?.phone, email: cust?.email }).banned) {
      return res.status(403).json({ success: false, error: 'Account suspended or deactivated.' });
    }

    const updated = buyNowAuction({
      auctionId: String(req.params.id || ''),
      buyerUid: uid,
      buyerName: cust?.displayName || req.user?.name || req.user?.email?.split('@')[0] || 'Buyer',
      buyerPhone: cust?.phone || req.user?.phone_number,
      buyerDepositPaypalRef: String(req.body?.buyerDepositPaypalRef || req.body?.bidderDepositPaypalRef || ''),
    });

    return res.json({ success: true, auction: updated });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Buy Now failed.',
    });
  }
});

// Authenticated: Seller or Owner closes/accepts highest bid or cancels auction
app.post('/api/auctions/:id/close', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Unauthorized' });
    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);

    const updated = closeOrCancelAuction({
      auctionId: String(req.params.id || ''),
      actorUid: uid,
      isOwner,
      action: req.body?.action === 'accept_highest' ? 'accept_highest' : 'cancel',
    });

    return res.json({ success: true, auction: updated });
  } catch (error: any) {
    return res.status(403).json({
      success: false,
      error: error?.message || 'Could not close auction.',
    });
  }
});

// Authenticated: Hydrate auctions from Firestore backup on server restart
app.post('/api/auctions/hydrate-sync', requireAuth, (req: AuthRequest, res) => {
  const items = Array.isArray(req.body?.auctions) ? req.body.auctions : [];
  for (const item of items) {
    hydrateAuctionFromClient(item);
  }
  return res.json({ success: true, auctions: listAuctions({ includeSuspended: false }) });
});

// Owner ONLY: View all auctions (including Suspended)
app.get('/api/owner/auctions', requireOwner, (_req: AuthRequest, res) => {
  const auctions = listAuctions({ includeSuspended: true });
  return res.json({
    success: true,
    auctions,
    stats: {
      totalCount: auctions.length,
      liveCount: auctions.filter((a) => a.status === 'Live').length,
      soldCount: auctions.filter((a) => a.status === 'Sold').length,
      suspendedCount: auctions.filter((a) => a.status === 'Suspended').length,
      totalBidVolumeKes: auctions.reduce((sum, a) => sum + (a.bidCount > 0 ? a.currentBidKes : 0), 0),
    },
  });
});

// Owner ONLY: Edit, feature, suspend, or reopen any auction
app.patch('/api/owner/auctions/:id', requireOwner, (req: AuthRequest, res) => {
  try {
    const updated = ownerUpdateAuction(String(req.params.id || ''), req.body || {});
    return res.json({ success: true, auction: updated });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not update auction.',
    });
  }
});

// Seller or Owner: Delete auction listing
app.delete('/api/owner/auctions/:id', requireOwner, (req: AuthRequest, res) => {
  const ok = deleteAuction(String(req.params.id || ''), req.user?.uid || '', true);
  if (!ok) return res.status(404).json({ success: false, error: 'Auction not found.' });
  return res.json({ success: true });
});

app.delete('/api/auctions/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || '';
    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);
    const ok = deleteAuction(String(req.params.id || ''), uid, isOwner);
    if (!ok) return res.status(404).json({ success: false, error: 'Auction not found.' });
    return res.json({ success: true });
  } catch (error: any) {
    return res.status(403).json({ success: false, error: error?.message || 'Delete not allowed.' });
  }
});

// =========================================================================
// Task Marketplace Email Alert Subscription Routes
// =========================================================================
app.get('/api/task-alerts/my', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, error: 'Authentication required.' });
  const data = getTaskAlertsForUser(uid, req.user?.email || getCustomerByUid(uid)?.email);
  return res.json({ success: true, ...data });
});

app.post('/api/task-alerts/subscribe', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Sign in required to subscribe.' });

    const body = req.body || {};
    const cust = getCustomerByUid(uid);
    const email = String(body.email || req.user?.email || cust?.email || '').trim();
    const sub = upsertTaskAlertSubscription({
      userUid: uid,
      email,
      categories: body.categories,
      minRewardKes: Number(body.minRewardKes),
      frequency: body.frequency === 'daily_digest' ? 'daily_digest' : 'instant',
      active: body.active !== false,
    });

    const alerts = getTaskAlertsForUser(uid, email);
    return res.status(201).json({
      success: true,
      dispatches: alerts.dispatches,
      smtpConfigured: alerts.smtpConfigured,
      subscription: sub,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not save email alert subscription.',
    });
  }
});

app.post('/api/task-alerts/hydrate', requireAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  if (!uid) return res.status(401).json({ success: false, error: 'Authentication required.' });
  const sub = req.body?.subscription;
  if (sub && sub.userUid === uid) {
    hydrateTaskAlertFromClient(sub);
  }
  return res.json({ success: true, ...getTaskAlertsForUser(uid, req.user?.email) });
});

app.delete('/api/task-alerts/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Authentication required.' });
    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);
    const ok = deleteTaskAlertSubscription(String(req.params.id || ''), uid, isOwner);
    if (!ok) return res.status(404).json({ success: false, error: 'Subscription not found.' });
    return res.json({ success: true, ...getTaskAlertsForUser(uid, req.user?.email) });
  } catch (error: any) {
    return res.status(403).json({ success: false, error: error?.message || 'Delete failed.' });
  }
});

app.get('/api/owner/task-alerts', requireOwner, (_req: AuthRequest, res) => {
  return res.json({ success: true, ...listAllTaskAlertsForOwner() });
});

app.post('/api/owner/tasks/notify', requireOwner, async (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    if (!body.id || !body.title || typeof body.reward !== 'number') {
      return res.status(400).json({ success: false, error: 'Valid task id, title, and reward are required.' });
    }
    const result = await dispatchAlertsForNewTask({
      id: String(body.id),
      title: String(body.title),
      category: String(body.category || 'micro'),
      reward: Number(body.reward),
      description: String(body.description || ''),
    });

    const rewardKes = Math.round(Number(body.reward) * 130);
    const adminLog = await notifyAdminPlatformEvent({
      eventType: 'high_reward_task',
      title: `High-Reward Task Published: ${String(body.title)}`,
      summary: `A high-reward task (${rewardKes} KSh · Category: ${String(body.category || 'micro')}) was published. ${result.matchedCount} subscriber(s) matched (${result.emailedCount} emailed).`,
      actorName: req.user?.name || 'Platform Owner',
      actorEmail: req.user?.email || OWNER_EMAIL,
      rewardKes,
      rewardUsd: Number(body.reward),
      details: {
        TaskId: String(body.id),
        Category: String(body.category || 'micro'),
        MatchedSubscribers: result.matchedCount,
        SubscriberEmailsSent: result.emailedCount,
      },
    });

    return res.json({ success: true, ...result, adminNotification: adminLog });
  } catch (error: any) {
    return res.status(500).json({ success: false, error: error?.message || 'Alert dispatch error.' });
  }
});

// =========================================================================
// Serverless Function Webhook & Owner Console for Real-Time Admin Email Alerts
// =========================================================================
const RUNTIME_ADMIN_NOTIFY_SECRET = crypto.randomBytes(32).toString('hex');

app.post('/api/serverless/admin-notify', optionalAuth, async (req: AuthRequest, res) => {
  const configuredSecret =
    process.env.ADMIN_NOTIFY_SECRET ||
    process.env.CUSTOMER_AUTH_SECRET ||
    RUNTIME_ADMIN_NOTIFY_SECRET;
  const providedSecret = String(req.headers['x-admin-notify-secret'] || '').trim();
  const isOwnerToken =
    req.user?.authKind === 'firebase' &&
    req.user?.email?.toLowerCase() === OWNER_EMAIL &&
    Boolean(req.user?.email_verified);

  if (!isOwnerToken && (!providedSecret || providedSecret !== configuredSecret)) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized serverless trigger. Sign in as Platform Owner or provide a valid x-admin-notify-secret header.',
    });
  }

  return adminEmailNotificationHandler(req, res);
});

app.get('/api/owner/admin-notifications', requireOwner, (_req: AuthRequest, res) => {
  return res.json({
    success: true,
    ...getPublicAdminNotificationStatus(),
  });
});

app.patch('/api/owner/admin-notifications', requireOwner, (req: AuthRequest, res) => {
  try {
    const body = req.body || {};
    const status = updateAdminNotificationSettings({
      adminEmail: body.adminEmail,
      enabled: body.enabled,
      highRewardThresholdKes: body.highRewardThresholdKes,
      events: body.events,
    });
    return res.json({
      success: true,
      ...status,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not update admin notification settings.',
    });
  }
});

app.post('/api/owner/admin-notifications/test', requireOwner, async (_req: AuthRequest, res) => {
  try {
    const dispatch = await sendAdminTestEmail();
    return res.json({
      success: dispatch.deliveryStatus !== 'Failed',
      dispatch,
      ...getPublicAdminNotificationStatus(),
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      error: error?.message || 'Failed to run SMTP admin test email.',
    });
  }
});

// =========================================================================
// Free Pay-Per-View Status Feed (5 Shillings / View · 24h Auto-Paid to Wallet)
// =========================================================================
app.get('/api/ppv/media/:filename', (req, res) => {
  const resolved = resolvePpvMediaFilePath(String(req.params.filename || ''));
  if (!resolved) {
    return res.status(404).json({ success: false, error: 'Media file not found.' });
  }

  const stat = fs.statSync(resolved.fullPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    if (Number.isNaN(start) || start >= fileSize || end >= fileSize || start > end) {
      res.status(416).set('Content-Range', `bytes */${fileSize}`).end();
      return;
    }
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': resolved.contentType,
      'Cache-Control': 'public, max-age=86400',
    });
    fs.createReadStream(resolved.fullPath, { start, end }).pipe(res);
    return;
  }

  res.writeHead(200, {
    'Accept-Ranges': 'bytes',
    'Content-Length': fileSize,
    'Content-Type': resolved.contentType,
    'Cache-Control': 'public, max-age=86400',
  });
  fs.createReadStream(resolved.fullPath).pipe(res);
});

app.get('/api/ppv', optionalAuth, (req: AuthRequest, res) => {
  const viewerUid = req.user?.uid || null;
  return res.json({
    success: true,
    ...listPpvFeed(viewerUid),
  });
});

// 100% Free upload (NO Worker Pass or purchase required)
app.post('/api/ppv/posts', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({ success: false, error: 'Please register or sign in for free to post a status.' });
    }

    const cust = getCustomerByUid(uid);
    const banCheck = isIdentifierOrAccountBanned({
      uid,
      phone: cust?.phone || req.user?.phone_number,
      email: cust?.email || req.user?.email,
      countryCode: cust?.countryCode,
    });
    if (banCheck.banned || cust?.deactivated) {
      return res.status(403).json({
        success: false,
        error: banCheck.banned
          ? `Account permanently banned: ${banCheck.reason || 'Policy violation.'}`
          : `Account deactivated: ${cust?.deactivatedReason || 'Contact Support.'}`,
      });
    }

    const body = req.body || {};
    const post = createPpvPost({
      authorUid: uid,
      authorName: String(body.authorName || cust?.displayName || req.user?.name || 'East Africa Creator'),
      countryCode: String(body.countryCode || cust?.countryCode || 'KE'),
      city: String(body.city || cust?.city || 'Nairobi'),
      category: body.category,
      caption: String(body.caption || ''),
      mediaDataUrl: String(body.mediaDataUrl || ''),
    });

    void notifyAdminPlatformEvent({
      eventType: 'ppv_status_uploaded',
      title: `New Free PPV Status Posted by ${post.authorName}`,
      summary: `${post.authorName} uploaded a ${post.mediaType} (${post.category}) earning 5 KSh/view (auto-paid after 24h).`,
      actorName: post.authorName,
      countryCode: post.countryCode,
      details: {
        PostId: post.id,
        Category: post.category,
        MediaType: post.mediaType,
      },
    });

    return res.status(201).json({
      success: true,
      post,
      ...listPpvFeed(uid),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not upload Pay-Per-View status.',
    });
  }
});

// Registered platform members view statuses & count 5 KSh toward 24h auto-payout
app.post('/api/ppv/posts/:id/view', requireAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) {
      return res.status(401).json({
        success: false,
        error: 'Sign in or register for free to view customer statuses.',
      });
    }

    const result = recordPpvView({
      postId: String(req.params.id || ''),
      viewerUid: uid,
    });

    return res.json({
      success: true,
      viewCounted: result.viewCounted,
      selfView: result.selfView,
      expired: result.expired,
      post: result.post,
      ...listPpvFeed(uid),
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not record status view.',
    });
  }
});

app.delete('/api/ppv/posts/:id', requireAuth, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ success: false, error: 'Unauthorized.' });
    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);
    const removed = deletePpvPost(String(req.params.id || ''), uid, isOwner);
    if (!removed) return res.status(404).json({ success: false, error: 'Status post not found.' });
    return res.json({ success: true, ...listPpvFeed(uid) });
  } catch (error: any) {
    return res.status(403).json({ success: false, error: error?.message || 'Forbidden.' });
  }
});

app.post('/api/ppv/hydrate-sync', requireAuth, (req: AuthRequest, res) => {
  const posts = Array.isArray(req.body?.posts) ? req.body.posts : [];
  hydratePpvFromClient(posts);
  return res.json({ success: true, ...listPpvFeed(req.user?.uid || null) });
});

app.post('/api/owner/ppv/posts/:id/settle', requireOwner, (req: AuthRequest, res) => {
  try {
    const post = ownerForceSettlePpvPost(String(req.params.id || ''));
    return res.json({
      success: true,
      post,
      ...listPpvFeed(req.user?.uid || null),
    });
  } catch (error: any) {
    return res.status(400).json({ success: false, error: error?.message || 'Could not settle 24h status payout.' });
  }
});

app.delete('/api/owner/ppv/posts/:id', requireOwner, (req: AuthRequest, res) => {
  const removed = deletePpvPost(String(req.params.id || ''), req.user?.uid || 'owner', true);
  if (!removed) return res.status(404).json({ success: false, error: 'Status post not found.' });
  return res.json({ success: true, ...listPpvFeed(req.user?.uid || null) });
});

function injectMonetagHeadHtml(html: string): string {
  if (!publisherConfig.monetagEnabled) return html;
  const snippets: string[] = [];
  if (publisherConfig.monetagMetaTag) {
    const safeMeta = publisherConfig.monetagMetaTag.replace(/["<>]/g, '');
    snippets.push(`<meta name="monetag" content="${safeMeta}" />`);
  }
  if (
    publisherConfig.monetagScriptTag &&
    /^<script\b[^>]*>[\s\S]*<\/script>$/i.test(publisherConfig.monetagScriptTag.trim())
  ) {
    snippets.push(publisherConfig.monetagScriptTag.trim());
  } else if (
    publisherConfig.monetagScriptSrc &&
    /^https:\/\/[a-zA-Z0-9.-]+/.test(publisherConfig.monetagScriptSrc)
  ) {
    snippets.push(
      `<script src="${publisherConfig.monetagScriptSrc.replace(/["<>]/g, '')}" async data-cfasync="false"></script>`
    );
  }
  if (snippets.length === 0) return html;
  return html.replace(/<head([^>]*)>/i, `<head$1>\n    ${snippets.join('\n    ')}`);
}

// Direct Facebook Brand Kit asset endpoints (view & download on mobile/desktop)
app.get('/brand/facebook-profile.jpg', (req, res) => {
  const candidates = [
    path.resolve(process.cwd(), 'public/assets/brand/gideon-facebook-profile.jpg'),
    path.resolve(process.cwd(), 'src/assets/images/fb_profile_logo_1795191798991.jpg'),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) return res.status(404).send('Profile image not found');
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', 'attachment; filename="gideon-facebook-profile.jpg"');
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(filePath);
});

app.get('/brand/facebook-cover.jpg', (req, res) => {
  const candidates = [
    path.resolve(process.cwd(), 'public/assets/brand/gideon-facebook-cover.jpg'),
    path.resolve(process.cwd(), 'src/assets/images/fb_cover_clean_1795191811809.jpg'),
  ];
  const filePath = candidates.find((p) => fs.existsSync(p));
  if (!filePath) return res.status(404).send('Cover image not found');
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', 'attachment; filename="gideon-facebook-cover.jpg"');
  }
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.sendFile(filePath);
});

// Vite middleware in dev
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });

    app.use(async (req, res, next) => {
      const accept = String(req.headers.accept || '');
      const isHtmlPageRequest =
        req.method === 'GET' &&
        !req.path.startsWith('/api/') &&
        !req.path.includes('.') &&
        accept.includes('text/html');

      if (!isHtmlPageRequest) {
        return vite.middlewares(req, res, next);
      }

      try {
        const indexPath = path.resolve(process.cwd(), 'index.html');
        let template = fs.readFileSync(indexPath, 'utf8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        template = injectMonetagHeadHtml(template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        return vite.middlewares(req, res, next);
      }
    });
  } else {
    app.use(express.static('dist', { index: false }));
    app.get('*', (_req, res) => {
      try {
        const rawHtml = fs.readFileSync(path.resolve(process.cwd(), 'dist', 'index.html'), 'utf8');
        res.status(200).set({ 'Content-Type': 'text/html' }).send(injectMonetagHeadHtml(rawHtml));
      } catch {
        res.sendFile('index.html', { root: 'dist' });
      }
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  processMaturePpvStatuses();
  setInterval(() => {
    processMaturePpvStatuses();
  }, 30 * 1000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gideon Global Tasks server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
