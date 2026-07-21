import { test } from "node:test";
import assert from "node:assert/strict";
import { computeNetPositions, sumNetByCurrency, type NettableTransfer } from "../services/scheme/netting.js";

const t = (
  senderParticipantId: number,
  recipientParticipantId: number,
  amount: number,
  currency: string,
  recipientAmount = amount,
  recipientCurrency = currency
): NettableTransfer => ({ senderParticipantId, recipientParticipantId, amount, currency, recipientAmount, recipientCurrency });

test("single-currency multilateral netting nets to zero", () => {
  // A pays B 100, B pays C 40, C pays A 10 — all KES
  const positions = computeNetPositions([t(1, 2, 100, "KES"), t(2, 3, 40, "KES"), t(3, 1, 10, "KES")]);
  const byId = Object.fromEntries(positions.map((p) => [`${p.participantId}`, p.net]));
  assert.equal(byId["1"], -90); // sent 100, received 10
  assert.equal(byId["2"], 60); // received 100, sent 40
  assert.equal(byId["3"], 30); // received 40, sent 10
  assert.equal(sumNetByCurrency(positions)["KES"], 0);
});

test("bilateral flows offset within a participant", () => {
  // A and B pay each other 50 each — both flat
  const positions = computeNetPositions([t(1, 2, 50, "USD"), t(2, 1, 50, "USD")]);
  for (const p of positions) assert.equal(p.net, 0);
});

test("cross-currency legs are tracked per currency", () => {
  // A (NGN side) pays B who receives KES: A owes 1000 NGN, B is owed 8.5 KES-side
  const positions = computeNetPositions([t(1, 2, 1000, "NGN", 8.5, "KES")]);
  const ngn = positions.find((p) => p.currency === "NGN");
  const kes = positions.find((p) => p.currency === "KES");
  assert.equal(ngn?.participantId, 1);
  assert.equal(ngn?.net, -1000);
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
