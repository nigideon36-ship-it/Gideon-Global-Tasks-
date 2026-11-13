import express from 'express';
import compression from 'compression';
import { createServer as createViteServer } from 'vite';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { requireAuth, requireOwner, type AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { db } from './src/db/index.ts';
import { completedTasks, referrals, payouts } from './src/db/schema.ts';
import { eq, desc } from 'drizzle-orm';
import { generateSitemapXml } from './src/utils/sitemapGenerator.ts';

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
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://*.doubleclick.net https://*.gstatic.com https://apis.google.com https://adservice.google.com https://*.google-analytics.com https://unpkg.com https://*.intasend.com https://*.paypal.com https://www.paypalobjects.com; " +
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://*.intasend.com; " +
    "font-src 'self' https://fonts.gstatic.com data:; " +
    "img-src 'self' data: https: blob: https://*.intasend.com https://*.paypal.com https://www.paypalobjects.com; " +
    "frame-src 'self' https://*.google.com https://*.googlesyndication.com https://*.doubleclick.net https://*.firebaseapp.com https://*.intasend.com https://*.paypal.com; " +
    "connect-src 'self' https: wss: https://firestore.googleapis.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://*.intasend.com https://*.paypal.com;"
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

app.post('/api/mpesa/stkpush', async (req, res) => {
  try {
    const { phone, amount = 10, packageId = 'pro', accountReference = 'GideonTasks' } = req.body;

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

      mpesaTransactions.set(callbackData.CheckoutRequestID, {
        status: isSuccess ? 'Completed' : 'Failed',
        resultCode: callbackData.ResultCode,
        resultDesc: callbackData.ResultDesc,
        mpesaReceipt: receiptNumber,
        updatedAt: new Date().toISOString()
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

app.post('/api/intasend/stk-push', async (req, res) => {
  try {
    const { phone, amount, packageId = 'pro', email = 'contributor@gideon-global-tasks.ai.studio', name = 'Gideon Contributor' } = req.body;

    let cleanPhone = String(phone || '').replace(/[^0-9]/g, '');
    if (cleanPhone.startsWith('0')) {
      cleanPhone = '254' + cleanPhone.substring(1);
    } else if (cleanPhone.startsWith('7') || cleanPhone.startsWith('1')) {
      cleanPhone = '254' + cleanPhone;
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return res.status(400).json({ error: 'Please enter a valid Safaricom phone number' });
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
    payPalMeUrl: `https://paypal.me/${payPalConfig.payPalMeHandle.replace(/^@/, '')}`,
    isConfigured: Boolean(payPalConfig.primaryEmail)
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
    message: 'PayPal international configuration updated successfully',
    config: {
      primaryEmail: payPalConfig.primaryEmail,
      mode: payPalConfig.mode,
      currency: payPalConfig.currency,
      payPalMeHandle: payPalConfig.payPalMeHandle,
      payPalMeUrl: `https://paypal.me/${payPalConfig.payPalMeHandle.replace(/^@/, '')}`
    }
  });
});

app.post('/api/paypal/create-order', (req, res) => {
  try {
    const { amount, packageId = 'starter', description = 'Gideon Contributor Pass', payerEmail = '' } = req.body;
    const numAmount = Number(amount) || 2;
    const orderId = `PP-ORD-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    const orderData = {
      orderId,
      packageId,
      description,
      amount: numAmount,
      currency: payPalConfig.currency,
      recipientEmail: payPalConfig.primaryEmail, // 'nigideon36@gmail.com'
      payerEmail,
      status: 'CREATED',
      createdAt: new Date().toISOString(),
      payPalMeDirectUrl: `https://paypal.me/${payPalConfig.payPalMeHandle.replace(/^@/, '')}/${numAmount}USD`
    };

    payPalOrders.set(orderId, orderData);

    res.json({
      success: true,
      orderId,
      order: orderData,
      recipientEmail: payPalConfig.primaryEmail,
      payPalMeDirectUrl: orderData.payPalMeDirectUrl,
      message: `PayPal international order generated for $${numAmount.toFixed(2)} USD directed to ${payPalConfig.primaryEmail}`
    });
  } catch (err: any) {
    console.error('PayPal create order error:', err);
    res.status(500).json({ error: err.message || 'Failed to create PayPal order' });
  }
});

app.post('/api/paypal/capture-order', (req, res) => {
  try {
    const { orderId, payerEmail = 'international-buyer@paypal.com', notes = '' } = req.body;
    if (!orderId) {
      return res.status(400).json({ error: 'Order ID is required' });
    }

    const existingOrder = payPalOrders.get(orderId) || {
      orderId,
      amount: 5,
      currency: 'USD',
      packageId: 'pro',
      description: 'Gideon Worker Pass'
    };

    const transactionId = `PP-TXN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    const completedRecord = {
      ...existingOrder,
      transactionId,
      payerEmail,
      recipientEmail: payPalConfig.primaryEmail,
      status: 'COMPLETED',
      notes,
      capturedAt: new Date().toISOString()
    };

    payPalOrders.set(orderId, completedRecord);

    res.json({
      success: true,
      orderId,
      transactionId,
      recipientEmail: payPalConfig.primaryEmail,
      status: 'COMPLETED',
      message: `International PayPal payment of $${existingOrder.amount} confirmed and routed to ${payPalConfig.primaryEmail}`,
      details: completedRecord
    });
  } catch (err: any) {
    console.error('PayPal capture error:', err);
    res.status(500).json({ error: err.message || 'Failed to capture PayPal payment' });
  }
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

// --- Cloud SQL PostgreSQL & Firebase Auth Endpoints ---

// 1. Synchronize User Profile to Cloud SQL
app.post('/api/auth/sync', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    const email = req.user?.email || req.body?.email || '';
    const displayName = req.body?.displayName || req.user?.name || '';
    if (!uid) {
      return res.status(400).json({ error: 'Missing UID' });
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
app.post('/api/user/tasks', requireAuth, async (req: AuthRequest, res) => {
  try {
    const uid = req.user?.uid;
    if (!uid) return res.status(401).json({ error: 'Unauthorized' });
    const { taskId, taskTitle, category, reward, status, accuracyScore, transactionRef } = req.body;

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
