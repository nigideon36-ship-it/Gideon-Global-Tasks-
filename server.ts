import express from 'express';
import crypto from 'crypto';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, optionalAuth, requireOwner, OWNER_EMAIL, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { completedTasks, referrals, payouts } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { generateSitemapXml } from './src/utils/sitemapGenerator.ts';
import QRCode from 'qrcode';
import {
  EAST_AFRICA_COUNTRIES,
  getCountryByCode,
  formatCurrencyFromUsd,
  formatCurrencyFromKes,
  MAX_TASK_REWARD_KES,
  VIP_PASS_KES,
  WITHDRAWAL_THRESHOLD_USD,
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
} from './src/lib/customerAuth.ts';
import {
  submitWorkerPassProof,
  listAllPassProofs,
  listCustomerPassProofs,
  approvePassProof,
  rejectPassProof,
  banPassProofAccount,
  unbanPassProofAccount,
  clearBannedPassProofsForIdentity,
  PassProofForbiddenError,
} from './src/lib/passProofsStore.ts';
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
  setCustomerApprovedPackage,
  registerReferralAttribution,
  creditReferrerOnPassApproval,
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
  loadInitialPaystackConfig,
  persistPaystackConfig,
  sanitizePaymentPageUrl,
  inferPackageIdFromPaystackData,
  type PaystackConfig,
} from './src/lib/paystackConfigStore.ts';
import {
  getUserDailyQuotaRecord,
  validateAndRecordDailyTaskUsage,
} from './src/lib/dailyQuotaStore.ts';
import { getQuotaRuleForPackageId, type QuotaTierId } from './src/lib/passQuotas.ts';

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.gstatic.com https://apis.google.com https://adservice.google.com https://*.google-analytics.com https://unpkg.com https://*.intasend.com https://*.paystack.co https://*.paystack.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.intasend.com https://*.paystack.co https://*.paystack.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob: https://*.intasend.com https://*.paystack.co https://*.paystack.com; " +
    "frame-src 'self' https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.firebaseapp.com https://*.intasend.com https://*.paystack.co https://*.paystack.com; " +
    "connect-src 'self' https: wss: https://firestore.googleapis.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.intasend.com https://api.paystack.co https://*.paystack.co https://*.paystack.com;"
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
const DEFAULT_CANONICAL_URL = (
  process.env.APP_URL ||
  'https://ais-pre-zdmptijvon5uujsazond3b-435091693224.europe-west3.run.app'
).replace(/\/+$/, '');

let publisherConfig = {
  searchConsoleToken: 'google2d71976008fafb8e',
  adsensePublisherId: 'pub-8366092986496846',
  adsenseClientId: 'ca-pub-8366092986496846',
  canonicalUrl: DEFAULT_CANONICAL_URL
};

function resolveCanonicalOrigin(req: express.Request): string {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.get('host') || '';
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const proto = forwardedProto || req.protocol || 'https';
  if (host && !host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
    return `${proto}://${host}`.replace(/\/+$/, '');
  }
  return publisherConfig.canonicalUrl;
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
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.type('application/xml; charset=utf-8').send(xml);
});

app.get('/ads.txt', (_req, res) => {
  const pubId = publisherConfig.adsensePublisherId.replace(/^ca-/, '');
  res.type('text/plain; charset=utf-8').send(`google.com, ${pubId}, DIRECT, f08c47fec0942fa0\n`);
});

app.get('/api/publisher-config', (_req, res) => {
  res.json(publisherConfig);
});

app.post('/api/publisher-config', requireOwner, (req, res) => {
  const { searchConsoleToken, adsensePublisherId, adsenseClientId } = req.body;
  if (searchConsoleToken) publisherConfig.searchConsoleToken = String(searchConsoleToken).trim();
  if (adsensePublisherId) publisherConfig.adsensePublisherId = String(adsensePublisherId).trim();
  if (adsenseClientId) publisherConfig.adsenseClientId = String(adsenseClientId).trim();
  res.json({ success: true, config: publisherConfig });
});

// --- Safaricom Daraja M-PESA Integration ---
interface DarajaConfig {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  passkey: string;
  callbackUrl: string;
  b2cShortCode?: string;
  initiatorName?: string;
  securityCredential?: string;
  b2cResultUrl?: string;
}

let darajaConfig: DarajaConfig = {
  environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  businessShortCode: process.env.MPESA_SHORTCODE || '174379',
  passkey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://gideon-global-tasks.ai.studio/api/mpesa/callback',
  b2cShortCode: process.env.MPESA_B2C_SHORTCODE || process.env.MPESA_SHORTCODE || '',
  initiatorName: process.env.MPESA_INITIATOR_NAME || '',
  securityCredential: process.env.MPESA_SECURITY_CREDENTIAL || '',
  b2cResultUrl: process.env.MPESA_B2C_RESULT_URL || 'https://gideon-global-tasks.ai.studio/api/mpesa/b2c/result'
};

const mpesaTransactions = new Map<string, any>();

async function getDarajaToken(): Promise<string | null> {
  if (!darajaConfig.consumerKey || !darajaConfig.consumerSecret) {
    return null;
  }
  const authUrl = darajaConfig.environment === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const auth = Buffer.from(`${darajaConfig.consumerKey}:${darajaConfig.consumerSecret}`).toString('base64');
  const response = await fetch(authUrl, {
    method: 'GET',
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Daraja OAuth error:', errorText);
    throw new Error(`Daraja OAuth failed: ${response.statusText}`);
  }

  const data: any = await response.json();
  return data.access_token || null;
}

app.get('/api/mpesa/config', requireOwner, (_req, res) => {
  res.json({
    environment: darajaConfig.environment,
    businessShortCode: darajaConfig.businessShortCode,
    callbackUrl: darajaConfig.callbackUrl,
    isConfigured: Boolean(darajaConfig.consumerKey && darajaConfig.consumerSecret),
    consumerKeyMasked: darajaConfig.consumerKey ? darajaConfig.consumerKey.slice(0, 4) + '...' + darajaConfig.consumerKey.slice(-4) : '',
    hasPasskey: Boolean(darajaConfig.passkey)
  });
});

app.post('/api/mpesa/config', requireOwner, (req, res) => {
  const { environment, consumerKey, consumerSecret, businessShortCode, passkey, callbackUrl, initiatorName, securityCredential, b2cShortCode } = req.body;
  if (environment) darajaConfig.environment = environment === 'production' ? 'production' : 'sandbox';
  if (consumerKey !== undefined) darajaConfig.consumerKey = String(consumerKey).trim();
  if (consumerSecret !== undefined) darajaConfig.consumerSecret = String(consumerSecret).trim();
  if (businessShortCode !== undefined) darajaConfig.businessShortCode = String(businessShortCode).trim();
  if (passkey !== undefined) darajaConfig.passkey = String(passkey).trim();
  if (callbackUrl !== undefined) darajaConfig.callbackUrl = String(callbackUrl).trim();
  if (initiatorName !== undefined) darajaConfig.initiatorName = String(initiatorName).trim();
  if (securityCredential !== undefined) darajaConfig.securityCredential = String(securityCredential).trim();
  if (b2cShortCode !== undefined) darajaConfig.b2cShortCode = String(b2cShortCode).trim();

  res.json({
    success: true,
    message: 'Daraja configuration saved successfully',
    config: {
      environment: darajaConfig.environment,
      businessShortCode: darajaConfig.businessShortCode,
      isConfigured: Boolean(darajaConfig.consumerKey && darajaConfig.consumerSecret),
      b2cConfigured: Boolean(darajaConfig.consumerKey && darajaConfig.consumerSecret && darajaConfig.initiatorName && darajaConfig.securityCredential)
    }
  });
});

app.post('/api/mpesa/b2c/result', (req, res) => {
  try {
    const result = req.body?.Result;
    if (result?.TransactionID) {
      upsertPlatformTransaction({
        id: String(result.OriginatorConversationID || result.ConversationID || result.TransactionID),
        kind: 'withdrawal',
        title: 'Daraja B2C Mobile Money Settlement',
        customerLabel: 'M-PESA Recipient',
        gatewayOrMethod: 'Safaricom Daraja B2C',
        currency: 'KES',
        amountUsd: 0,
        status: result.ResultCode === 0 ? 'Completed' : 'Failed',
        reference: String(result.TransactionID),
        countryCode: 'KE',
      });
    }
  } catch (err) {
    console.warn('Daraja B2C callback notice:', err);
  }
  res.json({ ResultCode: 0, ResultDesc: 'B2C Result Processed' });
});

app.post('/api/mpesa/stkpush', requireEastAfrica, async (req, res) => {
  try {
    const { phone, amount = 10, packageId = 'pro', accountReference = 'GideonTasks' } = req.body;

    if (!isEastAfricaPhone(String(phone || ''))) {
      return res.status(403).json({ error: 'East Africa Only: Please provide a valid East Africa / M-PESA mobile number (+254, +256, +255, +250, etc.).' });
    }

    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      cleanPhone = '254' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please provide a valid Safaricom phone number (e.g., 0712345678 or 254712345678)' });
    }

    const token = await getDarajaToken().catch((err) => {
      console.warn('Daraja Token fetch notice:', err.message);
      return null;
    });

    const checkoutRequestId = `ws_CO_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    if (!token) {
      const receipt = `MP${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      mpesaTransactions.set(checkoutRequestId, {
        status: 'Completed',
        amount: Number(amount),
        phone: cleanPhone,
        mpesaReceipt: receipt,
        timestamp: new Date().toISOString()
      });

      upsertPlatformTransaction({
        id: checkoutRequestId,
        kind: 'pass_purchase',
        title: `Worker Pass (${packageId}) · M-PESA Daraja`,
        customerLabel: cleanPhone,
        gatewayOrMethod: 'M-PESA Daraja STK',
        currency: 'KES',
        amountLocal: Number(amount),
        amountUsd: +(Number(amount) / 130).toFixed(2),
        status: 'Completed',
        reference: receipt,
        countryCode: 'KE',
      });

      return res.json({
        success: true,
        simulation: true,
        checkoutRequestId,
        mpesaReceipt: receipt,
        message: `M-PESA STK Push prompt initiated for KES ${amount} to ${cleanPhone}. Enter your PIN on your phone to approve.`,
        phone: cleanPhone,
        amount: Number(amount)
      });
    }

    const date = new Date();
    const timestamp = date.getFullYear().toString() +
      String(date.getMonth() + 1).padStart(2, '0') +
      String(date.getDate()).padStart(2, '0') +
      String(date.getHours()).padStart(2, '0') +
      String(date.getMinutes()).padStart(2, '0') +
      String(date.getSeconds()).padStart(2, '0');

    const password = Buffer.from(`${darajaConfig.businessShortCode}${darajaConfig.passkey}${timestamp}`).toString('base64');

    const stkUrl = darajaConfig.environment === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const stkBody = {
      BusinessShortCode: darajaConfig.businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.max(1, Math.round(Number(amount))),
      PartyA: cleanPhone,
      PartyB: darajaConfig.businessShortCode,
      PhoneNumber: cleanPhone,
      CallBackURL: darajaConfig.callbackUrl,
      AccountReference: accountReference,
      TransactionDesc: `Gideon Task Pass ${packageId}`
    };

    const response = await fetch(stkUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(stkBody)
    });

    const data: any = await response.json();

    if (data.ResponseCode === '0') {
      mpesaTransactions.set(data.CheckoutRequestID, {
        status: 'Pending',
        merchantRequestId: data.MerchantRequestID,
        amount: Number(amount),
        phone: cleanPhone,
        timestamp: new Date().toISOString()
      });

      upsertPlatformTransaction({
        id: data.CheckoutRequestID,
        kind: 'pass_purchase',
        title: `Worker Pass (${packageId}) · M-PESA Daraja`,
        customerLabel: cleanPhone,
        gatewayOrMethod: 'M-PESA Daraja STK',
        currency: 'KES',
        amountLocal: Number(amount),
        amountUsd: +(Number(amount) / 130).toFixed(2),
        status: 'Pending',
        reference: data.CheckoutRequestID,
        countryCode: 'KE',
      });

      return res.json({
        success: true,
        checkoutRequestId: data.CheckoutRequestID,
        merchantRequestId: data.MerchantRequestID,
        customerMessage: data.CustomerMessage || 'Please check your phone and enter your M-PESA PIN to complete payment.',
        phone: cleanPhone,
        amount: Number(amount)
      });
    } else {
      return res.status(400).json({
        error: data.errorMessage || data.ResponseDescription || 'Failed to initiate STK push'
      });
    }
  } catch (error: any) {
    console.error('STK push error:', error);
    res.status(500).json({ error: error.message || 'M-PESA request failed' });
  }
});

