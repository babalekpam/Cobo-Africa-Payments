import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);

// src/tests/netting.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/services/scheme/netting.ts
function computeNetPositions(transfers) {
  const positions = /* @__PURE__ */ new Map();
  const bump = (participantId, currency, field, amount) => {
    const key = `${participantId}:${currency}`;
    const pos = positions.get(key) || { participantId, currency, debit: 0, credit: 0, net: 0 };
    pos[field] += amount;
    pos.net = pos.credit - pos.debit;
    positions.set(key, pos);
  };
  for (const t2 of transfers) {
    bump(t2.senderParticipantId, t2.currency, "debit", t2.amount);
    bump(t2.recipientParticipantId, t2.recipientCurrency, "credit", t2.recipientAmount);
  }
  return [...positions.values()];
}
function sumNetByCurrency(positions) {
  const sums = {};
  for (const p of positions) {
    sums[p.currency] = (sums[p.currency] || 0) + p.net;
  }
  return sums;
}

// src/tests/netting.test.ts
var t = (senderParticipantId, recipientParticipantId, amount, currency, recipientAmount = amount, recipientCurrency = currency) => ({ senderParticipantId, recipientParticipantId, amount, currency, recipientAmount, recipientCurrency });
test("single-currency multilateral netting nets to zero", () => {
  const positions = computeNetPositions([t(1, 2, 100, "KES"), t(2, 3, 40, "KES"), t(3, 1, 10, "KES")]);
  const byId = Object.fromEntries(positions.map((p) => [`${p.participantId}`, p.net]));
  assert.equal(byId["1"], -90);
  assert.equal(byId["2"], 60);
  assert.equal(byId["3"], 30);
  assert.equal(sumNetByCurrency(positions)["KES"], 0);
});
test("bilateral flows offset within a participant", () => {
  const positions = computeNetPositions([t(1, 2, 50, "USD"), t(2, 1, 50, "USD")]);
  for (const p of positions) assert.equal(p.net, 0);
});
test("cross-currency legs are tracked per currency", () => {
  const positions = computeNetPositions([t(1, 2, 1e3, "NGN", 8.5, "KES")]);
  const ngn = positions.find((p) => p.currency === "NGN");
  const kes = positions.find((p) => p.currency === "KES");
  assert.equal(ngn?.participantId, 1);
  assert.equal(ngn?.net, -1e3);
  assert.equal(kes?.participantId, 2);
  assert.equal(kes?.net, 8.5);
});
test("empty cycle produces no positions", () => {
  assert.deepEqual(computeNetPositions([]), []);
});
test("gross volume is preserved as debit/credit totals", () => {
  const positions = computeNetPositions([t(1, 2, 100, "USD"), t(1, 3, 200, "USD"), t(2, 3, 50, "USD")]);
  const totalDebit = positions.reduce((s, p) => s + p.debit, 0);
  const totalCredit = positions.reduce((s, p) => s + p.credit, 0);
  assert.equal(totalDebit, 350);
  assert.equal(totalCredit, 350);
});
