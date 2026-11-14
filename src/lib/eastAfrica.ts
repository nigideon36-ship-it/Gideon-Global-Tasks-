export interface EastAfricaCountry {
  code: 'KE' | 'UG' | 'TZ' | 'RW' | 'BI' | 'SS' | 'ET' | 'SO';
  name: string;
  dialCode: string;
  currency: string;
  approxRatePerUsd: number;
  mobileRails: string;
  timezone: string;
  samplePhone: string;
}

export const EAST_AFRICA_COUNTRIES: EastAfricaCountry[] = [
  {
    code: 'KE',
    name: 'Kenya',
    dialCode: '+254',
    currency: 'KES',
    approxRatePerUsd: 130,
    mobileRails: 'Safaricom M-PESA & Airtel Money',
    timezone: 'Africa/Nairobi',
    samplePhone: '+254 712 345 678',
  },
  {
    code: 'UG',
    name: 'Uganda',
    dialCode: '+256',
    currency: 'UGX',
    approxRatePerUsd: 3700,
    mobileRails: 'MTN MoMo & Airtel Money',
    timezone: 'Africa/Kampala',
    samplePhone: '+256 772 345 678',
  },
  {
    code: 'TZ',
    name: 'Tanzania',
    dialCode: '+255',
    currency: 'TZS',
    approxRatePerUsd: 2650,
    mobileRails: 'M-Pesa TZ, Tigo Pesa & Airtel Money',
    timezone: 'Africa/Dar_es_Salaam',
    samplePhone: '+255 754 345 678',
  },
  {
    code: 'RW',
    name: 'Rwanda',
    dialCode: '+250',
    currency: 'RWF',
    approxRatePerUsd: 1350,
    mobileRails: 'MTN MoMo & Airtel Money',
    timezone: 'Africa/Kigali',
    samplePhone: '+250 788 345 678',
  },
  {
    code: 'BI',
    name: 'Burundi',
    dialCode: '+257',
    currency: 'BIF',
    approxRatePerUsd: 2900,
    mobileRails: 'Lumicash & EcoCash',
    timezone: 'Africa/Bujumbura',
    samplePhone: '+257 79 345 678',
  },
  {
    code: 'SS',
    name: 'South Sudan',
    dialCode: '+211',
    currency: 'SSP',
    approxRatePerUsd: 1300,
    mobileRails: 'm-Gurush & MTN MoMo',
    timezone: 'Africa/Juba',
    samplePhone: '+211 922 345 678',
  },
  {
    code: 'ET',
    name: 'Ethiopia',
    dialCode: '+251',
    currency: 'ETB',
    approxRatePerUsd: 120,
    mobileRails: 'Telebirr & M-PESA ET',
    timezone: 'Africa/Addis_Ababa',
    samplePhone: '+251 911 345 678',
  },
  {
    code: 'SO',
    name: 'Somalia',
    dialCode: '+252',
    currency: 'SOS',
    approxRatePerUsd: 570,
    mobileRails: 'EVC Plus & Zaad Service',
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

export function convertKesToUsd(kesAmount: number): number {
  return +(kesAmount / KES_PER_USD).toFixed(2);
}

export function convertKesToLocal(kesAmount: number, country: EastAfricaCountry): number {
  if (country.code === 'KE') return Math.round(kesAmount);
  return Math.max(1, Math.round((kesAmount * country.approxRatePerUsd) / KES_PER_USD));
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