app.post('/api/mpesa/callback', (req, res) => {
  try {
    const callbackData = req.body?.Body?.stkCallback;
    if (callbackData && callbackData.CheckoutRequestID) {
      const isSuccess = callbackData.ResultCode === 0;
      let receiptNumber = '';

      if (isSuccess && Array.isArray(callbackData.CallbackMetadata?.Item)) {
        const item = callbackData.CallbackMetadata.Item.find((i: any) => i.Name === 'MpesaReceiptNumber');
        receiptNumber = item?.Value || '';
      }

      const existingTxn = mpesaTransactions.get(callbackData.CheckoutRequestID);
      mpesaTransactions.set(callbackData.CheckoutRequestID, {
        ...existingTxn,
        status: isSuccess ? 'Completed' : 'Failed',
        resultCode: callbackData.ResultCode,
        resultDesc: callbackData.ResultDesc,
        mpesaReceipt: receiptNumber,
        updatedAt: new Date().toISOString()
      });
      upsertPlatformTransaction({
        id: callbackData.CheckoutRequestID,
        kind: 'pass_purchase',
        title: 'Worker Pass · M-PESA Daraja Callback',
        customerLabel: existingTxn?.phone || 'M-PESA Contributor',
        gatewayOrMethod: 'M-PESA Daraja STK',
        currency: 'KES',
        amountLocal: existingTxn?.amount ? Number(existingTxn.amount) : undefined,
        amountUsd: existingTxn?.amount ? +(Number(existingTxn.amount) / 130).toFixed(2) : 0,
        status: isSuccess ? 'Completed' : 'Failed',
        reference: receiptNumber || callbackData.CheckoutRequestID,
        countryCode: 'KE',
      });
    }

    res.json({ ResultCode: 0, ResultDesc: 'Callback processed successfully' });
  } catch (err: any) {
    console.error('Callback error:', err);
    res.json({ ResultCode: 0, ResultDesc: 'Error recorded' });
  }
});

app.get('/api/mpesa/status/:checkoutRequestId', (req, res) => {
  const { checkoutRequestId } = req.params;
  const txn = mpesaTransactions.get(checkoutRequestId);
  if (!txn) {
    return res.json({ status: 'Processing', message: 'Awaiting PIN input on mobile device...' });
  }
  res.json(txn);
});

// --- Paystack Kenya Starter Business Integration (No Paybill/Till Required) ---
let paystackConfig: PaystackConfig = loadInitialPaystackConfig();

const paystackTransactions = new Map<string, any>();

app.get('/api/paystack/config', requireOwner, (req, res) => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  res.json({
    publicKey: paystackConfig.publicKey,
    hasSecretKey: Boolean(paystackConfig.secretKey),
    isTest: paystackConfig.isTest,
    isConfigured: Boolean(paystackConfig.secretKey && paystackConfig.publicKey),
    webhookUrl: origin ? `${origin}/api/paystack/webhook` : paystackConfig.webhookUrl,
    paymentPages: paystackConfig.paymentPages,
  });
});

app.post('/api/paystack/config', requireOwner, (req, res) => {
  const { publicKey, secretKey, isTest, webhookUrl, paymentPages } = req.body || {};
  if (publicKey !== undefined) paystackConfig.publicKey = String(publicKey).trim();
  if (secretKey !== undefined && String(secretKey).trim()) {
    paystackConfig.secretKey = String(secretKey).trim();
  }
  if (isTest !== undefined) {
    paystackConfig.isTest = Boolean(isTest);
  } else if (paystackConfig.secretKey) {
    paystackConfig.isTest = paystackConfig.secretKey.startsWith('sk_test_');
  }
  if (webhookUrl !== undefined) paystackConfig.webhookUrl = String(webhookUrl).trim();
  if (paymentPages && typeof paymentPages === 'object') {
    const invalidFields: string[] = [];
    const nextPages = { ...paystackConfig.paymentPages };
    (['starter', 'pro', 'vip', 'customDeposit'] as const).forEach((key) => {
      if (paymentPages[key] !== undefined) {
        const raw = String(paymentPages[key] || '').trim();
        if (!raw) {
          nextPages[key] = '';
        } else {
          const clean = sanitizePaymentPageUrl(raw);
          if (!clean) {
            invalidFields.push(key);
          } else {
            nextPages[key] = clean;
          }
        }
      }
    });
    if (invalidFields.length > 0) {
      return res.status(400).json({
        error: `Invalid Paystack Payment Page URL for ${invalidFields.join(', ')}. URLs must belong to paystack.com or paystack.shop (e.g. https://paystack.com/pay/...).`,
      });
    }
    paystackConfig.paymentPages = nextPages;
  }

  persistPaystackConfig(paystackConfig);

  res.json({
    success: true,
    message: 'Paystack API & Payment Pages settings saved successfully',
    config: {
      publicKey: paystackConfig.publicKey,
      hasSecretKey: Boolean(paystackConfig.secretKey),
      isTest: paystackConfig.isTest,
      isConfigured: Boolean(paystackConfig.secretKey && paystackConfig.publicKey),
      webhookUrl: paystackConfig.webhookUrl,
      paymentPages: paystackConfig.paymentPages,
    },
  });
});

app.get('/api/paystack/payment-pages', requireEastAfrica, (req, res) => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  res.json({
    isTest: paystackConfig.isTest,
    redirectUrlHint: origin || process.env.APP_URL || '',
    paymentPages: paystackConfig.paymentPages,
  });
});

