import { EAST_AFRICA_COUNTRIES } from './eastAfrica.ts';
import type { WithdrawalRecord } from './withdrawalsStore.ts';

export type PayoutGatewayMode = 'auto' | 'paystack' | 'intasend' | 'daraja' | 'manual';

export interface LivePaystackConfig {
  publicKey: string;
  secretKey: string;
  isTest: boolean;
}

export interface LiveIntasendConfig {
  publishableKey: string;
  secretKey: string;
  isTest: boolean;
}

export interface LiveDarajaConfig {
  environment: 'sandbox' | 'production';
  consumerKey: string;
  consumerSecret: string;
  businessShortCode: string;
  b2cShortCode?: string;
  initiatorName?: string;
  securityCredential?: string;
  b2cResultUrl?: string;
}

export interface LiveTransferOutcome {
  gateway: 'paystack' | 'intasend' | 'daraja' | 'manual';
  receiptCode: string;
  disbursementChannel: string;
  currency: string;
  amountLocal: number;
  gatewayStatus: string;
  isSandboxOrTest: boolean;
}

function getLocalConversion(countryCode: string, amountUsd: number): { currency: string; amountLocal: number } {
  const match = EAST_AFRICA_COUNTRIES.find((c) => c.code === countryCode.toUpperCase()) || EAST_AFRICA_COUNTRIES[0];
  const rate = match.approxRatePerUsd || 130;
  return {
    currency: match.currency,
    amountLocal: Math.max(1, Math.round(amountUsd * rate)),
  };
}

function normalizePhoneForMpesa254(raw: string): string {
  let digits = String(raw || '').replace(/[^0-9]/g, '');
  if (digits.startsWith('0')) {
    digits = `254${digits.slice(1)}`;
  } else if (digits.length === 9 && (digits.startsWith('7') || digits.startsWith('1'))) {
    digits = `254${digits}`;
  }
  return digits;
}

function normalizePhoneForPaystackKenya(raw: string): string {
  const digits = normalizePhoneForMpesa254(raw);
  if (digits.startsWith('254') && digits.length >= 12) {
    return `0${digits.slice(3)}`;
  }
  return digits;
}

export function getGatewayReadiness(params: {
  paystackConfig: LivePaystackConfig;
  intasendConfig: LiveIntasendConfig;
  darajaConfig: LiveDarajaConfig;
}) {
  const paystackReady = Boolean(params.paystackConfig.secretKey);
  const intasendReady = Boolean(params.intasendConfig.secretKey);
  const darajaB2cReady = Boolean(
    params.darajaConfig.consumerKey &&
      params.darajaConfig.consumerSecret &&
      params.darajaConfig.initiatorName &&
      params.darajaConfig.securityCredential
  );

  return {
    paystack: {
      configured: paystackReady,
      live: paystackReady && !params.paystackConfig.isTest,
      mode: !paystackReady ? 'not_configured' : params.paystackConfig.isTest ? 'test' : 'live',
    },
    intasend: {
      configured: intasendReady,
      live: intasendReady && !params.intasendConfig.isTest,
      mode: !intasendReady ? 'not_configured' : params.intasendConfig.isTest ? 'sandbox' : 'live',
    },
    darajaB2c: {
      configured: darajaB2cReady,
      live: darajaB2cReady && params.darajaConfig.environment === 'production',
      mode: !darajaB2cReady ? 'not_configured' : params.darajaConfig.environment,
    },
    anyLiveGatewayConfigured: paystackReady || intasendReady || darajaB2cReady,
  };
}

