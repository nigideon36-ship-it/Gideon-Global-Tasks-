export interface EastAfricaCountry {
  code: 'KE' | 'UG' | 'TZ' | 'RW' | 'BI' | 'SS' | 'ET' | 'SO';
  name: string;
  dialCode: string;
  currency: string;
  symbol: string;
  approxRatePerUsd: number;
  mobileRails: string;
  idDocumentName: string;
  idNumberHint: string;
  timezone: string;
  samplePhone: string;
}

export const EAST_AFRICA_COUNTRIES: EastAfricaCountry[] = [
  {
    code: 'KE',
    name: 'Kenya',
    dialCode: '+254',
    currency: 'KES',
    symbol: 'KSh',
    approxRatePerUsd: 130,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'Kenyan National ID (Kitambulisho)',
    idNumberHint: '8-digit National ID or Maisha Namba',
    timezone: 'Africa/Nairobi',
    samplePhone: '+254 712 345 678',
  },
  {
    code: 'UG',
    name: 'Uganda',
    dialCode: '+256',
    currency: 'UGX',
    symbol: 'USh',
    approxRatePerUsd: 3700,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'Uganda NIRA National ID Card',
    idNumberHint: '14-character NIN (e.g. CM90...)',
    timezone: 'Africa/Kampala',
    samplePhone: '+256 772 345 678',
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    dialCode: '+255',
    currency: 'TZS',
    symbol: 'TSh',
    approxRatePerUsd: 2650,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'Tanzania NIDA National ID (Kitambulisho cha Taifa)',
    idNumberHint: '20-digit NIDA Number',
    timezone: 'Africa/Dar_es_Salaam',
    samplePhone: '+255 754 345 678',
  },
  {
    code: 'RW',
    name: 'Rwanda',
    dialCode: '+250',
    currency: 'RWF',
    symbol: 'FRw',
    approxRatePerUsd: 1350,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'Rwanda Indangamuntu (NIDA National ID)',
    idNumberHint: '16-digit National ID Number',
    timezone: 'Africa/Kigali',
    samplePhone: '+250 788 345 678',
  },
  {
    code: 'BI',
    name: 'Burundi',
    dialCode: '+257',
    currency: 'BIF',
    symbol: 'FBu',
    approxRatePerUsd: 2900,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: "Burundi Carte Nationale d'Identité (CNI)",
    idNumberHint: 'CNI Number',
    timezone: 'Africa/Bujumbura',
    samplePhone: '+257 79 345 678',
  },
  {
    code: 'SS',
    name: 'South Sudan',
    dialCode: '+211',
    currency: 'SSP',
    symbol: 'SSP',
    approxRatePerUsd: 1300,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'South Sudan National ID Card',
    idNumberHint: 'Nationality / National ID Number',
    timezone: 'Africa/Juba',
    samplePhone: '+211 922 345 678',
  },
  {
    code: 'ET',
    name: 'Ethiopia',
    dialCode: '+251',
    currency: 'ETB',
    symbol: 'Br',
    approxRatePerUsd: 120,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'Ethiopia Fayda National ID / Kebele ID',
    idNumberHint: 'Fayda FIN or Kebele ID Number',
    timezone: 'Africa/Addis_Ababa',
    samplePhone: '+251 911 345 678',
  },
  {
    code: 'SO',
    name: 'Somalia',
    dialCode: '+252',
    currency: 'SOS',
    symbol: 'Sh.So.',
    approxRatePerUsd: 570,
    mobileRails: 'PayPal (Global & East Africa Payouts)',
    idDocumentName: 'Somalia National ID Card (NIRA ID)',
    idNumberHint: '11-digit NIRA ID Number',
    timezone: 'Africa/Mogadishu',
    samplePhone: '+252 615 345 678',
  },
];

export const EAST_AFRICA_COUNTRY_CODES = new Set<string>(
  EAST_AFRICA_COUNTRIES.map((c) => c.code)
);

export const EAST_AFRICA_TIMEZONES = new Set<string>(
  EAST_AFRICA_COUNTRIES.map((c) => c.timezone)
);

const DIAL_PREFIXES = ['254', '256', '255', '250', '257', '211', '251', '252'];

export function isEastAfricaCountryCode(code?: string | null): boolean {
  if (!code) return false;
  return EAST_AFRICA_COUNTRY_CODES.has(code.trim().toUpperCase());
}

export function getCountryByCode(code?: string | null): EastAfricaCountry {
  const upper = (code || 'KE').trim().toUpperCase();
  return EAST_AFRICA_COUNTRIES.find((c) => c.code === upper) || EAST_AFRICA_COUNTRIES[0];
}

export function isEastAfricaPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-().]/g, '');
  if (!cleaned) return false;
  if (/^0[17689]\d{7,9}$/.test(cleaned)) {
    return true;
  }
  const withoutPlus = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
  return DIAL_PREFIXES.some((prefix) => withoutPlus.startsWith(prefix)) && withoutPlus.length >= 10 && withoutPlus.length <= 15;
}

export const KES_PER_USD = 130;
export const WITHDRAWAL_THRESHOLD_KES = 150;
export const WITHDRAWAL_THRESHOLD_USD = +(WITHDRAWAL_THRESHOLD_KES / KES_PER_USD).toFixed(4); // 1.1538 USD = KSh 150
export const PPV_RATE_PER_VIEW_KES = 5;
export const PPV_STATUS_DURATION_HOURS = 24;

export function meetsWithdrawalThreshold(usdAmount: number): boolean {
  const n = Number(usdAmount);
  if (!Number.isFinite(n)) return false;
  return n + 0.002 >= WITHDRAWAL_THRESHOLD_USD;
}

export function convertKesToUsd(kesAmount: number): number {
  return +(Math.max(0, Number(kesAmount) || 0) / KES_PER_USD).toFixed(4);
}

export function convertKesToLocal(kesAmount: number, country: EastAfricaCountry): number {
  const safeKes = Math.max(0, Number(kesAmount) || 0);
  if (safeKes === 0) return 0;
  if (country.code === 'KE') return Math.round(safeKes);
  return Math.max(1, Math.round((safeKes * country.approxRatePerUsd) / KES_PER_USD));
}

export function convertUsdToLocal(usdAmount: number, country: EastAfricaCountry): number {
  const safeUsd = Math.max(0, Number(usdAmount) || 0);
  if (safeUsd === 0) return 0;
  return Math.round(safeUsd * country.approxRatePerUsd);
}

export function localAmountToUsd(localAmount: number, country: EastAfricaCountry): number {
  const safeLocal = Math.max(0, Number(localAmount) || 0);
  if (safeLocal === 0) return 0;
  return +(safeLocal / country.approxRatePerUsd).toFixed(4);
}

export function formatCurrencyFromUsd(usdAmount: number, country: EastAfricaCountry = EAST_AFRICA_COUNTRIES[0]): string {
  return `${country.symbol} ${convertUsdToLocal(usdAmount, country).toLocaleString()}`;
}

export function formatCurrencyFromKes(kesAmount: number, country: EastAfricaCountry = EAST_AFRICA_COUNTRIES[0]): string {
  return `${country.symbol} ${convertKesToLocal(kesAmount, country).toLocaleString()}`;
}

export function detectEastAfricaFromTimezone(): EastAfricaCountry | null {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const match = EAST_AFRICA_COUNTRIES.find((c) => c.timezone === tz);
    return match || null;
  } catch {
    return null;
  }
}