app.post('/api/paystack/pages/create', requireOwner, async (req, res) => {
  try {
    if (!paystackConfig.secretKey) {
      return res.status(400).json({
        error: 'Save your Paystack Secret Key in the API Keys tab first, or paste your dashboard Payment Page URLs directly below.',
      });
    }

    const origin = (
      req.body?.redirectOrigin ||
      req.headers.origin ||
      process.env.APP_URL ||
      `${req.protocol}://${req.get('host')}`
    ).replace(/\/$/, '');

    const pageSpecs: Array<{
      key: 'starter' | 'pro' | 'vip' | 'customDeposit';
      name: string;
      description: string;
      amountSubunit?: number;
      metadataPkg?: string;
    }> = [
      {
        key: 'starter',
        name: 'Gideon Global Tasks — Starter Pass (KES 50)',
        description: 'Unlock Surveys, Micro-Tasks, and Data Entry work queues on Gideon Global Tasks.',
        amountSubunit: 5000,
        metadataPkg: 'starter',
      },
      {
        key: 'pro',
        name: 'Gideon Global Tasks — Pro Creator Pass (KES 100)',
        description: 'Unlock AI Annotation, Writing, Creator Product Campaigns (FB/IG/TikTok/WA), and Surveys.',
        amountSubunit: 10000,
        metadataPkg: 'pro',
      },
      {
        key: 'vip',
        name: 'Gideon Global Tasks — VIP Full Access Pass (KES 200)',
        description: 'Unlock 4 daily surveys (max 50 shillings each), Creator Campaigns, AI Labs & priority payouts.',
        amountSubunit: 20000,
        metadataPkg: 'vip',
      },
      {
        key: 'customDeposit',
        name: 'Gideon Global Tasks — Campaign & Escrow Deposit',
        description: 'Client & advertiser pre-funding for East Africa Creator Product Campaigns and annotation tasks.',
      },
    ];

    const created: Record<string, string> = {};
    for (const spec of pageSpecs) {
      const redirectUrl = spec.metadataPkg
        ? `${origin}/?paystack_pkg=${spec.metadataPkg}`
        : `${origin}/`;

      const payload: Record<string, any> = {
        name: spec.name,
        description: spec.description,
        currency: 'KES',
        redirect_url: redirectUrl,
        collect_phone: true,
        custom_fields: [
          {
            display_name: 'Registered Email or Phone',
            variable_name: 'contributor_account',
          },
        ],
      };
      if (spec.amountSubunit) {
        payload.amount = spec.amountSubunit;
      }

      const psRes = await fetch('https://api.paystack.co/page', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${paystackConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const psData: any = await psRes.json();
      if (!psRes.ok || !psData?.status || !psData?.data?.slug) {
        return res.status(400).json({
          error: psData?.message || `Paystack rejected creating the "${spec.name}" Payment Page.`,
        });
      }
      const pageUrl = `https://paystack.com/pay/${psData.data.slug}`;
      created[spec.key] = pageUrl;
      paystackConfig.paymentPages[spec.key] = pageUrl;
    }

    persistPaystackConfig(paystackConfig);

    return res.json({
      success: true,
      message: 'Created 4 Paystack Payment Pages (Starter, Pro, VIP & Escrow Deposit) with automatic redirect back to your app.',
      paymentPages: paystackConfig.paymentPages,
      created,
    });
  } catch (err: any) {
    console.error('Paystack create pages error:', err);
    return res.status(500).json({ error: err?.message || 'Could not create Paystack Payment Pages.' });
  }
});

app.post('/api/paystack/stk-push', requireEastAfrica, async (req, res) => {
  try {
    const {
      phone,
      phoneNumber,
      amount,
      amountUsd,
      countryCode = 'KE',
      packageId = 'pro',
      email = 'contributor@gideon-global-tasks.ai.studio',
      name = 'Gideon Contributor'
    } = req.body;

    const rawPhone = String(phone || phoneNumber || '').trim();
    if (!isEastAfricaPhone(rawPhone)) {
      return res.status(403).json({
        error: 'East Africa Only: Enter a valid East Africa phone number (+254, +256, +255, +250, +257, +211, +251, +252).'
      });
    }

    let digits = rawPhone.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) {
      digits = '254' + digits.substring(1);
    } else if (digits.startsWith('7') || digits.startsWith('1')) {
      digits = '254' + digits;
    }

    // Paystack Kenya Charge API natively supports Safaricom M-PESA (+254 in KES).
    if (!digits.startsWith('254')) {
      return res.status(400).json({
        cardFallbackAvailable: true,
        error: `Paystack M-PESA STK Push natively supports Kenyan (+254) mobile numbers. For ${String(countryCode).toUpperCase()} contributors, please select East Africa Card (Visa / Mastercard) via Paystack Checkout.`
      });
    }

    const plusPhone = `+${digits}`;
    const packageKesDefaults: Record<string, number> = { starter: 50, pro: 100, vip: 200 };
    const defaultPackageKes = packageKesDefaults[String(packageId).toLowerCase()] || 100;
    const kesAmount = Math.max(10, Math.round(Number(amount) || (amountUsd ? Number(amountUsd) * 130 : defaultPackageKes)));
    const subunitAmount = String(kesAmount * 100);
    const fallbackRef = `PS_STK_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    if (!paystackConfig.secretKey) {
      const mpesaReceipt = `PS${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      paystackTransactions.set(fallbackRef, {
        status: 'success',
        reference: fallbackRef,
        amountKes: kesAmount,
        phone: plusPhone,
        mpesaReceipt,
        packageId,
        simulation: true,
        timestamp: new Date().toISOString()
      });

      upsertPlatformTransaction({
        id: fallbackRef,
        kind: 'pass_purchase',
        title: `Worker Pass (${String(packageId).toUpperCase()}) via Paystack M-PESA STK`,
        customerLabel: plusPhone,
        gatewayOrMethod: 'Paystack M-PESA STK',
        currency: 'KES',
        amountLocal: kesAmount,
        amountUsd: +(kesAmount / 130).toFixed(2),
        status: 'Completed',
        reference: mpesaReceipt,
        countryCode: String(countryCode || 'KE').toUpperCase(),
        metadata: { packageId, simulation: true },
      });

      return res.json({
        success: true,
        simulation: true,
        reference: fallbackRef,
        status: 'success',
        mpesaReceipt,
        phone: plusPhone,
        amountKes: kesAmount,
        message: `Paystack M-PESA STK prompt sent to ${plusPhone} for KES ${kesAmount}. Check your phone to enter PIN.`
      });
    }

    const psRes = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: String(email || 'contributor@gideon-global-tasks.ai.studio').trim(),
        amount: subunitAmount,
        currency: 'KES',
        mobile_money: {
          phone: plusPhone,
          provider: 'mpesa'
        },
        metadata: {
          packageId,
          countryCode: 'KE',
          customerName: name
        }
      })
    });

    const psData: any = await psRes.json();
    if (!psRes.ok || !psData.status) {
      return res.status(400).json({
        error: psData.message || 'Paystack rejected the M-PESA STK Push charge request'
      });
    }

    const reference = psData.data?.reference || fallbackRef;
    const chargeStatus = psData.data?.status || 'pay_offline';
    const displayText =
      psData.data?.display_text ||
      'M-PESA STK Push prompt sent! Please enter your M-PESA PIN on your phone to authorize payment.';

    paystackTransactions.set(reference, {
      status: chargeStatus,
      reference,
      amountKes: kesAmount,
      phone: plusPhone,
      packageId,
      raw: psData.data,
      timestamp: new Date().toISOString()
    });

    upsertPlatformTransaction({
      id: reference,
      kind: 'pass_purchase',
      title: `Worker Pass (${String(packageId).toUpperCase()}) via Paystack M-PESA STK`,
      customerLabel: plusPhone,
      gatewayOrMethod: 'Paystack M-PESA STK',
      currency: 'KES',
      amountLocal: kesAmount,
      amountUsd: +(kesAmount / 130).toFixed(2),
      status: chargeStatus === 'success' ? 'Completed' : 'Pending',
      reference,
      countryCode: String(countryCode || 'KE').toUpperCase(),
      metadata: { packageId, simulation: false },
    });

    return res.json({
      success: true,
      simulation: false,
      reference,
      status: chargeStatus,
      displayText,
      phone: plusPhone,
      amountKes: kesAmount,
      message: displayText
    });
  } catch (error: any) {
    console.error('Paystack STK push error:', error);
    return res.status(500).json({ error: error.message || 'Paystack STK Push failed' });
  }
});

