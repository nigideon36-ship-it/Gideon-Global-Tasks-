import { EAST_AFRICA_COUNTRIES } from './eastAfrica.ts';
import type { WithdrawalRecord } from './withdrawalsStore.ts';

export type PayoutGatewayMode = 'auto' | 'paypal' | 'manual';

export interface LiveTransferOutcome {
  gateway: 'paypal' | 'manual';
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

function getPayPalApiConfig() {
  const clientId = (process.env.PAYPAL_CLIENT_ID || '').trim();
  const clientSecret = (process.env.PAYPAL_CLIENT_SECRET || '').trim();
  const mode = (process.env.PAYPAL_MODE || 'live').trim().toLowerCase() === 'sandbox' ? 'sandbox' : 'live';
  return {
    clientId,
    clientSecret,
    mode,
    configured: Boolean(clientId && clientSecret),
  };
}

export function getGatewayReadiness() {
  const pp = getPayPalApiConfig();
  return {
    paypal: {
      configured: pp.configured,
      live: pp.configured && pp.mode === 'live',
      mode: !pp.configured ? 'manual_ready' : pp.mode,
    },
    anyLiveGatewayConfigured: pp.configured,
  };
}

async function executePayPalPayout(withdrawal: WithdrawalRecord): Promise<LiveTransferOutcome> {
  const pp = getPayPalApiConfig();
  if (!pp.configured) {
    throw new Error(
      'PayPal Payouts REST API keys (PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET) are not configured. Send the payout directly from your PayPal Business account and enter the PayPal Transaction ID to approve.'
    );
  }

  const recipientEmail = String(withdrawal.accountDetails || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(recipientEmail)) {
    throw new Error(
      `Invalid PayPal recipient email "${withdrawal.accountDetails}". A valid PayPal email address is required for PayPal Payouts.`
    );
  }

  const baseUrl = pp.mode === 'sandbox' ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';
  const authHeader = Buffer.from(`${pp.clientId}:${pp.clientSecret}`).toString('base64');

  const tokenRes = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${authHeader}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  const tokenData: any = await tokenRes.json().catch(() => null);
  if (!tokenRes.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error_description || 'Could not authenticate with PayPal REST API.');
  }

  const amountUsd = Math.max(0.5, Number(withdrawal.amountUsd || 0)).toFixed(2);
  const senderBatchId = `GGT_${withdrawal.id.replace(/[^A-Za-z0-9_-]/g, '')}_${Date.now()}`;

  const payoutRes = await fetch(`${baseUrl}/v1/payments/payouts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: 'You received a payout from Gideon Global Tasks',
        email_message: `Your withdrawal (${withdrawal.id}) has been disbursed via PayPal.`,
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: {
            value: amountUsd,
            currency: 'USD',
          },
          note: `Gideon Global Tasks Payout (${withdrawal.id})`,
          sender_item_id: withdrawal.id,
          receiver: recipientEmail,
        },
      ],
    }),
  });

  const payoutData: any = await payoutRes.json().catch(() => null);
  if (!payoutRes.ok) {
    throw new Error(
      payoutData?.message ||
        payoutData?.details?.[0]?.issue ||
        'PayPal Payouts API rejected transfer. Ensure PayPal Payouts is enabled or enter a manual PayPal Transaction ID.'
    );
  }

  const batchId = payoutData?.batch_header?.payout_batch_id || senderBatchId;
  const local = getLocalConversion(withdrawal.countryCode || 'KE', withdrawal.amountUsd);

  return {
    gateway: 'paypal',
    receiptCode: String(batchId),
    disbursementChannel: pp.mode === 'sandbox' ? 'PayPal Payouts API (Sandbox)' : 'PayPal Live Payout',
    currency: 'USD',
    amountLocal: Number(amountUsd) || local.amountLocal,
    gatewayStatus: String(payoutData?.batch_header?.batch_status || 'PENDING'),
    isSandboxOrTest: pp.mode === 'sandbox',
  };
}

export async function executeLiveOutboundTransfer(params: {
  withdrawal: WithdrawalRecord;
  gatewayMode?: PayoutGatewayMode;
  manualReceiptCode?: string;
}): Promise<LiveTransferOutcome> {
  const mode: PayoutGatewayMode = params.gatewayMode || 'auto';
  const trimmedReceipt = (params.manualReceiptCode || '').trim();

  if (mode === 'manual' || trimmedReceipt) {
    if (trimmedReceipt.length < 4) {
      throw new Error(
        'Enter the real PayPal Transaction ID or batch receipt code (min 4 characters) when settling manually.'
      );
    }
    const local = getLocalConversion(params.withdrawal.countryCode || 'KE', params.withdrawal.amountUsd);
    return {
      gateway: 'manual',
      receiptCode: trimmedReceipt,
      disbursementChannel: 'PayPal (Owner Verified Transfer)',
      currency: local.currency,
      amountLocal: local.amountLocal,
      gatewayStatus: 'paypal_manual_verified',
      isSandboxOrTest: false,
    };
  }

  if (mode === 'paypal' || mode === 'auto') {
    const pp = getPayPalApiConfig();
    if (pp.configured) {
      return executePayPalPayout(params.withdrawal);
    }
  }

  throw new Error(
    'PayPal Payouts API credentials are not configured yet. Send the funds to the customer PayPal email in PayPal and paste the PayPal Transaction ID to complete approval.'
  );
}
