import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);

// src/tests/risk.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/services/scheme/exposure.ts
var EXPOSURE_STATUSES = ["cleared", "pending", "unresolved"];
var MissingRateError = class extends Error {
};
function toUsd(amount, currency, ratesPerUsd) {
  const rate = currency === "USD" ? 1 : ratesPerUsd[currency];
  if (!rate || !Number.isFinite(rate) || rate <= 0) throw new MissingRateError(`No USD rate for ${currency}`);
  return amount / rate;
}
function exposureUsd(participantId, rows, ratesPerUsd) {
  let total = 0;
  for (const r of rows) {
    if (r.senderParticipantId === participantId && EXPOSURE_STATUSES.includes(r.status)) {
      total += toUsd(r.amount, r.currency, ratesPerUsd);
    }
    if (r.recipientParticipantId === participantId && r.status === "cleared") {
      total -= toUsd(r.recipientAmount, r.recipientCurrency, ratesPerUsd);
    }
  }
  return Math.round(total * 100) / 100;
}
function withinNetDebitCap(currentExposureUsd, amountUsd, capUsd) {
  return currentExposureUsd + amountUsd <= capUsd + 1e-9;
}

// src/lib/urlSafety.ts
function isSafeOutboundUrl(url, opts = {}) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && (opts.requireHttps || parsed.protocol !== "http:")) return false;
    if (parsed.username || parsed.password) return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "::") return false;
    if (host.startsWith("127.") || host.startsWith("10.") || host.startsWith("192.168.") || host.startsWith("169.254.")) return false;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return false;
    if (host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("::ffff:")) return false;
    if (/^\d+$/.test(host) || /^0x[0-9a-f]+$/.test(host) || /^0\d+/.test(host)) return false;
    if (host.endsWith(".internal") || host.endsWith(".local")) return false;
    return true;
  } catch {
    return false;
  }
}

// src/services/scheme/config.ts
function positiveInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}
function loadSchemeConfig(env = process.env) {
  const country = (env.SCHEME_HOME_COUNTRY || "KE").trim().toUpperCase();
  const currency = (env.SCHEME_HOME_CURRENCY || "USD").trim().toUpperCase();
  return {
    name: env.SCHEME_NAME?.trim() || "IAPAY",
    homeParticipantName: env.SCHEME_HOME_PARTICIPANT_NAME?.trim() || "IAPAY (Intra-African Payments)",
    homeCountry: /^[A-Z]{2}$/.test(country) ? country : "KE",
    homeCurrency: /^[A-Z]{3}$/.test(currency) ? currency : "USD",
    seedDemoParticipants: (env.SCHEME_SEED_DEMO_PARTICIPANTS ?? "true").trim().toLowerCase() !== "false",
    gatewayTimeoutMs: positiveInt(env.GATEWAY_TIMEOUT_MS, 8e3),
    gatewayMaxClockSkewSec: positiveInt(env.GATEWAY_MAX_CLOCK_SKEW_SEC, 300),
    gatewayMaxSingleAmountUsd: positiveInt(env.GATEWAY_MAX_SINGLE_AMOUNT_USD, 1e4),
    defaultNetDebitCapUsd: Math.max(0, Number(env.GATEWAY_DEFAULT_NET_DEBIT_CAP_USD) || 0)
  };
}

// src/tests/risk.test.ts
var RATES = { KES: 100, NGN: 1e3, EUR: 0.5 };
var row = (over) => ({
  senderParticipantId: 1,
  recipientParticipantId: 2,
  currency: "USD",
  recipientCurrency: "USD",
  amount: 100,
  recipientAmount: 100,
  status: "cleared",
  ...over
});
test("exposure: sent counts against a participant, received offsets it (cleared only)", () => {
  const rows = [row({ amount: 300, recipientAmount: 300 }), row({ senderParticipantId: 2, recipientParticipantId: 1, amount: 100, recipientAmount: 100 })];
  assert.equal(exposureUsd(1, rows, RATES), 200);
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
  const rows = [row({ currency: "KES", amount: 1e4, recipientCurrency: "EUR", recipientAmount: 20 })];
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
  assert.equal(withinNetDebitCap(900, 100, 1e3), true);
  assert.equal(withinNetDebitCap(900, 100.01, 1e3), false);
  assert.equal(withinNetDebitCap(0, 0.01, 0), false, "cap 0 = fail closed");
  assert.equal(withinNetDebitCap(-500, 1400, 1e3), true);
});
test("outbound URL policy blocks internal, private, credentialed and obfuscated targets", () => {
  const bad = [
    "http://localhost/x",
    "http://127.0.0.1/x",
    "http://10.1.2.3/x",
    "http://192.168.1.1/x",
    "http://172.16.0.1/x",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/x",
    "http://[fe80::1]/x",
    "http://[::ffff:127.0.0.1]/x",
    "http://2130706433/x",
    "http://0x7f000001/x",
    "http://0177.0.0.1/x",
    "http://db.internal/x",
    "http://printer.local/x",
    "ftp://example.com/x",
    "https://user:pw@example.com/x",
    "not a url"
  ];
  for (const u of bad) assert.equal(isSafeOutboundUrl(u), false, u);
  assert.equal(isSafeOutboundUrl("https://bank.example.com/iapay"), true);
  assert.equal(isSafeOutboundUrl("http://bank.example.com/iapay"), true, "http allowed when https is not required");
  assert.equal(isSafeOutboundUrl("http://bank.example.com/iapay", { requireHttps: true }), false);
  assert.equal(isSafeOutboundUrl("https://bank.example.com/iapay", { requireHttps: true }), true);
});
test("gateway risk config fails closed by default and tolerates bad input", () => {
  const d = loadSchemeConfig({});
  assert.equal(d.defaultNetDebitCapUsd, 0);
  assert.equal(d.gatewayMaxSingleAmountUsd, 1e4);
  const c = loadSchemeConfig({ GATEWAY_DEFAULT_NET_DEBIT_CAP_USD: "250000", GATEWAY_MAX_SINGLE_AMOUNT_USD: "2500" });
  assert.deepEqual([c.defaultNetDebitCapUsd, c.gatewayMaxSingleAmountUsd], [25e4, 2500]);
  const bad = loadSchemeConfig({ GATEWAY_DEFAULT_NET_DEBIT_CAP_USD: "-5", GATEWAY_MAX_SINGLE_AMOUNT_USD: "abc" });
  assert.deepEqual([bad.defaultNetDebitCapUsd, bad.gatewayMaxSingleAmountUsd], [0, 1e4]);
});
