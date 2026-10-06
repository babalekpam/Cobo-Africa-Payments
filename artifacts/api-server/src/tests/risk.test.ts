import { test } from "node:test";
import assert from "node:assert/strict";
import { exposureUsd, toUsd, withinNetDebitCap, MissingRateError, type ExposureRow } from "../services/scheme/exposure.js";
import { isSafeOutboundUrl } from "../lib/urlSafety.js";
import { loadSchemeConfig } from "../services/scheme/config.js";

const RATES = { KES: 100, NGN: 1000, EUR: 0.5 }; // units per 1 USD
const row = (over: Partial<ExposureRow>): ExposureRow => ({
  senderParticipantId: 1,
  recipientParticipantId: 2,
  currency: "USD",
  recipientCurrency: "USD",
  amount: 100,
  recipientAmount: 100,
  status: "cleared",
  ...over,
});

// ---- exposure ----
test("exposure: sent counts against a participant, received offsets it (cleared only)", () => {
  const rows = [row({ amount: 300, recipientAmount: 300 }), row({ senderParticipantId: 2, recipientParticipantId: 1, amount: 100, recipientAmount: 100 })];
  assert.equal(exposureUsd(1, rows, RATES), 200); // sent 300, received 100
  assert.equal(exposureUsd(2, rows, RATES), -200);
});

test("exposure: pending and unresolved payments count as debt; they never offset the receiver", () => {
  const rows = [row({ status: "pending", amount: 50 }), row({ status: "unresolved", amount: 70 })];
  assert.equal(exposureUsd(1, rows, RATES), 120);
  assert.equal(exposureUsd(2, rows, RATES), 0, "receiver gets no credit until the payment is firm");
});

test("exposure: rejected, returned and settled payments carry no exposure", () => {
  const rows = ["rejected", "returned", "settled"].map((status) => row({ status }));
  assert.equal(exposureUsd(1, rows, RATES), 0);
  assert.equal(exposureUsd(2, rows, RATES), 0);
});

test("exposure: converts each leg to USD in its own currency", () => {
  // 10,000 KES sent (=100 USD); the receiver was credited 20 EUR (=40 USD)
  const rows = [row({ currency: "KES", amount: 10000, recipientCurrency: "EUR", recipientAmount: 20 })];
  assert.equal(exposureUsd(1, rows, RATES), 100);
  assert.equal(exposureUsd(2, rows, RATES), -40);
});

test("exposure: an unknown currency fails closed instead of being guessed", () => {
  assert.throws(() => exposureUsd(1, [row({ currency: "XYZ" })], RATES), MissingRateError);
  assert.throws(() => toUsd(10, "ABC", RATES), MissingRateError);
  assert.throws(() => toUsd(10, "KES", { KES: 0 }), MissingRateError);
  assert.equal(toUsd(10, "USD", {}), 10);
});

test("net-debit cap: boundary is inclusive, zero cap admits nothing, negative exposure frees headroom", () => {
  assert.equal(withinNetDebitCap(900, 100, 1000), true);
  assert.equal(withinNetDebitCap(900, 100.01, 1000), false);
  assert.equal(withinNetDebitCap(0, 0.01, 0), false, "cap 0 = fail closed");
  assert.equal(withinNetDebitCap(-500, 1400, 1000), true);
});

// ---- outbound URL policy ----
test("outbound URL policy blocks internal, private, credentialed and obfuscated targets", () => {
  const bad = [
    "http://localhost/x", "http://127.0.0.1/x", "http://10.1.2.3/x", "http://192.168.1.1/x", "http://172.16.0.1/x", "http://169.254.169.254/latest/meta-data",
    "http://[::1]/x", "http://[fe80::1]/x", "http://[::ffff:127.0.0.1]/x", "http://2130706433/x", "http://0x7f000001/x", "http://0177.0.0.1/x",
    "http://db.internal/x", "http://printer.local/x", "ftp://example.com/x", "https://user:pw@example.com/x", "not a url",
  ];
  for (const u of bad) assert.equal(isSafeOutboundUrl(u), false, u);
  assert.equal(isSafeOutboundUrl("https://fcmb.com/iapay"), true, "a hostname that merely starts with fc/fd is not an IPv6 address");
  assert.equal(isSafeOutboundUrl("https://fdh.example.com/iapay"), true);
  assert.equal(isSafeOutboundUrl("http://[fc00::1]/x"), false, "IPv6 unique-local literals stay blocked");
  assert.equal(isSafeOutboundUrl("http://[fd12:3456::1]/x"), false);
  assert.equal(isSafeOutboundUrl("https://bank.example.com/iapay"), true);
  assert.equal(isSafeOutboundUrl("http://bank.example.com/iapay"), true, "http allowed when https is not required");
  assert.equal(isSafeOutboundUrl("http://bank.example.com/iapay", { requireHttps: true }), false);
  assert.equal(isSafeOutboundUrl("https://bank.example.com/iapay", { requireHttps: true }), true);
});

// ---- gateway risk config ----
test("gateway risk config fails closed by default and tolerates bad input", () => {
  const d = loadSchemeConfig({});
  assert.equal(d.defaultNetDebitCapUsd, 0);
  assert.equal(d.gatewayMaxSingleAmountUsd, 10000);
  const c = loadSchemeConfig({ GATEWAY_DEFAULT_NET_DEBIT_CAP_USD: "250000", GATEWAY_MAX_SINGLE_AMOUNT_USD: "2500" });
  assert.deepEqual([c.defaultNetDebitCapUsd, c.gatewayMaxSingleAmountUsd], [250000, 2500]);
  const bad = loadSchemeConfig({ GATEWAY_DEFAULT_NET_DEBIT_CAP_USD: "-5", GATEWAY_MAX_SINGLE_AMOUNT_USD: "abc" });
  assert.deepEqual([bad.defaultNetDebitCapUsd, bad.gatewayMaxSingleAmountUsd], [0, 10000]);
});
