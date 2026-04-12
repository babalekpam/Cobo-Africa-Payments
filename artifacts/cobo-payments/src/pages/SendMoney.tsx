import { useState, useEffect, useMemo } from "react";
import { Layout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import api from "../lib/api";

type Tab = "bank" | "mobile" | "internal";

const ALL_COUNTRIES = [
  { code: "US", name: "United States", currency: "USD", flag: "🇺🇸", dialCode: "+1", region: "americas" },
  { code: "CA", name: "Canada", currency: "CAD", flag: "🇨🇦", dialCode: "+1", region: "americas" },
  { code: "GB", name: "United Kingdom", currency: "GBP", flag: "🇬🇧", dialCode: "+44", region: "europe" },
  { code: "FR", name: "France", currency: "EUR", flag: "🇫🇷", dialCode: "+33", region: "europe" },
  { code: "DE", name: "Germany", currency: "EUR", flag: "🇩🇪", dialCode: "+49", region: "europe" },
  { code: "NL", name: "Netherlands", currency: "EUR", flag: "🇳🇱", dialCode: "+31", region: "europe" },
  { code: "BE", name: "Belgium", currency: "EUR", flag: "🇧🇪", dialCode: "+32", region: "europe" },
  { code: "IT", name: "Italy", currency: "EUR", flag: "🇮🇹", dialCode: "+39", region: "europe" },
  { code: "ES", name: "Spain", currency: "EUR", flag: "🇪🇸", dialCode: "+34", region: "europe" },
  { code: "PT", name: "Portugal", currency: "EUR", flag: "🇵🇹", dialCode: "+351", region: "europe" },
  { code: "CH", name: "Switzerland", currency: "CHF", flag: "🇨🇭", dialCode: "+41", region: "europe" },
  { code: "SE", name: "Sweden", currency: "SEK", flag: "🇸🇪", dialCode: "+46", region: "europe" },
  { code: "NO", name: "Norway", currency: "NOK", flag: "🇳🇴", dialCode: "+47", region: "europe" },
  { code: "DK", name: "Denmark", currency: "DKK", flag: "🇩🇰", dialCode: "+45", region: "europe" },
  { code: "IE", name: "Ireland", currency: "EUR", flag: "🇮🇪", dialCode: "+353", region: "europe" },
  { code: "AT", name: "Austria", currency: "EUR", flag: "🇦🇹", dialCode: "+43", region: "europe" },
  { code: "PL", name: "Poland", currency: "PLN", flag: "🇵🇱", dialCode: "+48", region: "europe" },
  { code: "CZ", name: "Czech Republic", currency: "CZK", flag: "🇨🇿", dialCode: "+420", region: "europe" },
  { code: "NG", name: "Nigeria", currency: "NGN", flag: "🇳🇬", dialCode: "+234", region: "africa" },
  { code: "GH", name: "Ghana", currency: "GHS", flag: "🇬🇭", dialCode: "+233", region: "africa" },
  { code: "KE", name: "Kenya", currency: "KES", flag: "🇰🇪", dialCode: "+254", region: "africa" },
  { code: "ZA", name: "South Africa", currency: "ZAR", flag: "🇿🇦", dialCode: "+27", region: "africa" },
  { code: "TZ", name: "Tanzania", currency: "TZS", flag: "🇹🇿", dialCode: "+255", region: "africa" },
  { code: "UG", name: "Uganda", currency: "UGX", flag: "🇺🇬", dialCode: "+256", region: "africa" },
  { code: "SN", name: "Senegal", currency: "XOF", flag: "🇸🇳", dialCode: "+221", region: "africa" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF", flag: "🇨🇮", dialCode: "+225", region: "africa" },
  { code: "CM", name: "Cameroon", currency: "XAF", flag: "🇨🇲", dialCode: "+237", region: "africa" },
  { code: "RW", name: "Rwanda", currency: "RWF", flag: "🇷🇼", dialCode: "+250", region: "africa" },
  { code: "ET", name: "Ethiopia", currency: "ETB", flag: "🇪🇹", dialCode: "+251", region: "africa" },
  { code: "EG", name: "Egypt", currency: "EGP", flag: "🇪🇬", dialCode: "+20", region: "africa" },
  { code: "MA", name: "Morocco", currency: "MAD", flag: "🇲🇦", dialCode: "+212", region: "africa" },
  { code: "TN", name: "Tunisia", currency: "TND", flag: "🇹🇳", dialCode: "+216", region: "africa" },
  { code: "DZ", name: "Algeria", currency: "DZD", flag: "🇩🇿", dialCode: "+213", region: "africa" },
  { code: "CD", name: "DR Congo", currency: "CDF", flag: "🇨🇩", dialCode: "+243", region: "africa" },
  { code: "AO", name: "Angola", currency: "AOA", flag: "🇦🇴", dialCode: "+244", region: "africa" },
  { code: "MZ", name: "Mozambique", currency: "MZN", flag: "🇲🇿", dialCode: "+258", region: "africa" },
  { code: "ZM", name: "Zambia", currency: "ZMW", flag: "🇿🇲", dialCode: "+260", region: "africa" },
  { code: "MW", name: "Malawi", currency: "MWK", flag: "🇲🇼", dialCode: "+265", region: "africa" },
  { code: "BW", name: "Botswana", currency: "BWP", flag: "🇧🇼", dialCode: "+267", region: "africa" },
  { code: "GM", name: "Gambia", currency: "GMD", flag: "🇬🇲", dialCode: "+220", region: "africa" },
  { code: "SL", name: "Sierra Leone", currency: "SLL", flag: "🇸🇱", dialCode: "+232", region: "africa" },
  { code: "GN", name: "Guinea", currency: "GNF", flag: "🇬🇳", dialCode: "+224", region: "africa" },
  { code: "ML", name: "Mali", currency: "XOF", flag: "🇲🇱", dialCode: "+223", region: "africa" },
  { code: "BF", name: "Burkina Faso", currency: "XOF", flag: "🇧🇫", dialCode: "+226", region: "africa" },
  { code: "NE", name: "Niger", currency: "XOF", flag: "🇳🇪", dialCode: "+227", region: "africa" },
  { code: "TG", name: "Togo", currency: "XOF", flag: "🇹🇬", dialCode: "+228", region: "africa" },
  { code: "BJ", name: "Benin", currency: "XOF", flag: "🇧🇯", dialCode: "+229", region: "africa" },
  { code: "GW", name: "Guinea-Bissau", currency: "XOF", flag: "🇬🇼", dialCode: "+245", region: "africa" },
  { code: "GA", name: "Gabon", currency: "XAF", flag: "🇬🇦", dialCode: "+241", region: "africa" },
  { code: "TD", name: "Chad", currency: "XAF", flag: "🇹🇩", dialCode: "+235", region: "africa" },
  { code: "CG", name: "Congo", currency: "XAF", flag: "🇨🇬", dialCode: "+242", region: "africa" },
  { code: "CF", name: "Central African Republic", currency: "XAF", flag: "🇨🇫", dialCode: "+236", region: "africa" },
  { code: "GQ", name: "Equatorial Guinea", currency: "XAF", flag: "🇬🇶", dialCode: "+240", region: "africa" },
  { code: "MG", name: "Madagascar", currency: "MGA", flag: "🇲🇬", dialCode: "+261", region: "africa" },
  { code: "MU", name: "Mauritius", currency: "MUR", flag: "🇲🇺", dialCode: "+230", region: "africa" },
  { code: "SC", name: "Seychelles", currency: "SCR", flag: "🇸🇨", dialCode: "+248", region: "africa" },
  { code: "DJ", name: "Djibouti", currency: "DJF", flag: "🇩🇯", dialCode: "+253", region: "africa" },
  { code: "SO", name: "Somalia", currency: "SOS", flag: "🇸🇴", dialCode: "+252", region: "africa" },
  { code: "SD", name: "Sudan", currency: "SDG", flag: "🇸🇩", dialCode: "+249", region: "africa" },
  { code: "SS", name: "South Sudan", currency: "SSP", flag: "🇸🇸", dialCode: "+211", region: "africa" },
  { code: "ER", name: "Eritrea", currency: "ERN", flag: "🇪🇷", dialCode: "+291", region: "africa" },
  { code: "BI", name: "Burundi", currency: "BIF", flag: "🇧🇮", dialCode: "+257", region: "africa" },
  { code: "LS", name: "Lesotho", currency: "LSL", flag: "🇱🇸", dialCode: "+266", region: "africa" },
  { code: "SZ", name: "Eswatini", currency: "SZL", flag: "🇸🇿", dialCode: "+268", region: "africa" },
  { code: "NA", name: "Namibia", currency: "NAD", flag: "🇳🇦", dialCode: "+264", region: "africa" },
  { code: "LR", name: "Liberia", currency: "LRD", flag: "🇱🇷", dialCode: "+231", region: "africa" },
  { code: "MR", name: "Mauritania", currency: "MRU", flag: "🇲🇷", dialCode: "+222", region: "africa" },
  { code: "LY", name: "Libya", currency: "LYD", flag: "🇱🇾", dialCode: "+218", region: "africa" },
  { code: "CV", name: "Cape Verde", currency: "CVE", flag: "🇨🇻", dialCode: "+238", region: "africa" },
  { code: "ST", name: "São Tomé", currency: "STN", flag: "🇸🇹", dialCode: "+239", region: "africa" },
  { code: "KM", name: "Comoros", currency: "KMF", flag: "🇰🇲", dialCode: "+269", region: "africa" },
];

const MOBILE_PROVIDERS: Record<string, { name: string; logo: string }[]> = {
  NG: [{ name: "MTN MoMo", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "9mobile Money", logo: "📱" }, { name: "Glo Mobile Money", logo: "📱" }, { name: "Opay", logo: "📱" }, { name: "PalmPay", logo: "📱" }, { name: "Paga", logo: "📱" }],
  GH: [{ name: "MTN MoMo", logo: "📱" }, { name: "Vodafone Cash", logo: "📱" }, { name: "AirtelTigo Money", logo: "📱" }, { name: "G-Money", logo: "📱" }],
  KE: [{ name: "M-Pesa", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "T-Kash", logo: "📱" }, { name: "Equitel", logo: "📱" }],
  TZ: [{ name: "M-Pesa", logo: "📱" }, { name: "Tigo Pesa", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "Halotel", logo: "📱" }, { name: "TTCL Pesa", logo: "📱" }],
  UG: [{ name: "MTN MoMo", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "M-Sente", logo: "📱" }, { name: "Micropay", logo: "📱" }],
  RW: [{ name: "MTN MoMo", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "MobiCash", logo: "📱" }],
  ZA: [{ name: "FNB eWallet", logo: "📱" }, { name: "Vodapay", logo: "📱" }, { name: "MTN MoMo", logo: "📱" }, { name: "Standard Bank Instant Money", logo: "📱" }],
  SN: [{ name: "Orange Money", logo: "📱" }, { name: "Wave", logo: "📱" }, { name: "Free Money", logo: "📱" }, { name: "E-Money", logo: "📱" }],
  CI: [{ name: "Orange Money", logo: "📱" }, { name: "MTN MoMo", logo: "📱" }, { name: "Moov Money", logo: "📱" }, { name: "Wave", logo: "📱" }],
  CM: [{ name: "MTN MoMo", logo: "📱" }, { name: "Orange Money", logo: "📱" }, { name: "Express Union Mobile", logo: "📱" }],
  ML: [{ name: "Orange Money", logo: "📱" }, { name: "Moov Money", logo: "📱" }, { name: "Wave", logo: "📱" }],
  BF: [{ name: "Orange Money", logo: "📱" }, { name: "Moov Money", logo: "📱" }, { name: "Coris Money", logo: "📱" }],
  NE: [{ name: "Airtel Money", logo: "📱" }, { name: "Orange Money", logo: "📱" }, { name: "Moov Money", logo: "📱" }],
  TG: [{ name: "T-Money", logo: "📱" }, { name: "Flooz", logo: "📱" }, { name: "Moov Money", logo: "📱" }],
  BJ: [{ name: "MTN MoMo", logo: "📱" }, { name: "Moov Money", logo: "📱" }, { name: "CeltisCash", logo: "📱" }],
  GW: [{ name: "Orange Money", logo: "📱" }, { name: "MTN MoMo", logo: "📱" }],
  CD: [{ name: "M-Pesa", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "Orange Money", logo: "📱" }, { name: "Africell Money", logo: "📱" }],
  GA: [{ name: "Airtel Money", logo: "📱" }, { name: "Moov Money", logo: "📱" }],
  TD: [{ name: "Airtel Money", logo: "📱" }, { name: "Tigo Cash", logo: "📱" }],
  CG: [{ name: "MTN MoMo", logo: "📱" }, { name: "Airtel Money", logo: "📱" }],
  CF: [{ name: "Orange Money", logo: "📱" }, { name: "Telecel Cash", logo: "📱" }],
  ET: [{ name: "Telebirr", logo: "📱" }, { name: "M-Birr", logo: "📱" }, { name: "CBE Birr", logo: "📱" }, { name: "Amole", logo: "📱" }, { name: "HelloCash", logo: "📱" }],
  EG: [{ name: "Vodafone Cash", logo: "📱" }, { name: "Fawry", logo: "📱" }, { name: "Orange Money", logo: "📱" }, { name: "Etisalat Cash", logo: "📱" }, { name: "CIB Smart Wallet", logo: "📱" }],
  MA: [{ name: "inwi Money", logo: "📱" }, { name: "Orange Money", logo: "📱" }, { name: "Barid Cash", logo: "📱" }],
  ZM: [{ name: "MTN MoMo", logo: "📱" }, { name: "Airtel Money", logo: "📱" }, { name: "Zoona", logo: "📱" }],
  MW: [{ name: "Airtel Money", logo: "📱" }, { name: "TNM Mpamba", logo: "📱" }, { name: "FDH Mobile Money", logo: "📱" }],
  MZ: [{ name: "M-Pesa", logo: "📱" }, { name: "e-Mola", logo: "📱" }, { name: "mKesh", logo: "📱" }],
  AO: [{ name: "Unitel Money", logo: "📱" }, { name: "Multicaixa Express", logo: "📱" }],
  MG: [{ name: "MVola", logo: "📱" }, { name: "Orange Money", logo: "📱" }, { name: "Airtel Money", logo: "📱" }],
  SO: [{ name: "EVC Plus", logo: "📱" }, { name: "Zaad", logo: "📱" }, { name: "Sahal", logo: "📱" }],
  GM: [{ name: "Africell Money", logo: "📱" }, { name: "QMoney", logo: "📱" }],
  SL: [{ name: "Orange Money", logo: "📱" }, { name: "Africell Money", logo: "📱" }],
  GN: [{ name: "Orange Money", logo: "📱" }, { name: "MTN MoMo", logo: "📱" }],
  LR: [{ name: "MTN MoMo", logo: "📱" }, { name: "Orange Money", logo: "📱" }],
  SD: [{ name: "Bankak", logo: "📱" }, { name: "mBok", logo: "📱" }],
  BW: [{ name: "Orange Money", logo: "📱" }, { name: "Smega", logo: "📱" }, { name: "MyZaka", logo: "📱" }],
  MU: [{ name: "MCB Juice", logo: "📱" }, { name: "my.t money", logo: "📱" }],
  NA: [{ name: "MTC Money", logo: "📱" }, { name: "E-Wallet", logo: "📱" }],
  BI: [{ name: "Lumitel MobiCash", logo: "📱" }, { name: "Ecocash", logo: "📱" }],
  TN: [{ name: "Orange Money", logo: "📱" }, { name: "Mobiflouss", logo: "📱" }, { name: "D17", logo: "📱" }],
  DZ: [{ name: "Mobilis MobiCash", logo: "📱" }, { name: "Djezzy Floussy", logo: "📱" }, { name: "CCP Baridi Mob", logo: "📱" }],
  LY: [{ name: "Sadad", logo: "📱" }, { name: "MobiCash", logo: "📱" }],
  CV: [{ name: "T+ Money", logo: "📱" }, { name: "Unitel T+ Cash", logo: "📱" }],
  ST: [{ name: "Dobra Mobile", logo: "📱" }],
  KM: [{ name: "Huri Money", logo: "📱" }, { name: "MVola", logo: "📱" }],
  DJ: [{ name: "D-Money", logo: "📱" }, { name: "Waafi", logo: "📱" }],
  SS: [{ name: "M-Gurush", logo: "📱" }, { name: "Trinity Money", logo: "📱" }],
  ER: [{ name: "Himbol", logo: "📱" }],
  LS: [{ name: "M-Pesa", logo: "📱" }, { name: "EcoCash", logo: "📱" }],
  SZ: [{ name: "MTN MoMo", logo: "📱" }, { name: "Eswatini Mobile", logo: "📱" }],
  MR: [{ name: "Masrivi", logo: "📱" }, { name: "Seddad", logo: "📱" }, { name: "BankiLy", logo: "📱" }],
  GQ: [{ name: "BGFI Mobile", logo: "📱" }, { name: "Muni", logo: "📱" }],
  SC: [{ name: "Airtel Money", logo: "📱" }, { name: "MCB Mobile", logo: "📱" }],
};

const DEFAULT_PROVIDERS = [{ name: "Bank Transfer", logo: "🏦" }];

const ALL_CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$" },
  { code: "EUR", name: "Euro", symbol: "€" },
  { code: "GBP", name: "British Pound", symbol: "£" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr" },
  { code: "DKK", name: "Danish Krone", symbol: "kr" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč" },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦" },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵" },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh" },
  { code: "ZAR", name: "South African Rand", symbol: "R" },
  { code: "XOF", name: "CFA Franc (West)", symbol: "CFA" },
  { code: "XAF", name: "CFA Franc (Central)", symbol: "FCFA" },
  { code: "TZS", name: "Tanzanian Shilling", symbol: "TSh" },
  { code: "UGX", name: "Ugandan Shilling", symbol: "USh" },
  { code: "ETB", name: "Ethiopian Birr", symbol: "Br" },
  { code: "EGP", name: "Egyptian Pound", symbol: "E£" },
  { code: "MAD", name: "Moroccan Dirham", symbol: "MAD" },
  { code: "RWF", name: "Rwandan Franc", symbol: "FRw" },
  { code: "CDF", name: "Congolese Franc", symbol: "FC" },
  { code: "AOA", name: "Angolan Kwanza", symbol: "Kz" },
  { code: "MZN", name: "Mozambican Metical", symbol: "MT" },
  { code: "ZMW", name: "Zambian Kwacha", symbol: "ZK" },
  { code: "MWK", name: "Malawian Kwacha", symbol: "MK" },
  { code: "BWP", name: "Botswana Pula", symbol: "P" },
  { code: "TND", name: "Tunisian Dinar", symbol: "DT" },
  { code: "DZD", name: "Algerian Dinar", symbol: "DA" },
  { code: "LYD", name: "Libyan Dinar", symbol: "LD" },
  { code: "SDG", name: "Sudanese Pound", symbol: "SDG" },
  { code: "GMD", name: "Gambian Dalasi", symbol: "D" },
  { code: "SLL", name: "Sierra Leonean Leone", symbol: "Le" },
  { code: "GNF", name: "Guinean Franc", symbol: "FG" },
  { code: "SOS", name: "Somali Shilling", symbol: "Sh" },
  { code: "SSP", name: "South Sudanese Pound", symbol: "SSP" },
  { code: "MGA", name: "Malagasy Ariary", symbol: "Ar" },
  { code: "MUR", name: "Mauritian Rupee", symbol: "Rs" },
  { code: "SCR", name: "Seychellois Rupee", symbol: "SCR" },
  { code: "NAD", name: "Namibian Dollar", symbol: "N$" },
  { code: "LRD", name: "Liberian Dollar", symbol: "L$" },
  { code: "BIF", name: "Burundian Franc", symbol: "FBu" },
  { code: "ERN", name: "Eritrean Nakfa", symbol: "Nfk" },
  { code: "LSL", name: "Lesotho Loti", symbol: "L" },
  { code: "SZL", name: "Eswatini Lilangeni", symbol: "E" },
  { code: "MRU", name: "Mauritanian Ouguiya", symbol: "UM" },
  { code: "CVE", name: "Cape Verdean Escudo", symbol: "CVE" },
  { code: "STN", name: "São Tomé Dobra", symbol: "Db" },
  { code: "KMF", name: "Comorian Franc", symbol: "KMF" },
  { code: "DJF", name: "Djiboutian Franc", symbol: "Fdj" },
];

const CURRENCY_INFO: Record<string, { flag: string; name: string; symbol: string }> = {
  USD: { flag: "🇺🇸", name: "US Dollar", symbol: "$" },
  EUR: { flag: "🇪🇺", name: "Euro", symbol: "€" },
  GBP: { flag: "🇬🇧", name: "British Pound", symbol: "£" },
  CAD: { flag: "🇨🇦", name: "Canadian Dollar", symbol: "C$" },
  CHF: { flag: "🇨🇭", name: "Swiss Franc", symbol: "CHF" },
  SEK: { flag: "🇸🇪", name: "Swedish Krona", symbol: "kr" },
  NOK: { flag: "🇳🇴", name: "Norwegian Krone", symbol: "kr" },
  DKK: { flag: "🇩🇰", name: "Danish Krone", symbol: "kr" },
  PLN: { flag: "🇵🇱", name: "Polish Zloty", symbol: "zł" },
  CZK: { flag: "🇨🇿", name: "Czech Koruna", symbol: "Kč" },
  NGN: { flag: "🇳🇬", name: "Nigerian Naira", symbol: "₦" },
  GHS: { flag: "🇬🇭", name: "Ghanaian Cedi", symbol: "GH₵" },
  KES: { flag: "🇰🇪", name: "Kenyan Shilling", symbol: "KSh" },
  ZAR: { flag: "🇿🇦", name: "South African Rand", symbol: "R" },
  XOF: { flag: "🏦", name: "CFA Franc (West)", symbol: "CFA" },
  XAF: { flag: "🏦", name: "CFA Franc (Central)", symbol: "FCFA" },
  TZS: { flag: "🇹🇿", name: "Tanzanian Shilling", symbol: "TSh" },
  UGX: { flag: "🇺🇬", name: "Ugandan Shilling", symbol: "USh" },
  ETB: { flag: "🇪🇹", name: "Ethiopian Birr", symbol: "Br" },
  EGP: { flag: "🇪🇬", name: "Egyptian Pound", symbol: "E£" },
  MAD: { flag: "🇲🇦", name: "Moroccan Dirham", symbol: "MAD" },
  RWF: { flag: "🇷🇼", name: "Rwandan Franc", symbol: "FRw" },
  CDF: { flag: "🇨🇩", name: "Congolese Franc", symbol: "FC" },
  AOA: { flag: "🇦🇴", name: "Angolan Kwanza", symbol: "Kz" },
  MZN: { flag: "🇲🇿", name: "Mozambican Metical", symbol: "MT" },
  ZMW: { flag: "🇿🇲", name: "Zambian Kwacha", symbol: "ZK" },
  MWK: { flag: "🇲🇼", name: "Malawian Kwacha", symbol: "MK" },
  BWP: { flag: "🇧🇼", name: "Botswana Pula", symbol: "P" },
  TND: { flag: "🇹🇳", name: "Tunisian Dinar", symbol: "DT" },
  DZD: { flag: "🇩🇿", name: "Algerian Dinar", symbol: "DA" },
  LYD: { flag: "🇱🇾", name: "Libyan Dinar", symbol: "LD" },
  SDG: { flag: "🇸🇩", name: "Sudanese Pound", symbol: "SDG" },
  GMD: { flag: "🇬🇲", name: "Gambian Dalasi", symbol: "D" },
  SLL: { flag: "🇸🇱", name: "Sierra Leonean Leone", symbol: "Le" },
  GNF: { flag: "🇬🇳", name: "Guinean Franc", symbol: "FG" },
  SOS: { flag: "🇸🇴", name: "Somali Shilling", symbol: "Sh" },
  SSP: { flag: "🇸🇸", name: "South Sudanese Pound", symbol: "SSP" },
  MGA: { flag: "🇲🇬", name: "Malagasy Ariary", symbol: "Ar" },
  MUR: { flag: "🇲🇺", name: "Mauritian Rupee", symbol: "Rs" },
  SCR: { flag: "🇸🇨", name: "Seychellois Rupee", symbol: "SCR" },
  NAD: { flag: "🇳🇦", name: "Namibian Dollar", symbol: "N$" },
  LRD: { flag: "🇱🇷", name: "Liberian Dollar", symbol: "L$" },
  BIF: { flag: "🇧🇮", name: "Burundian Franc", symbol: "FBu" },
  ERN: { flag: "🇪🇷", name: "Eritrean Nakfa", symbol: "Nfk" },
  LSL: { flag: "🇱🇸", name: "Lesotho Loti", symbol: "L" },
  SZL: { flag: "🇸🇿", name: "Eswatini Lilangeni", symbol: "E" },
  MRU: { flag: "🇲🇷", name: "Mauritanian Ouguiya", symbol: "UM" },
  CVE: { flag: "🇨🇻", name: "Cape Verdean Escudo", symbol: "CVE" },
  STN: { flag: "🇸🇹", name: "São Tomé Dobra", symbol: "Db" },
  KMF: { flag: "🇰🇲", name: "Comorian Franc", symbol: "KMF" },
  DJF: { flag: "🇩🇯", name: "Djiboutian Franc", symbol: "Fdj" },
};

export default function SendMoney() {
  const { wallets, refreshWallets } = useAuth();
  const [tab, setTab] = useState<Tab>("bank");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null);
  const [showAddWallet, setShowAddWallet] = useState(false);
  const [newWalletCurrency, setNewWalletCurrency] = useState("");
  const [addingWallet, setAddingWallet] = useState(false);
  const [walletSearch, setWalletSearch] = useState("");

  const [form, setForm] = useState<any>({
    walletId: "", amount: "", senderCurrency: "USD",
    recipientCountry: "NG", recipientCurrency: "NGN",
    bank_name: "", account_number: "", account_name: "", swift_code: "",
    phone: "", provider: "", recipient_name: "",
    recipient_email: "", note: "",
  });

  useEffect(() => {
    if (wallets.length > 0 && !form.walletId) {
      const def = wallets.find(w => w.isDefault) || wallets[0];
      setForm((p: any) => ({ ...p, walletId: String(def.id), senderCurrency: def.currency }));
    }
  }, [wallets]);

  useEffect(() => {
    const country = ALL_COUNTRIES.find(c => c.code === form.recipientCountry);
    if (country) {
      setForm((p: any) => ({ ...p, recipientCurrency: country.currency }));
      const providers = MOBILE_PROVIDERS[country.code] || DEFAULT_PROVIDERS;
      if (providers.length > 0) {
        setForm((p: any) => ({ ...p, provider: providers[0].name }));
      }
    }
  }, [form.recipientCountry]);

  useEffect(() => {
    if (!form.amount || Number(form.amount) <= 0 || form.senderCurrency === form.recipientCurrency) {
      setRate(null);
      setConvertedAmount(null);
      return;
    }
    if (tab === "internal") return;
    setRateLoading(true);
    api.post("/exchange/convert", { from: form.senderCurrency, to: form.recipientCurrency, amount: Number(form.amount) })
      .then(({ data }) => {
        setRate(data.rate);
        setConvertedAmount(data.converted);
      })
      .catch(() => { setRate(null); setConvertedAmount(null); })
      .finally(() => setRateLoading(false));
  }, [form.amount, form.senderCurrency, form.recipientCurrency, tab]);

  const addNewWallet = async (cur: string) => {
    setAddingWallet(true);
    try {
      await api.post("/wallets", { currency: cur });
      await refreshWallets();
      setShowAddWallet(false);
      setWalletSearch("");
      setTimeout(() => {
        const created = wallets.find(w => w.currency === cur);
        if (created) {
          setForm((p: any) => ({ ...p, walletId: String(created.id), senderCurrency: cur }));
        }
      }, 300);
    } catch (err: any) {
      alert(err.response?.data?.message || "Failed to create wallet");
    }
    setAddingWallet(false);
  };

  useEffect(() => {
    if (wallets.length > 0) {
      const cur = wallets.find(w => w.currency === form.senderCurrency);
      if (cur && form.walletId !== String(cur.id)) {
        setForm((p: any) => ({ ...p, walletId: String(cur.id) }));
      }
    }
  }, [wallets]);

  const set = (k: string, v: string) => setForm((p: any) => ({ ...p, [k]: v }));
  const selectedWallet = wallets.find(w => w.id === Number(form.walletId));
  const selectedCountry = ALL_COUNTRIES.find(c => c.code === form.recipientCountry);
  const providers = MOBILE_PROVIDERS[form.recipientCountry] || DEFAULT_PROVIDERS;
  const isCrossCurrency = form.senderCurrency !== form.recipientCurrency && tab !== "internal";
  const intlFlatFee = isCrossCurrency ? 0.99 : 0;
  const fee = tab === "internal" ? 0 : Math.max(0.25, Number(form.amount || 0) * 0.005) + intlFlatFee;

  const send = async () => {
    setError(""); setResult(null); setLoading(true);
    try {
      const body: any = {
        wallet_id: Number(form.walletId),
        amount: Number(form.amount),
        currency: form.senderCurrency,
        recipient_currency: form.recipientCurrency,
        recipient_country: form.recipientCountry,
      };
      if (tab === "bank") Object.assign(body, {
        bank_name: form.bank_name,
        account_number: form.account_number,
        account_name: form.account_name,
        swift_code: form.swift_code,
        description: `Bank transfer to ${form.account_name} (${selectedCountry?.name})`,
      });
      if (tab === "mobile") Object.assign(body, {
        phone: form.phone,
        provider: form.provider,
        recipient_name: form.recipient_name,
        description: `${form.provider} to ${form.recipient_name || form.phone} (${selectedCountry?.name})`,
      });
      if (tab === "internal") Object.assign(body, {
        recipient_email: form.recipient_email,
        note: form.note,
      });
      const { data } = await api.post(`/transfers/${tab}`, body);
      setResult(data);
      await refreshWallets();
    } catch (err: any) {
      setError(err.response?.data?.message || "Transfer failed");
    }
    setLoading(false);
  };

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "bank", label: "Bank Transfer", icon: "🏦" },
    { key: "mobile", label: "Mobile Money", icon: "📱" },
    { key: "internal", label: "COBO User", icon: "👤" },
  ];

  return (
    <Layout>
      <div className="page fade-in">
        <div className="page-header">
          <h1 className="page-title">Send Money</h1>
          <p className="page-subtitle">Transfer funds worldwide — send from the US, Europe, or across Africa</p>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
          {tabs.map(t => (
            <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-ghost"}`} onClick={() => { setTab(t.key); setResult(null); setError(""); }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {result ? (
          <div className="card-lg fade-in" style={{ maxWidth: 520 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#edf7f2", color: "#1B9E5A", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, margin: "0 auto 16px" }}>✓</div>
              <h2 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 22, marginBottom: 8 }}>Transfer Initiated</h2>
              <p style={{ color: "var(--text-dim)", marginBottom: 4, fontSize: 14 }}>Reference: <span style={{ fontFamily: "monospace" }}>{result.transaction?.reference || result.reference}</span></p>
              {isCrossCurrency && convertedAmount && (
                <p style={{ color: "var(--text-dim)", fontSize: 13, marginBottom: 16 }}>
                  {form.senderCurrency} {Number(form.amount).toLocaleString()} → {form.recipientCurrency} {convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
              )}
              <button className="btn btn-primary" onClick={() => { setResult(null); setForm((p: any) => ({ ...p, amount: "" })); }}>Send Another</button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div className="card-lg" style={{ flex: 1, minWidth: 340, maxWidth: 520 }}>
              {error && <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid rgba(217,54,54,0.15)", borderRadius: 8, color: "var(--red)", fontSize: 13, marginBottom: 16 }}>{error}</div>}

              <SectionTitle>You Send</SectionTitle>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">From Wallet</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {wallets.map(w => {
                    const info = CURRENCY_INFO[w.currency];
                    const isSelected = form.walletId === String(w.id);
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => { set("walletId", String(w.id)); set("senderCurrency", w.currency); }}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          padding: "12px 14px",
                          border: isSelected ? "2px solid var(--gold)" : "1px solid var(--surface2)",
                          borderRadius: 10,
                          background: isSelected ? "rgba(201,138,26,0.08)" : "var(--surface)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s",
                        }}
                      >
                        <span style={{ fontSize: 22 }}>{info?.flag || "💰"}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: isSelected ? 700 : 600, color: isSelected ? "var(--gold)" : "var(--text)" }}>{w.currency}</div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)" }}>{info?.name || w.currency}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{info?.symbol}{w.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          <div style={{ fontSize: 10, color: "var(--text-dim)" }}>Available</div>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => { setShowAddWallet(true); setNewWalletCurrency(""); setWalletSearch(""); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      padding: "12px 14px",
                      border: "1px dashed var(--gold)",
                      borderRadius: 10,
                      background: "transparent",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--gold)",
                      transition: "all 0.15s",
                    }}
                  >
                    + Add another currency wallet
                  </button>
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Amount ({CURRENCY_INFO[form.senderCurrency]?.flag} {form.senderCurrency})</label>
                <input className="input" type="number" min="0" step="0.01" value={form.amount} onChange={e => set("amount", e.target.value)} placeholder="0.00" style={{ fontSize: 18, fontWeight: 600 }} />
                {Number(form.amount) > 0 && (
                  <div style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 4, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4 }}>
                    <span>Fee: {form.senderCurrency} {fee.toFixed(2)}{isCrossCurrency ? " (incl. $0.99 intl.)" : ""}</span>
                    <span>Total: {form.senderCurrency} {(Number(form.amount) + fee).toFixed(2)}</span>
                  </div>
                )}
              </div>

              {tab !== "internal" && (
                <>
                  <div style={{ height: 1, background: "var(--surface2)", margin: "20px 0" }} />
                  <SectionTitle>Recipient Gets</SectionTitle>

                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Recipient Country</label>
                    <select className="select" value={form.recipientCountry} onChange={e => set("recipientCountry", e.target.value)}>
                      <optgroup label="Americas">
                        {ALL_COUNTRIES.filter(c => c.region === "americas").map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.currency})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Europe">
                        {ALL_COUNTRIES.filter(c => c.region === "europe").map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.currency})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Africa">
                        {ALL_COUNTRIES.filter(c => c.region === "africa").map(c => (
                          <option key={c.code} value={c.code}>{c.flag} {c.name} ({c.currency})</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Recipient Currency</label>
                    <select className="select" value={form.recipientCurrency} onChange={e => set("recipientCurrency", e.target.value)}>
                      {ALL_CURRENCIES.map(c => {
                        const info = CURRENCY_INFO[c.code];
                        return <option key={c.code} value={c.code}>{info?.flag || ""} {c.code} — {c.name}</option>;
                      })}
                    </select>
                  </div>

                  {isCrossCurrency && Number(form.amount) > 0 && (
                    <div style={{ padding: "12px 14px", background: "var(--surface2)", borderRadius: 8, marginBottom: 16 }}>
                      {rateLoading ? (
                        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Fetching rate...</div>
                      ) : rate ? (
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Exchange Rate</span>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>1 {form.senderCurrency} = {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {form.recipientCurrency}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                            <span style={{ fontSize: 12, color: "var(--text-dim)" }}>Recipient Gets</span>
                            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--gold)" }}>
                              {form.recipientCurrency} {convertedAmount?.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 13, color: "var(--red)" }}>Rate unavailable for this pair</div>
                      )}
                    </div>
                  )}
                </>
              )}

              <div style={{ height: 1, background: "var(--surface2)", margin: "20px 0" }} />
              <SectionTitle>{tab === "bank" ? "Bank Details" : tab === "mobile" ? "Mobile Wallet" : "COBO Recipient"}</SectionTitle>

              {tab === "bank" && (
                <>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Recipient Name</label>
                    <input className="input" value={form.account_name} onChange={e => set("account_name", e.target.value)} placeholder="Full name on bank account" />
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Bank Name</label>
                    <input className="input" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} placeholder={`e.g. ${selectedCountry?.code === "NG" ? "First Bank, GTBank" : selectedCountry?.code === "GH" ? "GCB Bank, Ecobank" : selectedCountry?.code === "KE" ? "KCB, Equity Bank" : "Local Bank"}`} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Account Number / IBAN</label>
                    <input className="input" value={form.account_number} onChange={e => set("account_number", e.target.value)} placeholder="Account number" style={{ fontFamily: "monospace" }} />
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">SWIFT/BIC Code (optional)</label>
                    <input className="input" value={form.swift_code} onChange={e => set("swift_code", e.target.value)} placeholder="e.g. FBNINGLA" style={{ fontFamily: "monospace" }} />
                  </div>
                </>
              )}

              {tab === "mobile" && (
                <>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Mobile Money Provider</label>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
                      {providers.map(p => (
                        <button
                          key={p.name}
                          type="button"
                          onClick={() => set("provider", p.name)}
                          style={{
                            padding: "10px 12px",
                            border: form.provider === p.name ? "2px solid var(--gold)" : "1px solid var(--surface2)",
                            borderRadius: 10,
                            background: form.provider === p.name ? "rgba(201,138,26,0.08)" : "var(--surface)",
                            cursor: "pointer",
                            fontSize: 13,
                            fontWeight: form.provider === p.name ? 700 : 500,
                            color: form.provider === p.name ? "var(--gold)" : "var(--text)",
                            textAlign: "left",
                            transition: "all 0.15s",
                          }}
                        >
                          {p.logo} {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Phone Number</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div style={{ padding: "10px 12px", background: "var(--surface2)", borderRadius: 8, fontSize: 14, fontWeight: 600, minWidth: 64, textAlign: "center" }}>
                        {selectedCountry?.dialCode}
                      </div>
                      <input className="input" style={{ flex: 1 }} value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Phone number" />
                    </div>
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Recipient Name</label>
                    <input className="input" value={form.recipient_name} onChange={e => set("recipient_name", e.target.value)} placeholder="Name on mobile money account" />
                  </div>
                </>
              )}

              {tab === "internal" && (
                <>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Recipient Email</label>
                    <input className="input" type="email" value={form.recipient_email} onChange={e => set("recipient_email", e.target.value)} placeholder="user@cobo.africa" />
                  </div>
                  <div className="input-group" style={{ marginBottom: 16 }}>
                    <label className="input-label">Note (optional)</label>
                    <input className="input" value={form.note} onChange={e => set("note", e.target.value)} placeholder="What's this for?" />
                  </div>
                </>
              )}

              <button className="btn btn-primary btn-lg btn-full" onClick={send} disabled={loading || !form.amount || Number(form.amount) <= 0} style={{ marginTop: 8 }}>
                {loading ? <span className="spinner" /> : `Send ${form.senderCurrency} ${form.amount || "0.00"}`}
              </button>
            </div>

            {tab !== "internal" && (
              <div style={{ minWidth: 260, maxWidth: 300, flex: "0 0 auto" }}>
                <div className="card" style={{ position: "sticky", top: 20 }}>
                  <h4 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Transfer Summary</h4>
                  <SummaryRow label="From" value={`${form.senderCurrency} wallet`} />
                  <SummaryRow label="To" value={`${selectedCountry?.flag} ${selectedCountry?.name}`} />
                  <SummaryRow label="Method" value={tab === "bank" ? "Bank Transfer" : form.provider || "Mobile Money"} />
                  {form.amount && Number(form.amount) > 0 && (
                    <>
                      <SummaryRow label="Amount" value={`${form.senderCurrency} ${Number(form.amount).toLocaleString()}`} />
                      <SummaryRow label="Fee" value={`${form.senderCurrency} ${fee.toFixed(2)}`} />
                      <div style={{ height: 1, background: "var(--surface2)", margin: "8px 0" }} />
                      <SummaryRow label="Total Debit" value={`${form.senderCurrency} ${(Number(form.amount) + fee).toFixed(2)}`} bold />
                      {isCrossCurrency && convertedAmount && (
                        <>
                          <div style={{ height: 1, background: "var(--surface2)", margin: "8px 0" }} />
                          <SummaryRow label="Recipient Gets" value={`${form.recipientCurrency} ${convertedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`} bold gold />
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        {showAddWallet && (
          <div className="modal-overlay" onClick={() => setShowAddWallet(false)}>
            <div className="card-lg fade-in" style={{ width: 480, maxHeight: "80vh", overflow: "hidden", display: "flex", flexDirection: "column" }} onClick={e => e.stopPropagation()}>
              <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>Add Currency Wallet</h3>
              <p style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 16 }}>Choose your local currency to create a new wallet</p>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <input className="input" placeholder="Search by currency or country..." value={walletSearch} onChange={e => setWalletSearch(e.target.value)} style={{ fontSize: 14 }} />
              </div>

              <div style={{ flex: 1, overflowY: "auto", maxHeight: 350, marginBottom: 16 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {ALL_CURRENCIES
                    .filter(c => !wallets.find(w => w.currency === c.code))
                    .filter(c =>
                      !walletSearch ||
                      c.code.toLowerCase().includes(walletSearch.toLowerCase()) ||
                      c.name.toLowerCase().includes(walletSearch.toLowerCase()) ||
                      (CURRENCY_INFO[c.code]?.name || "").toLowerCase().includes(walletSearch.toLowerCase())
                    )
                    .map(c => {
                      const info = CURRENCY_INFO[c.code];
                      const isSelected = newWalletCurrency === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => setNewWalletCurrency(c.code)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            padding: "10px 12px",
                            border: isSelected ? "2px solid var(--gold)" : "1px solid var(--surface2)",
                            borderRadius: 10,
                            background: isSelected ? "rgba(201,138,26,0.08)" : "var(--surface)",
                            cursor: "pointer",
                            textAlign: "left",
                            transition: "all 0.15s",
                          }}
                        >
                          <span style={{ fontSize: 18 }}>{info?.flag || "💰"}</span>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: isSelected ? 700 : 600, color: isSelected ? "var(--gold)" : "var(--text)" }}>{c.code}</div>
                            <div style={{ fontSize: 10, color: "var(--text-dim)" }}>{c.name}</div>
                          </div>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => { setShowAddWallet(false); setWalletSearch(""); }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => newWalletCurrency && addNewWallet(newWalletCurrency)} disabled={!newWalletCurrency || addingWallet}>
                  {addingWallet ? <span className="spinner" /> : `Create ${newWalletCurrency || "..."} Wallet`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 14, color: "var(--gold)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>{children}</h3>
  );
}

function SummaryRow({ label, value, bold, gold }: { label: string; value: string; bold?: boolean; gold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: 13 }}>
      <span style={{ color: "var(--text-dim)" }}>{label}</span>
      <span style={{ fontWeight: bold ? 700 : 500, color: gold ? "var(--gold)" : "var(--text)" }}>{value}</span>
    </div>
  );
}
