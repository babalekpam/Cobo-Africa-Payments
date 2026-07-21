// IAPAY QR — pan-African QR standard for the IAPAY scheme.
// EMVCo merchant-presented-mode compatible TLV payload (same family as Brazil's Pix "BR Code"),
// terminated with a CRC-16/CCITT-FALSE checksum so any participant app can validate a scanned code.

const IAPAY_GUI = "africa.iapay"; // globally unique identifier inside the merchant account info template

// EMV tag ids
const TAG_PAYLOAD_FORMAT = "00";
const TAG_INITIATION_METHOD = "01"; // 11 = static, 12 = dynamic
const TAG_MERCHANT_ACCOUNT = "26"; // template: 00 = GUI, 01 = alias, 02 = participant code
const TAG_MCC = "52";
const TAG_CURRENCY = "53"; // ISO 4217 numeric
const TAG_AMOUNT = "54";
const TAG_COUNTRY = "58";
const TAG_MERCHANT_NAME = "59";
const TAG_MERCHANT_CITY = "60";
const TAG_ADDITIONAL = "62"; // template: 05 = reference label
const TAG_CRC = "63";

// ISO 4217 numeric codes for currencies used across the network
const CURRENCY_NUMERIC: Record<string, string> = {
  USD: "840", EUR: "978", GBP: "826", NGN: "566", GHS: "936", KES: "404", ZAR: "710",
  TZS: "834", UGX: "800", ETB: "230", EGP: "818", RWF: "646", XOF: "952", XAF: "950",
  MAD: "504", CDF: "976", AOA: "973", MZN: "943", ZMW: "967", TND: "788", MWK: "454",
  BWP: "072", NAD: "516", SLL: "694", LRD: "430", GMD: "270", GNF: "324", MGA: "969",
  MUR: "480", SCR: "690", SDG: "938", SSP: "728", SOS: "706", DJF: "262", ERN: "232",
  BIF: "108", KMF: "174", CVE: "132", STN: "930", MRU: "929", LYD: "434", DZD: "012",
};
const NUMERIC_TO_CURRENCY: Record<string, string> = Object.fromEntries(
  Object.entries(CURRENCY_NUMERIC).map(([code, num]) => [num, code])
);

function tlv(tag: string, value: string): string {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}

// CRC-16/CCITT-FALSE — polynomial 0x1021, initial 0xFFFF (as mandated by EMVCo QR spec)
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface IapayQrPayload {
  alias: string;
  participantCode: string;
  merchantName: string;
  city?: string;
  country?: string;
  currency?: string;
  amount?: number | null;
  reference?: string;
  dynamic?: boolean;
}

export function encodeIapayQr(p: IapayQrPayload): string {
  const account = tlv("00", IAPAY_GUI) + tlv("01", p.alias) + tlv("02", p.participantCode);
  let payload =
    tlv(TAG_PAYLOAD_FORMAT, "01") +
    tlv(TAG_INITIATION_METHOD, p.dynamic ? "12" : "11") +
    tlv(TAG_MERCHANT_ACCOUNT, account) +
    tlv(TAG_MCC, "0000") +
    tlv(TAG_CURRENCY, CURRENCY_NUMERIC[p.currency || "USD"] || "840");
  if (p.amount && p.amount > 0) payload += tlv(TAG_AMOUNT, p.amount.toFixed(2));
  payload += tlv(TAG_COUNTRY, (p.country || "KE").toUpperCase().slice(0, 2));
  payload += tlv(TAG_MERCHANT_NAME, p.merchantName.slice(0, 25));
  payload += tlv(TAG_MERCHANT_CITY, (p.city || "Nairobi").slice(0, 15));
  if (p.reference) payload += tlv(TAG_ADDITIONAL, tlv("05", p.reference.slice(0, 25)));
  payload += TAG_CRC + "04";
  return payload + crc16(payload);
}

export interface DecodedIapayQr {
  valid: boolean;
  error?: string;
  alias?: string;
  participantCode?: string;
  merchantName?: string;
  city?: string;
  country?: string;
  currency?: string;
  amount?: number | null;
  reference?: string;
  dynamic?: boolean;
}

function parseTlv(data: string): Record<string, string> | null {
  const fields: Record<string, string> = {};
  let i = 0;
  while (i < data.length) {
    if (i + 4 > data.length) return null;
    const tag = data.slice(i, i + 2);
    const len = parseInt(data.slice(i + 2, i + 4), 10);
    if (isNaN(len) || i + 4 + len > data.length) return null;
    fields[tag] = data.slice(i + 4, i + 4 + len);
    i += 4 + len;
  }
  return fields;
}

export function decodeIapayQr(payload: string): DecodedIapayQr {
  if (!payload || payload.length < 20) return { valid: false, error: "Payload too short" };

  const crcIndex = payload.lastIndexOf(TAG_CRC + "04");
  if (crcIndex === -1 || crcIndex + 8 !== payload.length) return { valid: false, error: "Missing CRC field" };
  const expected = crc16(payload.slice(0, crcIndex + 4));
  const actual = payload.slice(crcIndex + 4).toUpperCase();
  if (expected !== actual) return { valid: false, error: "CRC checksum mismatch" };

  const fields = parseTlv(payload.slice(0, crcIndex));
  if (!fields) return { valid: false, error: "Malformed TLV structure" };

  const account = fields[TAG_MERCHANT_ACCOUNT] ? parseTlv(fields[TAG_MERCHANT_ACCOUNT]) : null;
  if (!account || account["00"] !== IAPAY_GUI) return { valid: false, error: "Not an IAPAY QR code" };

  const additional = fields[TAG_ADDITIONAL] ? parseTlv(fields[TAG_ADDITIONAL]) : null;

  return {
    valid: true,
    alias: account["01"],
    participantCode: account["02"],
    merchantName: fields[TAG_MERCHANT_NAME],
    city: fields[TAG_MERCHANT_CITY],
    country: fields[TAG_COUNTRY],
    currency: NUMERIC_TO_CURRENCY[fields[TAG_CURRENCY]] || "USD",
    amount: fields[TAG_AMOUNT] ? parseFloat(fields[TAG_AMOUNT]) : null,
    reference: additional?.["05"],
    dynamic: fields[TAG_INITIATION_METHOD] === "12",
  };
}