async function executePaystackTransfer(
  withdrawal: WithdrawalRecord,
  config: LivePaystackConfig
): Promise<LiveTransferOutcome> {
  if (!config.secretKey) {
    throw new Error('Paystack Secret Key is not configured.');
  }
  if (withdrawal.method !== 'M-PESA' && withdrawal.method !== 'Airtel / MTN MoMo') {
    throw new Error(`Paystack automated mobile transfer supports M-PESA / Mobile Money. For ${withdrawal.method}, disburse manually and enter receipt code.`);
  }

  const { currency, amountLocal } = getLocalConversion(withdrawal.countryCode || 'KE', withdrawal.amountUsd);
  const paystackCurrency = currency === 'KES' ? 'KES' : 'KES';
  const kesAmount = currency === 'KES' ? amountLocal : Math.max(1, Math.round(withdrawal.amountUsd * 130));
  const accountNumber = normalizePhoneForPaystackKenya(withdrawal.accountDetails);

  if (accountNumber.length < 9) {
    throw new Error(`Invalid recipient mobile number "${withdrawal.accountDetails}" for Paystack transfer.`);
  }

  const bankCode = withdrawal.method === 'M-PESA' ? 'MPESA' : 'AIRTEL';
  const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'mobile_money',
      name: withdrawal.customerName || withdrawal.accountDetails,
      account_number: accountNumber,
      bank_code: bankCode,
      currency: paystackCurrency,
    }),
  });

  const recipientData: any = await recipientRes.json();
  if (!recipientRes.ok || !recipientData?.status || !recipientData?.data?.recipient_code) {
    throw new Error(recipientData?.message || 'Paystack failed to create mobile money transfer recipient.');
  }

  const reference = `GGT_${withdrawal.id.replace(/[^A-Za-z0-9_-]/g, '')}_${Date.now()}`;
  const transferRes = await fetch('https://api.paystack.co/transfer', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source: 'balance',
      amount: Math.round(kesAmount * 100),
      recipient: recipientData.data.recipient_code,
      reason: `Gideon Global Tasks Payout (${withdrawal.id})`,
      reference,
      currency: paystackCurrency,
    }),
  });

  const transferData: any = await transferRes.json();
  if (!transferRes.ok || !transferData?.status) {
    throw new Error(
      transferData?.message ||
        'Paystack Transfer rejected. Check your Paystack Transfer Balance and OTP settings.'
    );
  }

  const transferCode = transferData.data?.transfer_code || transferData.data?.reference || reference;
  return {
    gateway: 'paystack',
    receiptCode: String(transferCode),
    disbursementChannel: config.isTest ? 'Paystack Transfer (Test)' : 'Paystack Live Transfer',
    currency: paystackCurrency,
    amountLocal: kesAmount,
    gatewayStatus: String(transferData.data?.status || 'success'),
    isSandboxOrTest: config.isTest,
  };
}

async function executeIntasendTransfer(
  withdrawal: WithdrawalRecord,
  config: LiveIntasendConfig
): Promise<LiveTransferOutcome> {
  if (!config.secretKey) {
    throw new Error('IntaSend Secret Key is not configured.');
  }
  if (withdrawal.method !== 'M-PESA' && withdrawal.method !== 'Airtel / MTN MoMo') {
    throw new Error(`IntaSend automated B2C supports M-PESA / Mobile Money. For ${withdrawal.method}, settle manually with a receipt code.`);
  }

  const kesAmount = Math.max(1, Math.round(withdrawal.amountUsd * 130));
  const cleanPhone = normalizePhoneForMpesa254(withdrawal.accountDetails);
  if (cleanPhone.length < 10) {
    throw new Error(`Invalid East Africa mobile number "${withdrawal.accountDetails}" for IntaSend B2C.`);
  }

  const baseUrl = config.isTest ? 'https://sandbox.intasend.com' : 'https://payment.intasend.com';
  const initRes = await fetch(`${baseUrl}/api/v1/send-money/initiate/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.secretKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      currency: 'KES',
      provider: 'MPESA-B2C',
      transactions: [
        {
          name: withdrawal.customerName || 'Gideon Contributor',
          account: cleanPhone,
          amount: String(kesAmount),
          narrative: `Gideon Payout ${withdrawal.id}`,
        },
      ],
    }),
  });

  const initData: any = await initRes.json();
  if (!initRes.ok) {
    throw new Error(
      initData?.errors?.[0]?.message ||
        initData?.detail ||
        initData?.message ||
        'IntaSend Send Money initiation failed. Check your IntaSend wallet float.'
    );
  }

  // Approve batch if IntaSend returned tracking_id awaiting approval
  let finalData: any = initData;
  if (initData?.tracking_id) {
    const approveRes = await fetch(`${baseUrl}/api/v1/send-money/approve/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(initData),
    });
    const approveJson: any = await approveRes.json().catch(() => null);
    if (!approveRes.ok) {
      throw new Error(
        approveJson?.errors?.[0]?.message ||
          approveJson?.detail ||
          'IntaSend B2C batch approval failed. Ensure your IntaSend wallet has sufficient KES balance.'
      );
    }
    if (approveJson) finalData = approveJson;
  }

  const ref =
    finalData?.transactions?.[0]?.transaction_id ||
    finalData?.tracking_id ||
    initData?.tracking_id ||
    `IS-B2C-${Date.now()}`;

  return {
    gateway: 'intasend',
    receiptCode: String(ref),
    disbursementChannel: config.isTest ? 'IntaSend B2C (Sandbox)' : 'IntaSend Live M-PESA B2C',
    currency: 'KES',
    amountLocal: kesAmount,
    gatewayStatus: String(finalData?.status || 'completed'),
    isSandboxOrTest: config.isTest,
  };
}

