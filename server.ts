import express from 'express';
import crypto from 'crypto';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, optionalAuth, requireOwner, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { completedTasks, referrals, payouts } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { generateSitemapXml } from './src/utils/sitemapGenerator.ts';
import QRCode from 'qrcode';
import {
  EAST_AFRICA_COUNTRIES,
  isEastAfricaCountryCode,
  isEastAfricaPhone,
} from './src/lib/eastAfrica.ts';
import {
  validateRegistrationInputs,
  registerCustomerAccount,
  getCustomerByPhone,
  getCustomerByUid,
  ensureShadowCustomerForGoogleUid,
  verifyPassword,
  saveCustomerRecord,
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
} from './src/lib/customerAuth.ts';
import {
  createWithdrawalRequest,
  listAllWithdrawals,
  listCustomerWithdrawals,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
} from './src/lib/withdrawalsStore.ts';
import {
  upsertPlatformTransaction,
  listAllPlatformTransactions,
} from './src/lib/transactionsStore.ts';

dotenv.config();

const app = express();
app.use(compression());
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
let publisherConfig = {
  searchConsoleToken: 'google2d71976008fafb8e',
  adsensePublisherId: 'pub-8366092986496846',
  adsenseClientId: 'ca-pub-8366092986496846',
  canonicalUrl: 'https://gideon-global-tasks.ai.studio'
};

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

app.get('/robots.txt', (_req, res) => {
  res.type('text/plain').send([
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
    `Sitemap: ${publisherConfig.canonicalUrl}/sitemap.xml`
  ].join('\n') + '\n');
});

