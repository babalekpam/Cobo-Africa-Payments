import { test } from "node:test";
import assert from "node:assert/strict";
import { encodeAfriQr, decodeAfriQr, crc16 } from "../services/scheme/qrStandard.js";

test("dynamic QR round-trips every field", () => {
  const payload = encodeAfriQr({
    alias: "+254712345678",
    participantCode: "COBOPANA",
    merchantName: "Amina Okafor",
    country: "KE",
    currency: "KES",
    amount: 1500.5,
    reference: "INV-2024-001",
    dynamic: true,
  });
  const decoded = decodeAfriQr(payload);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.alias, "+254712345678");
  assert.equal(decoded.participantCode, "COBOPANA");
  assert.equal(decoded.merchantName, "Amina Okafor");
  assert.equal(decoded.currency, "KES");
  assert.equal(decoded.amount, 1500.5);
  assert.equal(decoded.reference, "INV-2024-001");
  assert.equal(decoded.dynamic, true);
});

test("static QR has no amount and is marked static", () => {
  const payload = encodeAfriQr({
    alias: "amina@cob-o.com",
    participantCode: "COBOPANA",
    merchantName: "Amina",
    currency: "USD",
  });
  const decoded = decodeAfriQr(payload);
  assert.equal(decoded.valid, true);
  assert.equal(decoded.amount, null);
  assert.equal(decoded.dynamic, false);
});

test("tampered payload fails CRC validation", () => {
  const payload = encodeAfriQr({
    alias: "+254712345678",
    participantCode: "COBOPANA",
    merchantName: "Amina",
    currency: "KES",
    amount: 100,
  });
  const tampered = payload.slice(0, 30) + (payload[30] === "9" ? "8" : "9") + payload.slice(31);
  assert.equal(decodeAfriQr(tampered).valid, false);
});

test("garbage and non-Afrix payloads are rejected", () => {
  assert.equal(decodeAfriQr("").valid, false);
  assert.equal(decodeAfriQr("hello world").valid, false);
  // Structurally valid TLV with correct CRC but a foreign GUI
  const foreignBody = "000201" + "26160012other.scheme" + "6304";
  const foreign = foreignBody + crc16(foreignBody);
  assert.equal(decodeAfriQr(foreign).valid, false);
});

test("crc16 matches known CCITT-FALSE vector", () => {
  // "123456789" -> 0x29B1 is the standard CRC-16/CCITT-FALSE check value
  assert.equal(crc16("123456789"), "29B1");
});