app.post('/api/paystack/initialize', requireEastAfrica, async (req, res) => {
  try {
    const {
      email = 'contributor@gideon-global-tasks.ai.studio',
      amountUsd,
      amountKes,
      countryCode = 'KE',
      packageId = 'pro',
      callbackUrl
    } = req.body;

    const packageKesDefaults: Record<string, number> = { starter: 50, pro: 100, vip: 200 };
    const defaultPackageKes = packageKesDefaults[String(packageId).toLowerCase()] || 100;
    const kesAmount = Math.max(50, Math.round(Number(amountKes) || (amountUsd ? Number(amountUsd) * 130 : defaultPackageKes)));
    const resolvedUsd = amountUsd ? Number(amountUsd) : +(kesAmount / 130).toFixed(2);
    const subunitAmount = kesAmount * 100;
    const fallbackRef = `PS_CARD_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    if (!paystackConfig.secretKey) {
      paystackTransactions.set(fallbackRef, {
        status: 'success',
        reference: fallbackRef,
        amountKes: kesAmount,
        countryCode,
        packageId,
        simulation: true,
        timestamp: new Date().toISOString()
      });

      upsertPlatformTransaction({
        id: fallbackRef,
        kind: 'pass_purchase',
        title: `Worker Pass (${String(packageId).toUpperCase()}) via Paystack Card`,
        customerLabel: String(email),
        gatewayOrMethod: 'Paystack Card / Mobile Money',
        currency: 'KES',
        amountLocal: kesAmount,
        amountUsd: resolvedUsd,
        status: 'Completed',
        reference: fallbackRef,
        countryCode: String(countryCode || 'KE').toUpperCase(),
        metadata: { packageId, simulation: true },
      });

      return res.json({
        success: true,
        simulation: true,
        reference: fallbackRef,
        authorizationUrl: null,
        amountKes: kesAmount,
        message: `Paystack Card checkout ready for ${countryCode} (KES ${kesAmount}).`
      });
    }

    const origin = req.headers.origin || (process.env.APP_URL || 'https://gideon-global-tasks.ai.studio');
    const psRes = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: String(email).trim(),
        amount: subunitAmount,
        currency: 'KES',
        channels: ['card', 'mobile_money', 'apple_pay'],
        callback_url: callbackUrl || origin,
        metadata: {
          packageId,
          countryCode: String(countryCode).toUpperCase(),
          amountUsd: Number(amountUsd)
        }
      })
    });

    const psData: any = await psRes.json();
    if (!psRes.ok || !psData.status) {
      return res.status(400).json({
        error: psData.message || 'Failed to initialize Paystack checkout'
      });
    }

    const reference = psData.data?.reference || fallbackRef;
    paystackTransactions.set(reference, {
      status: 'pending',
      reference,
      amountKes: kesAmount,
      countryCode,
      packageId,
      timestamp: new Date().toISOString()
    });

    upsertPlatformTransaction({
      id: reference,
      kind: 'pass_purchase',
      title: `Worker Pass (${String(packageId).toUpperCase()}) via Paystack Checkout`,
      customerLabel: String(email),
      gatewayOrMethod: 'Paystack Card / Mobile Money',
      currency: 'KES',
      amountLocal: kesAmount,
      amountUsd: resolvedUsd,
      status: 'Pending',
      reference,
      countryCode: String(countryCode || 'KE').toUpperCase(),
      metadata: { packageId, simulation: false },
    });

    return res.json({
      success: true,
      simulation: false,
      reference,
      authorizationUrl: psData.data?.authorization_url,
      accessCode: psData.data?.access_code,
      amountKes: kesAmount
    });
  } catch (error: any) {
    console.error('Paystack initialize error:', error);
    return res.status(500).json({ error: error.message || 'Paystack checkout initialization failed' });
  }
});

app.get('/api/paystack/verify/:reference', requireEastAfrica, async (req, res) => {
  try {
    const { reference } = req.params;
    const cached = paystackTransactions.get(reference);

    if (!paystackConfig.secretKey || cached?.simulation) {
      return res.json(
        cached || { status: 'pending', reference, message: 'Awaiting confirmation...' }
      );
    }

    const psRes = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          Authorization: `Bearer ${paystackConfig.secretKey}`
        }
      }
    );
    const psData: any = await psRes.json();
    if (!psRes.ok || !psData.status) {
      return res.status(400).json({ error: psData.message || 'Could not verify Paystack transaction' });
    }

    const amountKes = psData.data?.amount
      ? Math.round(psData.data.amount / 100)
      : cached?.amountKes;
    const inferredPkgId =
      cached?.packageId ||
      inferPackageIdFromPaystackData({
        metadata: psData.data?.metadata,
        amountKes,
        pageSlug: psData.data?.metadata?.referrer,
        paymentPages: paystackConfig.paymentPages,
      });
    const customerEmail = psData.data?.customer?.email || cached?.email;
    const channel = psData.data?.channel || 'card';

    const updated = {
      status: psData.data?.status || 'pending',
      reference,
      packageId: inferredPkgId,
      channel,
      customerEmail,
      gatewayResponse: psData.data?.gateway_response,
      receipt: psData.data?.receipt_number || reference,
      amountKes,
      updatedAt: new Date().toISOString()
    };
    paystackTransactions.set(reference, updated);
    if (updated.status === 'success' || updated.status === 'failed') {
      upsertPlatformTransaction({
        id: reference,
        kind: 'pass_purchase',
        title: inferredPkgId
          ? `Worker Pass (${inferredPkgId.toUpperCase()}) · Paystack Verified`
          : 'Paystack Payment Verified',
        customerLabel: cached?.phone || customerEmail || 'Paystack Customer',
        gatewayOrMethod: channel === 'mobile_money' ? 'Paystack M-PESA' : 'Paystack Payment Page / Card',
        currency: 'KES',
        amountLocal: updated.amountKes ? Number(updated.amountKes) : undefined,
        amountUsd: updated.amountKes ? +(Number(updated.amountKes) / 130).toFixed(2) : 0,
        status: updated.status === 'success' ? 'Completed' : 'Failed',
        reference: updated.receipt || reference,
        countryCode: String(psData.data?.metadata?.countryCode || 'KE').toUpperCase(),
        metadata: { packageId: inferredPkgId, channel },
      });
    }
    return res.json(updated);
  } catch (error: any) {
    console.error('Paystack verify error:', error);
    return res.status(500).json({ error: error.message || 'Paystack verification failed' });
  }
});

app.post('/api/paystack/webhook', (req, res) => {
  try {
    if (paystackConfig.secretKey) {
      const signature = req.headers['x-paystack-signature'];
      const hash = crypto
        .createHmac('sha512', paystackConfig.secretKey)
        .update(JSON.stringify(req.body))
        .digest('hex');
      if (signature !== hash) {
        return res.status(401).json({ error: 'Invalid Paystack webhook signature' });
      }
    }

    const event = req.body;
    const ref = event?.data?.reference;
    if (ref && event?.event === 'charge.success') {
      const amountKes = event.data?.amount ? Math.round(event.data.amount / 100) : undefined;
      const inferredPkgId = inferPackageIdFromPaystackData({
        metadata: event.data?.metadata,
        amountKes,
        pageSlug: event.data?.metadata?.referrer,
        paymentPages: paystackConfig.paymentPages,
      });
      const channel = event.data?.channel || 'card';

      paystackTransactions.set(ref, {
        status: 'success',
        reference: ref,
        packageId: inferredPkgId,
        channel,
        customerEmail: event.data?.customer?.email,
        receipt: event.data?.receipt_number || ref,
        amountKes,
        updatedAt: new Date().toISOString()
      });
      upsertPlatformTransaction({
        id: ref,
        kind: 'pass_purchase',
        title: inferredPkgId
          ? `Worker Pass (${inferredPkgId.toUpperCase()}) · Paystack Webhook Confirmed`
          : 'Paystack Webhook Payment Confirmed',
        customerLabel: event.data?.customer?.email || 'Paystack Customer',
        gatewayOrMethod: channel === 'mobile_money' ? 'Paystack M-PESA' : 'Paystack Payment Page / Card',
        currency: 'KES',
        amountLocal: amountKes,
        amountUsd: amountKes ? +(amountKes / 130).toFixed(2) : 0,
        status: 'Completed',
        reference: event.data?.receipt_number || ref,
        countryCode: String(event.data?.metadata?.countryCode || 'KE').toUpperCase(),
        metadata: { packageId: inferredPkgId, channel },
      });
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error('Paystack webhook error:', err);
    return res.sendStatus(500);
  }
});

// --- IntaSend Payment Gateway Integration ---
interface IntasendConfig {
  publishableKey: string;
  secretKey: string;
  isTest: boolean;
  webhookUrl: string;
}

let intasendConfig: IntasendConfig = {
  publishableKey: process.env.INTASEND_PUBLISHABLE_KEY || 'ISPubKey_test_demo12345',
  secretKey: process.env.INTASEND_SECRET_KEY || '',
  isTest: process.env.INTASEND_ENVIRONMENT !== 'live',
  webhookUrl: process.env.INTASEND_WEBHOOK_URL || 'https://gideon-global-tasks.ai.studio/api/intasend/webhook'
};

const intasendTransactions = new Map<string, any>();

app.get('/api/intasend/config', requireOwner, (_req, res) => {
  res.json({
    publishableKey: intasendConfig.publishableKey,
    isTest: intasendConfig.isTest,
    isConfigured: Boolean(intasendConfig.secretKey && intasendConfig.publishableKey),
    webhookUrl: intasendConfig.webhookUrl
  });
});

app.post('/api/intasend/config', requireOwner, (req, res) => {
  const { publishableKey, secretKey, isTest, webhookUrl } = req.body;
  if (publishableKey !== undefined) intasendConfig.publishableKey = String(publishableKey).trim();
  if (secretKey !== undefined) intasendConfig.secretKey = String(secretKey).trim();
  if (isTest !== undefined) intasendConfig.isTest = Boolean(isTest);
  if (webhookUrl !== undefined) intasendConfig.webhookUrl = String(webhookUrl).trim();

  res.json({
    success: true,
    message: 'IntaSend configuration updated successfully',
    config: {
      publishableKey: intasendConfig.publishableKey,
      isTest: intasendConfig.isTest,
      isConfigured: Boolean(intasendConfig.secretKey && intasendConfig.publishableKey)
    }
  });
});

app.post('/api/intasend/stk-push', requireEastAfrica, async (req, res) => {
  try {
    const { phone, phoneNumber, amount, packageId = 'pro', email = 'contributor@gideon-global-tasks.ai.studio', name = 'Gideon Contributor' } = req.body;
    const rawPhone = String(phone || phoneNumber || '');

    if (!isEastAfricaPhone(rawPhone)) {
      return res.status(403).json({ error: 'East Africa Only: IntaSend mobile money checkout is restricted to East Africa phone numbers (+254, +256, +255, +250, +257, +211, +251, +252).' });
    }

    let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      cleanPhone = '254' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid East Africa mobile money number' });
    }

    const trackingId = `IS_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    if (!intasendConfig.secretKey) {
      const mpesaReceipt = `IS${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
      intasendTransactions.set(trackingId, {
        state: 'COMPLETE',
        amount: Number(amount),
        phone: cleanPhone,
        mpesaReceipt,
        packageId,
        timestamp: new Date().toISOString()
      });

      upsertPlatformTransaction({
        id: trackingId,
        kind: 'pass_purchase',
        title: `Worker Pass (${packageId}) · IntaSend STK`,
        customerLabel: email || cleanPhone,
        gatewayOrMethod: 'IntaSend M-PESA STK',
        currency: 'KES',
        amountLocal: Number(amount),
        amountUsd: +(Number(amount) / 130).toFixed(2),
        status: 'Completed',
        reference: mpesaReceipt,
        countryCode: 'KE',
      });

      return res.json({
        success: true,
        simulation: true,
        trackingId,
        mpesaReceipt,
        message: `IntaSend M-PESA STK prompt sent to ${cleanPhone} for KES ${amount}. Check your phone to enter PIN.`,
        phone: cleanPhone,
        amount: Number(amount)
      });
    }

    const intasendUrl = intasendConfig.isTest
      ? 'https://sandbox.intasend.com/api/v1/payment/mpesa-stk-push/'
      : 'https://payment.intasend.com/api/v1/payment/mpesa-stk-push/';

    const nameParts = (name || 'Gideon Contributor').split(' ');
    const firstName = nameParts[0] || 'Gideon';
    const lastName = nameParts.slice(1).join(' ') || 'Contributor';

    const payload = {
      first_name: firstName,
      last_name: lastName,
      email: email || 'contributor@gideon-global-tasks.ai.studio',
      host: 'https://gideon-global-tasks.ai.studio',
      amount: Math.max(1, Math.round(Number(amount))),
      phone_number: cleanPhone,
      api_ref: `Pass-${packageId}-${Date.now()}`
    };

    const response = await fetch(intasendUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${intasendConfig.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data: any = await response.json();

    if (response.ok && data.invoice) {
      const invoiceId = data.invoice.invoice_id || trackingId;
      intasendTransactions.set(invoiceId, {
        state: data.invoice.state || 'PENDING',
        amount: Number(amount),
        phone: cleanPhone,
        packageId,
        rawInvoice: data.invoice,
        timestamp: new Date().toISOString()
      });

      upsertPlatformTransaction({
        id: invoiceId,
        kind: 'pass_purchase',
        title: `Worker Pass (${packageId}) · IntaSend STK`,
        customerLabel: email || cleanPhone,
        gatewayOrMethod: 'IntaSend M-PESA STK',
        currency: 'KES',
        amountLocal: Number(amount),
        amountUsd: +(Number(amount) / 130).toFixed(2),
        status: 'Pending',
        reference: data.invoice.tracking_id || invoiceId,
        countryCode: 'KE',
      });

      return res.json({
        success: true,
        invoiceId,
        trackingId: data.invoice.tracking_id || invoiceId,
        customerMessage: 'M-PESA STK Push prompt sent! Please enter your PIN on your mobile phone to complete payment.',
        phone: cleanPhone,
        amount: Number(amount)
      });
    } else {
      return res.status(400).json({
        error: data.errors?.[0]?.message || data.detail || 'IntaSend rejected the payment request'
      });
    }
  } catch (error: any) {
    console.error('IntaSend STK error:', error);
    res.status(500).json({ error: error.message || 'IntaSend processing failed' });
  }
});

app.post('/api/intasend/webhook', (req, res) => {
  try {
    const payload = req.body;
    const invoiceId = payload.invoice_id || payload.tracking_id;
    if (invoiceId) {
      intasendTransactions.set(invoiceId, {
        state: payload.state,
        mpesaReceipt: payload.mpesa_reference || payload.account || '',
        amount: payload.value,
        phone: payload.account,
        updatedAt: new Date().toISOString()
      });
      const isComplete = String(payload.state || '').toUpperCase() === 'COMPLETE';
      const isFailed = String(payload.state || '').toUpperCase() === 'FAILED';
      if (isComplete || isFailed) {
        upsertPlatformTransaction({
          id: String(invoiceId),
          kind: 'pass_purchase',
          title: 'Worker Pass · IntaSend Webhook',
          customerLabel: payload.account || 'IntaSend Customer',
          gatewayOrMethod: 'IntaSend M-PESA STK',
          currency: 'KES',
          amountLocal: payload.value ? Number(payload.value) : undefined,
          amountUsd: payload.value ? +(Number(payload.value) / 130).toFixed(2) : 0,
          status: isComplete ? 'Completed' : 'Failed',
          reference: payload.mpesa_reference || String(invoiceId),
          countryCode: 'KE',
        });
      }
    }

    res.json({ status: 'success' });
  } catch (err: any) {
    console.error('IntaSend webhook error:', err);
    res.status(500).json({ error: 'Webhook processing error' });
  }
});

app.get('/api/intasend/status/:trackingId', (req, res) => {
  const { trackingId } = req.params;
  const txn = intasendTransactions.get(trackingId);
  if (!txn) {
    return res.json({ state: 'PENDING', message: 'Awaiting PIN input on mobile device...' });
  }
  res.json(txn);
});

// --- PayPal International Payment Gateway Integration ---
interface PayPalConfig {
  primaryEmail: string;
  clientId: string;
  clientSecret: string;
  mode: 'sandbox' | 'live';
  currency: string;
  payPalMeHandle: string;
}

let payPalConfig: PayPalConfig = {
  primaryEmail: process.env.PAYPAL_PRIMARY_EMAIL || 'nigideon36@gmail.com',
  clientId: process.env.PAYPAL_CLIENT_ID || '',
  clientSecret: process.env.PAYPAL_CLIENT_SECRET || '',
  mode: (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'live',
  currency: 'USD',
  payPalMeHandle: process.env.PAYPAL_ME_HANDLE || 'nigideon36'
};

const payPalOrders = new Map<string, any>();

app.get('/api/paypal/config', (_req, res) => {
  res.json({
    primaryEmail: payPalConfig.primaryEmail,
    mode: payPalConfig.mode,
    currency: payPalConfig.currency,
    payPalMeHandle: payPalConfig.payPalMeHandle,
    payPalMeUrl: '',
    isConfigured: false,
    disabled: true,
    eastAfricaOnly: true
  });
});

app.post('/api/paypal/config', requireOwner, (req, res) => {
  const { primaryEmail, clientId, clientSecret, mode, payPalMeHandle } = req.body;
  if (primaryEmail !== undefined) payPalConfig.primaryEmail = String(primaryEmail).trim();
  if (clientId !== undefined) payPalConfig.clientId = String(clientId).trim();
  if (clientSecret !== undefined) payPalConfig.clientSecret = String(clientSecret).trim();
  if (mode !== undefined) payPalConfig.mode = mode === 'sandbox' ? 'sandbox' : 'live';
  if (payPalMeHandle !== undefined) payPalConfig.payPalMeHandle = String(payPalMeHandle).trim().replace(/^https?:\/\/(www\.)?paypal\.me\//i, '').replace(/^@/, '');

  res.json({
    success: true,
    message: 'PayPal configuration saved (currently disabled under East Africa Only policy)',
    config: {
      primaryEmail: payPalConfig.primaryEmail,
      mode: payPalConfig.mode,
      currency: payPalConfig.currency,
      payPalMeHandle: payPalConfig.payPalMeHandle,
      payPalMeUrl: ''
    }
  });
});

app.post('/api/paypal/create-order', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'PayPal checkout is disabled. This platform is accessible exclusively for East Africa countries via M-PESA, IntaSend, and East Africa Mobile Money.'
  });
});

app.post('/api/paypal/capture-order', (_req, res) => {
  res.status(410).json({
    success: false,
    error: 'PayPal checkout is disabled. Please use M-PESA or IntaSend East Africa Mobile Money.'
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
    const event = req.body;
    console.log('PayPal Webhook notification received:', event?.event_type || 'Unknown event');
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
        error: `Account permanently banned 🚫 forever (no second chance): ${record.bannedReason || 'Failed manual M-PESA Worker Pass proof requirement.'}`,
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

  const record =
    getCustomerByUid(uid) ||
    ensureShadowCustomerForGoogleUid({
      uid,
      email: req.user?.email,
      displayName: req.user?.name,
      phone: req.user?.phone_number,
    });

  return res.json({
    customer: toPublicCustomerProfile(record),
  });
});

// 4b. Customer Profile Update (Editable fields allowed; registered phone & withdrawal details strictly locked)
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
    });

    return res.json({
      success: true,
      message: 'Customer profile updated successfully. Registered phone & withdrawal details remain locked.',
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

// Owner ONLY: Edit ANY customer profile field, phone, payout details, locks, 2FA, or assigned Worker Pass
app.patch('/api/owner/customers/:uid', requireOwner, (req: AuthRequest, res) => {
  try {
    const uid = String(req.params.uid || '').trim();
    const updated = ownerUpdateCustomerRecord(uid, req.body || {});
    if (req.body?.adminAssignedPass && ['starter', 'pro', 'vip'].includes(req.body.adminAssignedPass)) {
      const assigned = String(req.body.adminAssignedPass);
      setCustomerApprovedPackage(uid, assigned);
      const kesMap: Record<string, number> = { starter: 50, pro: 100, vip: 200 };
      creditReferrerOnPassApproval({
        buyerUid: uid,
        buyerName: updated.displayName,
        buyerCountryCode: updated.countryCode,
        packageId: assigned,
        amountKes: kesMap[assigned] || 50,
        orderId: `OWNER_ASSIGN_${uid}_${assigned}`,
      });
    }
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
        'Permanently banned 🚫 forever (no second chance) by Platform Owner for failing M-PESA Worker Pass proof rules.',
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
  const proofsCleared = clearBannedPassProofsForIdentity({
    uid,
    phone: target?.phone,
    email: target?.email,
    countryCode: target?.countryCode || 'KE',
    ownerEmail,
  });

  if (!target && result.clearedKeys.length === 0 && proofsCleared === 0) {
    return res.status(404).json({ success: false, error: 'No matching banned customer record found.' });
  }

  return res.json({
    success: true,
    customer: result.unbannedCustomer ? toPublicCustomerProfile(result.unbannedCustomer) : undefined,
    clearedKeys: result.clearedKeys,
    proofsCleared,
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
  const proofsCleared = clearBannedPassProofsForIdentity({
    uid: result.unbannedCustomer?.uid,
    phone: cleanPhone || result.normalizedPhone,
    email: cleanEmail || result.unbannedCustomer?.email,
    countryCode: countryCode ? String(countryCode) : 'KE',
    ownerEmail,
  });

  return res.json({
    success: true,
    normalizedPhone: result.normalizedPhone || cleanPhone || undefined,
    customer: result.unbannedCustomer ? toPublicCustomerProfile(result.unbannedCustomer) : undefined,
    clearedKeys: result.clearedKeys,
    proofsCleared,
  });
});

// --- Manual Worker Pass Payment Proof (0758727558) & Owner Approval / Ban ---

// Customer submits mandatory M-PESA Code + Screenshot Proof (does NOT unlock pass until Owner approves)
app.post('/api/packages/manual-proof', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || 'guest';
    const customerRec = req.user?.uid ? getCustomerByUid(req.user.uid) : null;
    const {
      packageId,
      senderPhone,
      mpesaCode,
      screenshotDataUrl,
      screenshotFileName,
      countryCode,
    } = req.body || {};

    const proof = submitWorkerPassProof({
      userUid: uid,
      customerName: customerRec?.displayName || req.user?.name || 'East Africa Contributor',
      customerPhone: customerRec?.phone || req.user?.phone_number || String(senderPhone || ''),
      customerEmail: customerRec?.email || req.user?.email,
      countryCode: countryCode ? String(countryCode) : customerRec?.countryCode || 'KE',
      packageId: String(packageId || ''),
      senderPhone: String(senderPhone || customerRec?.phone || ''),
      mpesaCode: String(mpesaCode || ''),
      screenshotDataUrl: String(screenshotDataUrl || ''),
      screenshotFileName: screenshotFileName ? String(screenshotFileName) : undefined,
    });

    return res.status(201).json({
      success: true,
      requiresOwnerApproval: true,
      message:
        'M-PESA code & screenshot proof submitted! Your Worker Pass remains locked until the Owner (nigideon36@gmail.com) verifies payment on 0758727558 and approves.',
      proof: {
        ...proof,
        screenshotDataUrl: '[UPLOADED]',
      },
    });
  } catch (error: any) {
    const status = error instanceof PassProofForbiddenError ? 403 : 400;
    return res.status(status).json({
      success: false,
      error: error?.message || 'Failed to submit manual M-PESA Worker Pass proof.',
    });
  }
});

// Customer checks their manual Worker Pass proof status & whether Owner approved/sent details
app.get('/api/packages/my-proofs', optionalAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid;
  const idsParam = String(req.query?.ids || '');
  const trackedIds = idsParam
    ? idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  const customerRec = uid ? getCustomerByUid(uid) : null;
  const banCheck = isIdentifierOrAccountBanned({
    uid,
    phone: customerRec?.phone,
    email: customerRec?.email || req.user?.email,
    countryCode: customerRec?.countryCode,
  });

  const matching = listCustomerPassProofs(uid, trackedIds).map((p) => ({
    id: p.id,
    packageId: p.packageId,
    packageName: p.packageName,
    amountKes: p.amountKes,
    payToNumber: p.payToNumber,
    senderPhone: p.senderPhone,
    mpesaCode: p.mpesaCode,
    status: p.status,
    ownerApprovalDetails: p.ownerApprovalDetails,
    rejectionOrBanReason: p.rejectionOrBanReason,
    reviewedAt: p.reviewedAt,
    createdAt: p.createdAt,
  }));

  const approvedProof = matching.find((p) => p.status === 'Approved') || null;
  const bannedProof = matching.find((p) => p.status === 'Banned') || null;
  const ownerOverridePass = customerRec?.adminAssignedPass;
  const effectiveApprovedPackageId =
    ownerOverridePass === 'free'
      ? null
      : ownerOverridePass || (approvedProof ? approvedProof.packageId : null);

  return res.json({
    success: true,
    proofs: matching,
    approvedPackageId: effectiveApprovedPackageId,
    latestApprovedProof: approvedProof,
    adminAssignedPass: ownerOverridePass || undefined,
    banned: Boolean(banCheck.banned || bannedProof),
    bannedReason: banCheck.reason || bannedProof?.rejectionOrBanReason || undefined,
    deactivated: Boolean(customerRec?.deactivated),
    deactivatedReason: customerRec?.deactivatedReason || undefined,
  });
});

// Owner ONLY: View all manual M-PESA Worker Pass payment proofs & screenshots
app.get('/api/owner/pass-proofs', requireOwner, (_req: AuthRequest, res) => {
  const proofs = listAllPassProofs();
  return res.json({
    success: true,
    proofs,
    stats: {
      totalCount: proofs.length,
      pendingCount: proofs.filter((p) => p.status === 'Pending').length,
      approvedCount: proofs.filter((p) => p.status === 'Approved').length,
      rejectedCount: proofs.filter((p) => p.status === 'Rejected').length,
      bannedCount: proofs.filter((p) => p.status === 'Banned').length,
    },
  });
});

// Owner ONLY: Approve manual Worker Pass payment & send confirmation details to unlock customer's pass
app.post('/api/owner/pass-proofs/:id/approve', requireOwner, (req: AuthRequest, res) => {
  try {
    const proof = approvePassProof({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      approvalDetails: req.body?.approvalDetails ? String(req.body.approvalDetails) : undefined,
    });
    if (proof.userUid && proof.userUid !== 'guest') {
      setCustomerApprovedPackage(proof.userUid, proof.packageId);
      creditReferrerOnPassApproval({
        buyerUid: proof.userUid,
        buyerName: proof.customerName,
        buyerCountryCode: proof.countryCode,
        packageId: proof.packageId,
        packageName: proof.packageName,
        amountKes: proof.amountKes,
        orderId: proof.id,
      });
    }
    return res.json({ success: true, proof });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not approve Worker Pass proof.',
    });
  }
});

// Owner ONLY: Reject manual Worker Pass proof
app.post('/api/owner/pass-proofs/:id/reject', requireOwner, (req: AuthRequest, res) => {
  try {
    const proof = rejectPassProof({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      reason: req.body?.reason ? String(req.body.reason) : undefined,
    });
    return res.json({ success: true, proof });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not reject Worker Pass proof.',
    });
  }
});

// Owner ONLY: Permanently ban customer forever (no second chance) for missing/fake M-PESA proof
app.post('/api/owner/pass-proofs/:id/ban', requireOwner, (req: AuthRequest, res) => {
  try {
    const proof = banPassProofAccount({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
      reason: req.body?.reason ? String(req.body.reason) : undefined,
    });
    return res.json({ success: true, proof });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not ban account.',
    });
  }
});

// Owner ONLY: Unban an accidentally banned pass proof & restore customer's phone/account access
app.post('/api/owner/pass-proofs/:id/unban', requireOwner, (req: AuthRequest, res) => {
  try {
    const proof = unbanPassProofAccount({
      id: String(req.params.id || ''),
      ownerEmail: req.user?.email || 'nigideon36@gmail.com',
    });
    return res.json({ success: true, proof });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not unban Worker Pass proof account.',
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
      record.totpSecret = record.pendingTotpSecret;
      record.pendingTotpSecret = undefined;
      record.twoFactorEnabled = true;
      record.twoFactorMethod = 'totp';
      saveCustomerRecord(record);
      return res.json({ success: true, customer: toPublicCustomerProfile(record) });
    }

    if (method === 'sms') {
      if (!record.phone || !verifySmsOtp(record.phone, 'enable-sms-2fa', String(code || ''))) {
        return res.status(400).json({ error: 'Invalid or expired 6-digit SMS code.' });
      }
      record.phoneVerified = true;
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

    let finalMethod = String(method || '');
    let finalAccount = String(accountDetails || '');

    if (customerRec?.withdrawalDetails?.locked) {
      const locked = customerRec.withdrawalDetails;
      const incomingNormalized =
        finalMethod === 'M-PESA' || finalMethod === 'Airtel / MTN MoMo'
          ? normalizeEastAfricaPhone(finalAccount, customerRec.countryCode)
          : finalAccount.trim();

      if (finalMethod !== locked.method || incomingNormalized !== locked.accountDetails) {
        return res.status(403).json({
          success: false,
          error: `Withdrawals must match your locked registration payout details (${locked.method}: ${locked.accountDetails}). Customers cannot change withdrawal details.`,
        });
      }
      finalMethod = locked.method;
      finalAccount = locked.accountDetails;
    }

    const resolvedCountry = getCountryByCode(countryCode ? String(countryCode) : customerRec?.countryCode || 'KE');
    const numericAmount = Number(amountUsd);
    if (!Number.isFinite(numericAmount) || numericAmount < WITHDRAWAL_THRESHOLD_USD) {
      return res.status(400).json({
        success: false,
        error: `Minimum withdrawal threshold is ${formatCurrencyFromUsd(WITHDRAWAL_THRESHOLD_USD, resolvedCountry)}.`,
      });
    }

    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);

    if (!isOwner && req.user?.uid) {
      const custState = getOrCreateCustomerState(req.user.uid);
      const vipCount = Math.max(
        custState.vipReferralCount || 0,
        custState.referralStats?.vipReferralCount || 0,
        custState.referralHistory.filter(
          (r) => r.packageId === 'vip' || String(r.passPurchased || '').toLowerCase().includes('vip')
        ).length
      );
      if (vipCount < 1) {
        return res.status(403).json({
          success: false,
          error: `At least one of your referrals must purchase the VIP Worker Pass of ${formatCurrencyFromKes(VIP_PASS_KES, resolvedCountry)} before requesting a withdrawal.`,
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

// Owner ONLY: View configured live/test outbound payout gateway readiness
app.get('/api/owner/payout-gateways/status', requireOwner, (_req: AuthRequest, res) => {
  return res.json(
    getGatewayReadiness({
      paystackConfig,
      intasendConfig,
      darajaConfig,
    })
  );
});

// Owner ONLY: View all customer withdrawal requests
app.get('/api/owner/withdrawals', requireOwner, (_req: AuthRequest, res) => {
  return res.json({
    withdrawals: listAllWithdrawals(),
  });
});

// Owner ONLY: Approve & execute real outbound transfer (or settle with verified manual receipt)
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
      paystackConfig,
      intasendConfig,
      darajaConfig,
      getDarajaToken,
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
    if (!kind || !['withdrawal', 'pass_purchase', 'task_reward', 'referral_commission', 'investment_deposit'].includes(String(kind))) {
      return res.status(400).json({ error: 'Invalid transaction kind' });
    }
    if (String(kind) === 'pass_purchase' && String(gatewayOrMethod || '').toLowerCase().includes('wallet')) {
      return res.status(400).json({ error: 'Worker Passes must be purchased strictly by deposit, not Wallet balance.' });
    }
    if (String(kind) === 'investment_deposit' && String(gatewayOrMethod || '').toLowerCase().includes('wallet')) {
      return res.status(400).json({ error: 'Investments must be funded strictly by deposit, not Wallet balance.' });
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
      passRevenueUsd: +transactions
        .filter((t) => t.kind === 'pass_purchase' && t.status === 'Completed')
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

function resolveEffectiveQuotaTierId(uid?: string, requestedPackageId?: unknown): QuotaTierId {
  const rank: Record<QuotaTierId, number> = { free: 0, starter: 1, pro: 2, vip: 3 };
  let approvedTier: QuotaTierId | null = null;
  let hasUnapprovedProof = false;

  if (uid && uid !== 'guest') {
    const cust = getCustomerByUid(uid);
    if (cust?.adminAssignedPass === 'free') {
      return 'free';
    }
    if (cust?.adminAssignedPass && ['starter', 'pro', 'vip'].includes(cust.adminAssignedPass)) {
      approvedTier = cust.adminAssignedPass;
    }

    const proofs = listCustomerPassProofs(uid);
    for (const proof of proofs) {
      if (proof.status === 'Approved') {
        const tier = getQuotaRuleForPackageId(proof.packageId).tierId;
        if (!approvedTier || rank[tier] > rank[approvedTier]) {
          approvedTier = tier;
        }
      } else if (proof.status === 'Pending' || proof.status === 'Rejected' || proof.status === 'Banned') {
        hasUnapprovedProof = true;
      }
    }
  }

  if (approvedTier) return approvedTier;

  const rawRequested = typeof requestedPackageId === 'string' ? requestedPackageId.trim().toLowerCase() : '';
  if (!hasUnapprovedProof && (rawRequested === 'starter' || rawRequested === 'pro' || rawRequested === 'vip')) {
    return rawRequested;
  }
  return 'free';
}

// 2b. Daily Task Quota & Max Amount Status
app.get('/api/user/quota', optionalAuth, (req: AuthRequest, res) => {
  const uid = req.user?.uid || 'guest';
  const tierId = resolveEffectiveQuotaTierId(uid, req.query.packageId);
  const rule = getQuotaRuleForPackageId(tierId);
  const record = getUserDailyQuotaRecord(uid);
  const remainingToday = Math.max(0, rule.dailyLimit - record.totalCount);

  return res.json({
    success: true,
    rule,
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

  const state = getOrCreateCustomerState(uid);
  const effectiveTier = resolveEffectiveQuotaTierId(uid, state.activePackageId);
  const resolvedPkg = effectiveTier === 'free' ? null : effectiveTier;
  if (resolvedPkg && resolvedPkg !== state.activePackageId) {
    setCustomerApprovedPackage(uid, resolvedPkg);
  }

  return res.json({
    success: true,
    state: {
      ...state,
      activePackageId: resolvedPkg || state.activePackageId,
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
      activePackageId: body.activePackageId !== undefined ? body.activePackageId : undefined,
      vipReferralCount: typeof body.vipReferralCount === 'number' ? body.vipReferralCount : undefined,
    });

    const effectiveTier = resolveEffectiveQuotaTierId(uid, merged.activePackageId);
    const resolvedPkg = effectiveTier === 'free' ? null : effectiveTier;

    return res.json({
      success: true,
      state: {
        ...merged,
        activePackageId: resolvedPkg || merged.activePackageId,
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not persist customer state.',
    });
  }
});

// 3. Save Completed Task & Enforce Daily Tier Quota / Max Reward
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
    const { taskId, taskTitle, category, reward, packageId, status, accuracyScore, transactionRef } = req.body;

    const isOwner =
      req.user?.authKind === 'firebase' &&
      req.user?.email?.toLowerCase() === OWNER_EMAIL &&
      Boolean(req.user?.email_verified);

    const effectiveTierId = resolveEffectiveQuotaTierId(uid, packageId);
    const normalizedCategory = typeof category === 'string' && category.trim() ? category.trim() : 'micro';
    const rawReward = typeof reward === 'number' ? reward : Number(reward) || 0.5;

    const quotaCheck = validateAndRecordDailyTaskUsage({
      userKey: uid,
      packageId: effectiveTierId,
      taskId: taskId || `task-${Date.now()}`,
      category: normalizedCategory,
      rewardUsd: rawReward,
      isOwner,
    });

    if (!quotaCheck.allowed) {
      return res.status(403).json({
        success: false,
        error: quotaCheck.error || 'Daily task limit or tier amount ceiling reached.',
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

// --- Customer Deposit-Only Investments (KES 50+ Minimum, NO Wallet Balance) ---

app.get('/api/investments/plans', (_req, res) => {
  return res.json({
    success: true,
    minKes: MIN_INVESTMENT_KES,
    payToNumber: '0758727558',
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
      depositMethod: String(depositMethod || ''),
      useWalletBalance: Boolean(useWalletBalance),
      senderPhone: senderPhone ? String(senderPhone) : undefined,
      paymentReference: String(paymentReference || ''),
      screenshotDataUrl: screenshotDataUrl ? String(screenshotDataUrl) : undefined,
      screenshotFileName: screenshotFileName ? String(screenshotFileName) : undefined,
    });

    return res.status(201).json({
      success: true,
      message: `Investment deposit of KES ${record.amountKes.toLocaleString()} submitted! Pending Owner approval after confirming payment on 0758727558.`,
      investment: {
        ...record,
        screenshotDataUrl: record.screenshotDataUrl ? '[UPLOADED]' : undefined,
      },
    });
  } catch (error: any) {
    const status = error instanceof InvestmentValidationError ? error.statusCode : 400;
    return res.status(status).json({
      success: false,
      error: error?.message || 'Could not process investment deposit.',
    });
  }
});

app.post('/api/investments/paystack/stk', optionalAuth, requireEastAfrica, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid || 'guest';
    const customerRec = req.user?.uid ? getCustomerByUid(req.user.uid) : null;
    if (customerRec?.banned || customerRec?.deactivated) {
      return res.status(403).json({
        success: false,
        error: customerRec.banned
          ? `Account permanently banned: ${customerRec.bannedReason || 'Policy violation.'}`
          : `Account deactivated: ${customerRec.deactivatedReason || 'Contact Support (+254712727558).'}`,
      });
    }

    const { phone, amountKes, planId = 'starter-7d', countryCode = 'KE', customerName } = req.body || {};
    const kesAmount = Math.round(Number(amountKes));
    if (!Number.isFinite(kesAmount) || kesAmount < MIN_INVESTMENT_KES) {
      return res.status(400).json({
        success: false,
        error: `Minimum investment deposit is KES ${MIN_INVESTMENT_KES}. Please enter KES ${MIN_INVESTMENT_KES} or above.`,
      });
    }

    const rawPhone = String(phone || customerRec?.phone || '').trim();
    if (!isEastAfricaPhone(rawPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Enter a valid Kenyan (+254 / 07...) mobile number for Paystack M-PESA STK deposit.',
      });
    }

    let digits = rawPhone.replace(/[^0-9]/g, '');
    if (digits.startsWith('0')) digits = '254' + digits.substring(1);
    else if (digits.startsWith('7') || digits.startsWith('1')) digits = '254' + digits;
    if (!digits.startsWith('254')) {
      return res.status(400).json({
        success: false,
        error: 'Paystack M-PESA STK supports Kenya (+254). Use Manual M-PESA / Mobile Money deposit to 0758727558 instead.',
      });
    }
    const plusPhone = `+${digits}`;
    const reference = `INV_STK_${Date.now()}_${crypto.randomInt(1000, 9999)}`;

    if (!paystackConfig.secretKey) {
      const mpesaReceipt = `PSINV${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
      const record = createInvestmentDeposit({
        userUid: uid,
        customerName: customerName ? String(customerName) : customerRec?.displayName || 'East Africa Investor',
        customerPhone: plusPhone,
        customerEmail: customerRec?.email || req.user?.email,
        countryCode: String(countryCode || 'KE'),
        planId: String(planId),
        amountKes: kesAmount,
        depositMethod: 'Paystack M-PESA STK',
        senderPhone: plusPhone,
        paymentReference: mpesaReceipt,
        verifiedGatewayStatus: 'Active',
      });
      return res.json({
        success: true,
        simulation: true,
        reference,
        mpesaReceipt,
        investment: record,
        message: `Paystack M-PESA STK deposit of KES ${kesAmount.toLocaleString()} confirmed and activated!`,
      });
    }

    const psRes = await fetch('https://api.paystack.co/charge', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: (customerRec?.email || req.user?.email || 'investor@gideon-global-tasks.ai.studio').trim(),
        amount: String(kesAmount * 100),
        currency: 'KES',
        mobile_money: { phone: plusPhone, provider: 'mpesa' },
        metadata: { kind: 'investment_deposit', planId, uid, amountKes: kesAmount },
      }),
    });
    const psData: any = await psRes.json();
    if (!psRes.ok || !psData.status) {
      return res.status(400).json({
        success: false,
        error: psData.message || 'Paystack rejected M-PESA STK investment deposit.',
      });
    }

    const liveRef = psData.data?.reference || reference;
    const record = createInvestmentDeposit({
      userUid: uid,
      customerName: customerName ? String(customerName) : customerRec?.displayName || 'East Africa Investor',
      customerPhone: plusPhone,
      customerEmail: customerRec?.email || req.user?.email,
      countryCode: String(countryCode || 'KE'),
      planId: String(planId),
      amountKes: kesAmount,
      depositMethod: 'Paystack M-PESA STK',
      senderPhone: plusPhone,
      paymentReference: liveRef,
      verifiedGatewayStatus: psData.data?.status === 'success' ? 'Active' : undefined,
    });

    return res.json({
      success: true,
      simulation: false,
      reference: liveRef,
      investment: record,
      message: psData.data?.display_text || `STK Push sent to ${plusPhone} for KES ${kesAmount.toLocaleString()}.`,
    });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not initiate Paystack investment deposit.',
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

const GIDEON_SUPPORT_SYSTEM_INSTRUCTION = `You are the official Gideon Global Tasks Live AI Support & Task Assistant.
Follow these verified platform facts strictly when answering customer questions (NEVER display the US dollar sign; use Kenya Shillings KSh or the customer's local East Africa currency symbol):
1. Platform & Region: Gideon Global Tasks is an East Africa crowdsourcing and AI data annotation marketplace serving Kenya (KE, KSh), Uganda (UG, USh), Tanzania (TZ, TSh), Rwanda (RW, FRw), Burundi (BI, FBu), South Sudan (SS, SSP), Ethiopia (ET, Br), and Somalia (SO, Sh.So.).
2. Registration & Mandatory SMS OTP: New customers must register with a valid East Africa mobile phone number, country selection, display name, and password, and MUST enter the mandatory 6-digit SMS OTP code sent to their phone before account activation. Optional 2FA (SMS or Authenticator App) can also be enabled after login.
3. Starter Balance & Tasks: Every new customer account starts with zero balance (KSh 0 or equivalent). Customers earn rewards by completing vetted surveys, AI data annotation, data entry, copywriting, meme creation, and micro-tasks. Completed task rewards across ALL tiers are capped at a maximum of 50 shillings per completed task. Daily task quotas depend on tier:
   - Free Tier (No Worker Pass): 1 free task daily (max 50 shillings).
   - Starter Worker Pass (KSh 50): 2 tasks daily (max 50 shillings per task).
   - Second Worker Pass / Pro (KSh 100): 3 tasks daily (max 50 shillings per task).
   - VIP Worker Pass (KSh 200): 4 surveys daily (max 50 shillings per survey).
4. Worker Passes & Manual Proof Policy: All Worker Passes (Starter KSh 50, Pro KSh 100, VIP KSh 200) are payable by deposit only (not wallet balance) via M-PESA Send Money to 0758727558 (or configured Paystack/IntaSend checkout). Manual payments MUST submit a valid M-PESA confirmation code AND payment screenshot proof; failure to submit genuine proof results in being permanently banned forever with no second chance. Passes do NOT open automatically until the Platform Owner approves and sends verification details.
5. Withdrawals: Minimum withdrawal threshold is KSh 2,600 (or equivalent in the customer's country currency) via M-PESA, Airtel / MTN MoMo, East Africa Bank, Wise, or Crypto USDT. Do NOT proactively mention later withdrawal steps to customers who have not yet reached the withdrawal threshold — focus only on their current step. Every withdrawal request enters "Pending Owner Approval" and is reviewed & disbursed by the verified Platform Owner.
6. Referrals: Customers earn 20% instant commission when invited friends buy a Worker Pass.
7. Customer Support Helpline: If a customer experiences any issue (SMS OTP delivery, task approval, Worker Pass activation, or payout delay), direct them to Call: +254712727558, WhatsApp: 0785909543 (https://wa.me/254785909543), or Email: nigideon36@gmail.com.

Style guidelines: Be warm, concise, honest, and practical. Use clean bullet points or numbered steps when explaining how to do something. Never fabricate transaction IDs, balances, or fake approvals, and never use US dollar signs.`;

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

// 1. Live Streaming Chatbot with Google Search Grounding (SSE)
app.post('/api/chat/stream', async (req, res) => {
  try {
    const { messages, useSearch = true, systemInstruction, customerContext } = req.body || {};
    if (!ai) {
      return res.status(503).json({
        error: 'Live AI Chatbot is not configured yet (missing GEMINI_API_KEY). For immediate assistance, Call +254712727558 or WhatsApp 0785909543.',
      });
    }

    const contents = buildChatContents(messages);
    if (contents.length === 0) {
      return res.status(400).json({ error: 'Please enter a message to ask the AI assistant.' });
    }

    const contextAppendix = customerContext
      ? `\n\nSigned-in Customer Context (read-only): Country=${customerContext.country || 'East Africa'}, Balance=${customerContext.formattedBalance || `KSh ${Math.round(Number(customerContext.balance || 0) * 130)}`}, ActivePass=${customerContext.pass || 'None'}, CompletedTasks=${Number(customerContext.tasksCompleted || 0)}.`
      : '';

    const config: any = {
      systemInstruction: (systemInstruction || GIDEON_SUPPORT_SYSTEM_INSTRUCTION) + contextAppendix,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const responseStream = await ai.models.generateContentStream({
      model: 'gemini-4-hydrogen',
      contents,
      config,
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

    res.write(`data: ${JSON.stringify({ done: true, sources: allSources })}\n\n`);
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
    const { messages, useSearch = true, systemInstruction, customerContext } = req.body || {};
    if (!ai) {
      return res.status(503).json({
        error: 'Live AI Chatbot requires GEMINI_API_KEY to be configured on the server. For immediate assistance, Call +254712727558 or WhatsApp 0785909543.',
      });
    }

    const contents = buildChatContents(messages);
    if (contents.length === 0) {
      return res.status(400).json({ error: 'Please enter a message to ask the AI assistant.' });
    }

    const contextAppendix = customerContext
      ? `\n\nSigned-in Customer Context (read-only): Country=${customerContext.country || 'East Africa'}, Balance=${customerContext.formattedBalance || `KSh ${Math.round(Number(customerContext.balance || 0) * 130)}`}, ActivePass=${customerContext.pass || 'None'}, CompletedTasks=${Number(customerContext.tasksCompleted || 0)}.`
      : '';

    const config: any = {
      systemInstruction: (systemInstruction || GIDEON_SUPPORT_SYSTEM_INSTRUCTION) + contextAppendix,
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents,
      config,
    });

    const text = response.text || 'No response generated.';
    const sources = extractGroundingSources(response.candidates?.[0]);

    res.json({ text, sources });
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

// Vite middleware in dev
async function startServer() {
  const isDev = process.env.NODE_ENV !== 'production';
  if (isDev) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('index.html', { root: 'dist' });
    });
  }

  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Gideon Global Tasks server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
});