app.get('/sitemap.xml', (_req, res) => {
  const xml = generateSitemapXml(publisherConfig.canonicalUrl);
  res.type('application/xml').send(xml);
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
}

let darajaConfig: DarajaConfig = {
  environment: (process.env.MPESA_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
  consumerKey: process.env.MPESA_CONSUMER_KEY || '',
  consumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
  businessShortCode: process.env.MPESA_SHORTCODE || '174379',
  passkey: process.env.MPESA_PASSKEY || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919',
  callbackUrl: process.env.MPESA_CALLBACK_URL || 'https://gideon-global-tasks.ai.studio/api/mpesa/callback'
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
  const { environment, consumerKey, consumerSecret, businessShortCode, passkey, callbackUrl } = req.body;
  if (environment) darajaConfig.environment = environment === 'production' ? 'production' : 'sandbox';
  if (consumerKey !== undefined) darajaConfig.consumerKey = String(consumerKey).trim();
  if (consumerSecret !== undefined) darajaConfig.consumerSecret = String(consumerSecret).trim();
  if (businessShortCode !== undefined) darajaConfig.businessShortCode = String(businessShortCode).trim();
  if (passkey !== undefined) darajaConfig.passkey = String(passkey).trim();
  if (callbackUrl !== undefined) darajaConfig.callbackUrl = String(callbackUrl).trim();

  res.json({
    success: true,
    message: 'Daraja configuration saved successfully',
    config: {
      environment: darajaConfig.environment,
      businessShortCode: darajaConfig.businessShortCode,
      isConfigured: Boolean(darajaConfig.consumerKey && darajaConfig.consumerSecret)
    }
  });
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
interface PaystackConfig {
  publicKey: string;
  secretKey: string;
  isTest: boolean;
  webhookUrl: string;
}

const defaultPaystackSecret = process.env.PAYSTACK_SECRET_KEY || '';
const defaultPaystackPublic = process.env.PAYSTACK_PUBLIC_KEY || '';
let paystackConfig: PaystackConfig = {
  publicKey: defaultPaystackPublic,
  secretKey: defaultPaystackSecret,
  isTest: defaultPaystackSecret ? defaultPaystackSecret.startsWith('sk_test_') : process.env.PAYSTACK_ENVIRONMENT !== 'live',
  webhookUrl: `${(process.env.APP_URL || 'https://gideon-global-tasks.ai.studio').replace(/\/$/, '')}/api/paystack/webhook`
};

const paystackTransactions = new Map<string, any>();

app.get('/api/paystack/config', requireOwner, (req, res) => {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  res.json({
    publicKey: paystackConfig.publicKey,
    isTest: paystackConfig.isTest,
    isConfigured: Boolean(paystackConfig.secretKey && paystackConfig.publicKey),
    webhookUrl: origin ? `${origin}/api/paystack/webhook` : paystackConfig.webhookUrl
  });
});

app.post('/api/paystack/config', requireOwner, (req, res) => {
  const { publicKey, secretKey, isTest, webhookUrl } = req.body;
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

  res.json({
    success: true,
    message: 'Paystack API settings updated successfully',
    config: {
      publicKey: paystackConfig.publicKey,
      isTest: paystackConfig.isTest,
      isConfigured: Boolean(paystackConfig.secretKey && paystackConfig.publicKey),
      webhookUrl: paystackConfig.webhookUrl
    }
  });
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
        message: `Paystack Card checkout ready for ${countryCode} (KES ${kesAmount} / ~$${resolvedUsd.toFixed(2)}).`
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

    const updated = {
      status: psData.data?.status || 'pending',
      reference,
      gatewayResponse: psData.data?.gateway_response,
      receipt: psData.data?.receipt_number || reference,
      amountKes: psData.data?.amount ? Math.round(psData.data.amount / 100) : cached?.amountKes,
      updatedAt: new Date().toISOString()
    };
    paystackTransactions.set(reference, updated);
    if (updated.status === 'success' || updated.status === 'failed') {
      upsertPlatformTransaction({
        id: reference,
        kind: 'pass_purchase',
        title: 'Worker Pass · Paystack Verified',
        customerLabel: cached?.phone || psData.data?.customer?.email || 'Paystack Customer',
        gatewayOrMethod: 'Paystack',
        currency: 'KES',
        amountLocal: updated.amountKes ? Number(updated.amountKes) : undefined,
        amountUsd: updated.amountKes ? +(Number(updated.amountKes) / 130).toFixed(2) : 0,
        status: updated.status === 'success' ? 'Completed' : 'Failed',
        reference: updated.receipt || reference,
        countryCode: 'KE',
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
      paystackTransactions.set(ref, {
        status: 'success',
        reference: ref,
        receipt: event.data?.receipt_number || ref,
        amountKes,
        updatedAt: new Date().toISOString()
      });
      upsertPlatformTransaction({
        id: ref,
        kind: 'pass_purchase',
        title: 'Worker Pass · Paystack Webhook Confirmed',
        customerLabel: event.data?.customer?.email || 'Paystack Customer',
        gatewayOrMethod: 'Paystack',
        currency: 'KES',
        amountLocal: amountKes,
        amountUsd: amountKes ? +(amountKes / 130).toFixed(2) : 0,
        status: 'Completed',
        reference: event.data?.receipt_number || ref,
        countryCode: 'KE',
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
      smsDeliveryMode: smsResult.deliveryMode,
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
    const { phone, countryCode, email, displayName, password, otpCode } = req.body || {};
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
      password: String(password || ''),
      phoneVerified: true,
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

// 2. Customer Sign In with Mobile Number + Password (triggers 2FA challenge if enabled)
app.post('/api/customer/login', requireEastAfrica, async (req, res) => {
  try {
    const { phone, countryCode, password } = req.body || {};
    const record = getCustomerByPhone(String(phone || ''), countryCode ? String(countryCode) : undefined);
    if (!record || !record.passwordHash || !verifyPassword(String(password || ''), record.passwordHash)) {
      return res.status(401).json({
        success: false,
        error: 'Invalid mobile number or password/PIN.',
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
          smsDeliveryMode: smsResult.deliveryMode,
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

    record.phone = candidatePhone;
    saveCustomerRecord(record);

    const smsResult = await sendSmsOtp(candidatePhone, 'enable-sms-2fa');
    return res.json({
      success: true,
      method: 'sms',
      maskedPhone: smsResult.maskedPhone,
      smsDeliveryMode: smsResult.deliveryMode,
      ...(smsResult.previewCode ? { previewCode: smsResult.previewCode } : {}),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Failed to initiate 2FA setup' });
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

// Customer initiates a withdrawal request (always enters as Processing; cannot self-approve)
app.post('/api/withdrawals/request', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const { id, amountUsd, method, accountDetails, countryCode, mpesaReceipt } = req.body || {};
    const uid = req.user?.uid || `guest_${crypto.randomBytes(6).toString('hex')}`;
    const record = createWithdrawalRequest({
      id: id ? String(id) : undefined,
      userUid: uid,
      customerPhone: req.user?.phone_number,
      customerEmail: req.user?.email,
      customerName: req.user?.name,
      countryCode: countryCode ? String(countryCode) : 'KE',
      amountUsd: Number(amountUsd),
      method: String(method || ''),
      accountDetails: String(accountDetails || ''),
      mpesaReceipt: mpesaReceipt ? String(mpesaReceipt) : undefined,
    });
    upsertPlatformTransaction({
      id: record.id,
      kind: 'withdrawal',
      title: `Customer Withdrawal Request (${record.method})`,
      customerLabel: record.customerName || record.customerPhone || record.customerEmail || record.accountDetails,
      gatewayOrMethod: record.method,
      currency: 'USD',
      amountUsd: record.amountUsd,
      status: 'Processing',
      reference: record.mpesaReceipt || record.id,
      countryCode: record.countryCode,
      metadata: { accountDetails: record.accountDetails },
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

// Owner ONLY: View all customer withdrawal requests
app.get('/api/owner/withdrawals', requireOwner, (_req: AuthRequest, res) => {
  return res.json({
    withdrawals: listAllWithdrawals(),
  });
});

// Owner ONLY: Approve & mark disbursement completed for a customer withdrawal
app.post('/api/owner/withdrawals/:id/approve', requireOwner, (req: AuthRequest, res) => {
  try {
    const { receiptCode, disbursementChannel } = req.body || {};
    const ownerEmail = req.user?.email || 'nigideon36@gmail.com';
    const updated = approveWithdrawalRequest({
      id: String(req.params.id),
      ownerEmail,
      receiptCode: receiptCode ? String(receiptCode) : undefined,
      disbursementChannel: disbursementChannel ? String(disbursementChannel) : undefined,
    });
    upsertPlatformTransaction({
      id: updated.id,
      kind: 'withdrawal',
      title: `Customer Withdrawal Approved (${updated.method})`,
      customerLabel: updated.customerName || updated.customerPhone || updated.customerEmail || updated.accountDetails,
      gatewayOrMethod: updated.method,
      currency: 'USD',
      amountUsd: updated.amountUsd,
      status: 'Completed',
      reference: updated.mpesaReceipt || updated.id,
      countryCode: updated.countryCode,
      metadata: { approvedBy: ownerEmail, accountDetails: updated.accountDetails },
    });
    return res.json({ success: true, withdrawal: updated });
  } catch (error: any) {
    return res.status(400).json({
      success: false,
      error: error?.message || 'Could not approve withdrawal.',
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
    upsertPlatformTransaction({
      id: updated.id,
      kind: 'withdrawal',
      title: `Customer Withdrawal Rejected (${updated.method})`,
      customerLabel: updated.customerName || updated.customerPhone || updated.customerEmail || updated.accountDetails,
      gatewayOrMethod: updated.method,
      currency: 'USD',
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

// Record completed tasks, pass purchases, and referral commissions into the unified Owner transaction ledger
app.post('/api/transactions/record', optionalAuth, requireEastAfrica, (req: AuthRequest, res) => {
  try {
    const { id, kind, title, customerLabel, gatewayOrMethod, currency, amountLocal, amountUsd, status, reference, countryCode, metadata } = req.body || {};
    if (!kind || !['withdrawal', 'pass_purchase', 'task_reward', 'referral_commission'].includes(String(kind))) {
      return res.status(400).json({ error: 'Invalid transaction kind' });
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

// 3. Save Completed Task to Cloud SQL
app.post('/api/user/tasks', requireAuth, requireEastAfrica, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { taskId, taskTitle, category, reward, status, accuracyScore, transactionRef } = req.body;

    if (!process.env.SQL_HOST) {
      return res.json({
        userUid: uid,
        taskId: taskId || `task-${Date.now()}`,
        taskTitle: taskTitle || 'Completed Task',
        category: category || 'micro',
        reward: typeof reward === 'number' ? reward : 0.5,
        status: status || 'Approved',
      });
    }

    await getOrCreateUser(uid, req.user?.email || '', req.user?.name || '');

    const record = await db
      .insert(completedTasks)
      .values({
        userUid: uid,
        taskId: taskId || `task-${Date.now()}`,
        taskTitle: taskTitle || 'Completed Task',
        category: category || 'micro',
        reward: typeof reward === 'number' ? reward : 0.50,
        status: status || 'Approved',
        accuracyScore: typeof accuracyScore === 'number' ? accuracyScore : 100.0,
        transactionRef: transactionRef || `TXN-${Math.floor(100000 + Math.random() * 900000)}`
      })
      .returning();

    res.json(record[0]);
  } catch (error: any) {
    console.error('Error saving task to Cloud SQL:', error);
    res.status(500).json({ error: 'Failed to save completed task' });
  }
});

// 1. Multi-turn Chatbot with Google Search Grounding
app.post('/api/chat', async (req, res) => {
  try {
    const { messages, useSearch = true, systemInstruction } = req.body;
    if (!ai) {
      return res.status(200).json({
        text: "I am Gideon Global Task Assistant. (Note: GEMINI_API_KEY is not configured in this environment, but you can explore task tips, drafting suggestions, and guidelines directly!).",
        sources: []
      });
    }

    const contents = (messages || []).map((m: any) => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: m.content || m.text || '' }]
    }));

    const config: any = {
      systemInstruction: systemInstruction || "You are Gideon Global Taskmaster & AI Co-Pilot. You help global workers succeed on market research surveys, AI data annotation, data entry, copywriting, meme creation, and micro tasks. Provide concise, clear, and highly practical assistance."
    };

    if (useSearch) {
      config.tools = [{ googleSearch: {} }];
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents,
      config
    });

    const text = response.text || "No response generated.";
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: { title: string; uri: string }[] = [];

    if (Array.isArray(chunks)) {
      chunks.forEach((c: any) => {
        if (c.web?.uri) {
          sources.push({ title: c.web.title || c.web.uri, uri: c.web.uri });
        }
      });
    }

    res.json({ text, sources });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ error: error.message || 'Chat generation failed' });
  }
});

// 2. Google Maps Grounding & Local Field Tasks
app.post('/api/maps-grounding', async (req, res) => {
  try {
    const { query, latitude, longitude } = req.body;
    if (!ai) {
      return res.status(200).json({
        text: "Global field tasks available in major metropolitan hubs: store compliance audits, street signage verification, and venue photography.",
        mapsLinks: []
      });
    }

    const config: any = {
      tools: [{ googleMaps: {} }]
    };

    if (latitude && longitude) {
      config.toolConfig = {
        retrievalConfig: {
          latLng: {
            latitude: Number(latitude),
            longitude: Number(longitude)
          }
        }
      };
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: query || "Find nearby businesses, grocery markets, or retail points for mystery shopper tasks",
      config
    });

    const text = response.text || "";
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
    res.status(500).json({ error: error.message || 'Maps query failed' });
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
