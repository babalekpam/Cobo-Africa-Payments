export interface Currency {
  code: string;
  name: string;
  symbol: string;
  flag: string;
  country: string;
}

export const CURRENCIES: Currency[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', flag: '🇺🇸', country: 'United States' },
  { code: 'EUR', name: 'Euro', symbol: '€', flag: '🇪🇺', country: 'European Union' },
  { code: 'GBP', name: 'British Pound', symbol: '£', flag: '🇬🇧', country: 'United Kingdom' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', flag: '🇳🇬', country: 'Nigeria' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', flag: '🇰🇪', country: 'Kenya' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: 'GH₵', flag: '🇬🇭', country: 'Ghana' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', flag: '🇿🇦', country: 'South Africa' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', flag: '🇺🇬', country: 'Uganda' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', flag: '🇹🇿', country: 'Tanzania' },
  { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br', flag: '🇪🇹', country: 'Ethiopia' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', flag: '🇪🇬', country: 'Egypt' },
  { code: 'XOF', name: 'West African CFA Franc', symbol: 'CFA', flag: '🌍', country: 'West Africa' },
  { code: 'XAF', name: 'Central African CFA Franc', symbol: 'FCFA', flag: '🌍', country: 'Central Africa' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', flag: '🇲🇦', country: 'Morocco' },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF', flag: '🇷🇼', country: 'Rwanda' },
  { code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', flag: '🇿🇲', country: 'Zambia' },
  { code: 'BWP', name: 'Botswana Pula', symbol: 'P', flag: '🇧🇼', country: 'Botswana' },
  { code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', flag: '🇲🇼', country: 'Malawi' },
  { code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', flag: '🇲🇿', country: 'Mozambique' },
  { code: 'SZL', name: 'Swazi Lilangeni', symbol: 'L', flag: '🇸🇿', country: 'Eswatini' },
];

export const MOBILE_PROVIDERS: Record<string, string[]> = {
  NG: ['MTN Mobile Money', 'Airtel Money', 'Opay', 'PalmPay', 'Moniepoint'],
  KE: ['M-Pesa', 'Airtel Money', 'T-Kash'],
  GH: ['MTN MoMo', 'Vodafone Cash', 'AirtelTigo Money'],
  ZA: ['MTN MoMo', 'Standard Bank Instant Money', 'FNB eWallet'],
  UG: ['MTN MoMo', 'Airtel Money', 'Yo! Payments'],
  TZ: ['M-Pesa', 'Tigo Cash', 'Airtel Money', 'HaloPesa'],
  ET: ['Telebirr', 'CBE Birr'],
  RW: ['MTN MoMo', 'Airtel Money'],
  SN: ['Orange Money', 'Wave', 'Free Money'],
  CI: ['Orange Money', 'MTN MoMo', 'Moov Money'],
};

export const COUNTRIES = [
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', dialCode: '+234' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', dialCode: '+254' },
  { code: 'GH', name: 'Ghana', flag: '🇬🇭', dialCode: '+233' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', dialCode: '+27' },
  { code: 'UG', name: 'Uganda', flag: '🇺🇬', dialCode: '+256' },
  { code: 'TZ', name: 'Tanzania', flag: '🇹🇿', dialCode: '+255' },
  { code: 'ET', name: 'Ethiopia', flag: '🇪🇹', dialCode: '+251' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', dialCode: '+20' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', dialCode: '+212' },
  { code: 'SN', name: 'Senegal', flag: '🇸🇳', dialCode: '+221' },
  { code: 'CI', name: 'Ivory Coast', flag: '🇨🇮', dialCode: '+225' },
  { code: 'RW', name: 'Rwanda', flag: '🇷🇼', dialCode: '+250' },
  { code: 'ZM', name: 'Zambia', flag: '🇿🇲', dialCode: '+260' },
  { code: 'BW', name: 'Botswana', flag: '🇧🇼', dialCode: '+267' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', dialCode: '+44' },
  { code: 'US', name: 'United States', flag: '🇺🇸', dialCode: '+1' },
  { code: 'FR', name: 'France', flag: '🇫🇷', dialCode: '+33' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', dialCode: '+49' },
  { code: 'CN', name: 'China', flag: '🇨🇳', dialCode: '+86' },
  { code: 'IN', name: 'India', flag: '🇮🇳', dialCode: '+91' },
];

export function getCurrencyByCode(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code);
}

export function formatBalance(amount: number, currencyCode: string): string {
  const currency = getCurrencyByCode(currencyCode);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${currency?.symbol || currencyCode} ${formatted}`;
}