async function executeDarajaB2cTransfer(
  withdrawal: WithdrawalRecord,
  config: LiveDarajaConfig,
  getDarajaToken: () => Promise<string | null>
): Promise<LiveTransferOutcome> {
  if (!config.consumerKey || !config.consumerSecret || !config.initiatorName || !config.securityCredential) {
    throw new Error(
      'Safaricom Daraja B2C requires Consumer Key, Consumer Secret, Initiator Name, and Security Credential.'
    );
  }

  const token = await getDarajaToken();
  if (!token) {
    throw new Error('Could not obtain Safaricom Daraja OAuth access token.');
  }

  const kesAmount = Math.max(1, Math.round(withdrawal.amountUsd * 130));
  const cleanPhone = normalizePhoneForMpesa254(withdrawal.accountDetails);
  if (cleanPhone.length < 10) {
    throw new Error(`Invalid M-PESA number "${withdrawal.accountDetails}" for Daraja B2C.`);
  }

  const baseUrl =
    config.environment === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  const resultUrl =
    config.b2cResultUrl || 'https://gideon-global-tasks.ai.studio/api/mpesa/b2c/result';

  const b2cRes = await fetch(`${baseUrl}/mpesa/b2c/v3/paymentrequest`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      OriginatorConversationID: `${withdrawal.id}_${Date.now()}`,
      InitiatorName: config.initiatorName,
      SecurityCredential: config.securityCredential,
      CommandID: 'BusinessPayment',
      Amount: kesAmount,
      PartyA: config.b2cShortCode || config.businessShortCode,
      PartyB: cleanPhone,
      Remarks: `Gideon Tasks Payout ${withdrawal.id}`,
      QueueTimeOutURL: resultUrl,
      ResultURL: resultUrl,
      Occasion: withdrawal.id,
    }),
  });

  const b2cData: any = await b2cRes.json();
  if (!b2cRes.ok || (b2cData?.ResponseCode && b2cData.ResponseCode !== '0')) {
    throw new Error(
      b2cData?.errorMessage || b2cData?.ResponseDescription || 'Safaricom Daraja B2C payment request failed.'
    );
  }

  return {
    gateway: 'daraja',
    receiptCode: String(b2cData?.ConversationID || b2cData?.OriginatorConversationID || `DARAJA-${Date.now()}`),
    disbursementChannel:
      config.environment === 'production' ? 'Safaricom Daraja Live B2C' : 'Safaricom Daraja B2C (Sandbox)',
    currency: 'KES',
    amountLocal: kesAmount,
    gatewayStatus: String(b2cData?.ResponseDescription || 'Accepted for processing'),
    isSandboxOrTest: config.environment !== 'production',
  };
}

export async function executeLiveOutboundTransfer(params: {
  withdrawal: WithdrawalRecord;
  gatewayMode?: PayoutGatewayMode;
  manualReceiptCode?: string;
  paystackConfig: LivePaystackConfig;
  intasendConfig: LiveIntasendConfig;
  darajaConfig: LiveDarajaConfig;
  getDarajaToken: () => Promise<string | null>;
}): Promise<LiveTransferOutcome> {
  const mode: PayoutGatewayMode = params.gatewayMode || 'auto';
  const trimmedReceipt = (params.manualReceiptCode || '').trim();

  if (mode === 'manual' || trimmedReceipt) {
    if (trimmedReceipt.length < 4) {
      throw new Error(
        'Enter the real M-PESA or Bank transaction receipt code (min 4 characters) when settling manually.'
      );
    }
    const local = getLocalConversion(params.withdrawal.countryCode || 'KE', params.withdrawal.amountUsd);
    return {
      gateway: 'manual',
      receiptCode: trimmedReceipt,
      disbursementChannel: `${params.withdrawal.method} (Owner Manual Transfer)`,
      currency: local.currency,
      amountLocal: local.amountLocal,
      gatewayStatus: 'manual_verified',
      isSandboxOrTest: false,
    };
  }

  if (mode === 'paystack') {
    return executePaystackTransfer(params.withdrawal, params.paystackConfig);
  }
  if (mode === 'intasend') {
    return executeIntasendTransfer(params.withdrawal, params.intasendConfig);
  }
  if (mode === 'daraja') {
    return executeDarajaB2cTransfer(params.withdrawal, params.darajaConfig, params.getDarajaToken);
  }

  // 'auto': prefer live production gateway with configured secret keys first, then configured test/sandbox keys
  const readiness = getGatewayReadiness(params);
  if (readiness.paystack.live) {
    return executePaystackTransfer(params.withdrawal, params.paystackConfig);
  }
  if (readiness.intasend.live) {
    return executeIntasendTransfer(params.withdrawal, params.intasendConfig);
  }
  if (readiness.darajaB2c.live) {
    return executeDarajaB2cTransfer(params.withdrawal, params.darajaConfig, params.getDarajaToken);
  }
  if (readiness.paystack.configured) {
    return executePaystackTransfer(params.withdrawal, params.paystackConfig);
  }
  if (readiness.intasend.configured) {
    return executeIntasendTransfer(params.withdrawal, params.intasendConfig);
  }
  if (readiness.darajaB2c.configured) {
    return executeDarajaB2cTransfer(params.withdrawal, params.darajaConfig, params.getDarajaToken);
  }

  throw new Error(
    'No payout gateway credentials configured. Add live Paystack, IntaSend, or Safaricom Daraja B2C keys in the Owner Portal—or pay via M-PESA manually and enter the real M-PESA receipt code.'
  );
}
