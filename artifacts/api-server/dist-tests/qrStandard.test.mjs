import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);

// src/tests/qrStandard.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/services/scheme/qrStandard.ts
var IAPAY_GUI = "africa.iapay";
var TAG_PAYLOAD_FORMAT = "00";
var TAG_INITIATION_METHOD = "01";
var TAG_MERCHANT_ACCOUNT = "26";
var TAG_MCC = "52";
var TAG_CURRENCY = "53";
var TAG_AMOUNT = "54";
var TAG_COUNTRY = "58";
var TAG_MERCHANT_NAME = "59";
var TAG_MERCHANT_CITY = "60";
var TAG_ADDITIONAL = "62";
var TAG_CRC = "63";
var CURRENCY_NUMERIC = {
  USD: "840",
  EUR: "978",
  GBP: "826",
  NGN: "566",
  GHS: "936",
  KES: "404",
  ZAR: "710",
  TZS: "834",
  UGX: "800",
  ETB: "230",
  EGP: "818",
  RWF: "646",
  XOF: "952",
  XAF: "950",
  MAD: "504",
  CDF: "976",
  AOA: "973",
  MZN: "943",
  ZMW: "967",
  TND: "788",
  MWK: "454",
  BWP: "072",
  NAD: "516",
  SLL: "694",
  LRD: "430",
  GMD: "270",
  GNF: "324",
  MGA: "969",
  MUR: "480",
  SCR: "690",
  SDG: "938",
  SSP: "728",
  SOS: "706",
  DJF: "262",
  ERN: "232",
  BIF: "108",
  KMF: "174",
  CVE: "132",
  STN: "930",
  MRU: "929",
  LYD: "434",
  DZD: "012"
};
var NUMERIC_TO_CURRENCY = Object.fromEntries(
  Object.entries(CURRENCY_NUMERIC).map(([code, num]) => [num, code])
);
function tlv(tag, value) {
  return `${tag}${String(value.length).padStart(2, "0")}${value}`;
}
function crc16(payload) {
  let crc = 65535;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 32768 ? (crc << 1 ^ 4129) & 65535 : crc << 1 & 65535;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function encodeIapayQr(p) {
  const account = tlv("00", IAPAY_GUI) + tlv("01", p.alias) + tlv("02", p.participantCode);
  let payload = tlv(TAG_PAYLOAD_FORMAT, "01") + tlv(TAG_INITIATION_METHOD, p.dynamic ? "12" : "11") + tlv(TAG_MERCHANT_ACCOUNT, account) + tlv(TAG_MCC, "0000") + tlv(TAG_CURRENCY, CURRENCY_NUMERIC[p.currency || "USD"] || "840");
  if (p.amount && p.amount > 0) payload += tlv(TAG_AMOUNT, p.amount.toFixed(2));
  payload += tlv(TAG_COUNTRY, (p.country || "KE").toUpperCase().slice(0, 2));
  payload += tlv(TAG_MERCHANT_NAME, p.merchantName.slice(0, 25));
  payload += tlv(TAG_MERCHANT_CITY, (p.city || "Nairobi").slice(0, 15));
  if (p.reference) payload += tlv(TAG_ADDITIONAL, tlv("05", p.reference.slice(0, 25)));
  payload += TAG_CRC + "04";
  return payload + crc16(payload);
}
function parseTlv(data) {
  const fields = {};
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
function decodeIapayQr(payload) {
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
    dynamic: fields[TAG_INITIATION_METHOD] === "12"
  };
}

// src/tests/qrStandard.test.ts
test("dynamic QR round-trips every field", () => {
  const payload = encodeIapayQr({
    alias: "+254712345678",
    participantCode: "IAPAYPAN",
    merchantName: "Amina Okafor",
    country: "KE",
    currency: "KES",
    amount: 1500.5,
    reference: "INV-2024-001",
    dynamic: true
  });
  const decoded = decodeIapayQr(payload);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.alias, "+254712345678");
  assert.equal(decoded.participantCode, "IAPAYPAN");
  assert.equal(decoded.merchantName, "Amina Okafor");
  assert.equal(decoded.currency, "KES");
  assert.equal(decoded.amount, 1500.5);
  assert.equal(decoded.reference, "INV-2024-001");
  assert.equal(decoded.dynamic, true);
});
test("static QR has no amount and is marked static", () => {
  const payload = encodeIapayQr({
    alias: "amina@cob-o.com",
    participantCode: "IAPAYPAN",
    merchantName: "Amina",
    currency: "USD"
  });
  const decoded = decodeIapayQr(payload);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.amount, null);
  assert.equal(decoded.dynamic, false);
});
test("tampered payload fails CRC validation", () => {
  const payload = encodeIapayQr({
    alias: "+254712345678",
    participantCode: "IAPAYPAN",
    merchantName: "Amina",
    currency: "KES",
    amount: 100
  });
  const tampered = payload.slice(0, 30) + (payload[30] === "9" ? "8" : "9") + payload.slice(31);
  assert.equal(decodeIapayQr(tampered).valid, false);
});
test("garbage and non-IAPAY payloads are rejected", () => {
  assert.equal(decodeIapayQr("").valid, false);
  assert.equal(decodeIapayQr("hello world").valid, false);
  const foreignBody = "00020126160012other.scheme6304";
  const foreign = foreignBody + crc16(foreignBody);
  assert.equal(decodeIapayQr(foreign).valid, false);
});
test("crc16 matches known CCITT-FALSE vector", () => {
  assert.equal(crc16("123456789"), "29B1");
});
