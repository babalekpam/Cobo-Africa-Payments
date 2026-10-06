import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPacs008, buildPacs002, buildPacs004, xmlEscape, type Iso20022Transfer } from "../services/scheme/iso20022.js";

const base: Iso20022Transfer = {
  reference: "IAP-ABC123",
  endToEndId: "EIAPAYPAN20261006ABCDEFGHIJK",
  amount: 100,
  currency: "USD",
  recipientAmount: 12950.5,
  recipientCurrency: "KES",
  fxRate: 129.505,
  initiatedAt: new Date("2026-10-06T10:00:00.123Z"),
  clearedAt: new Date("2026-10-06T10:00:00.456Z"),
  description: "Rent <Oct> & utilities",
  debtor: { name: "Ada Obi", participantCode: "GTBANKNGA", country: "NG" },
  creditor: { name: "Jomo K.", participantCode: "EQTYBKKEN", country: "KE" },
};

test("xmlEscape neutralises markup characters", () => {
  assert.equal(xmlEscape(`<a href="x">&'</a>`), "&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
});

test("pacs.008 carries ids, both agents, both amounts and the FX rate", () => {
  const xml = buildPacs008(base);
  assert.match(xml, /xmlns="urn:iso:std:iso:20022:tech:xsd:pacs\.008\.001\.08"/);
  assert.match(xml, /<EndToEndId>EIAPAYPAN20261006ABCDEFGHIJK<\/EndToEndId>/);
  assert.match(xml, /<IntrBkSttlmAmt Ccy="KES">12950\.50<\/IntrBkSttlmAmt>/);
  assert.match(xml, /<InstdAmt Ccy="USD">100\.00<\/InstdAmt>/);
  assert.match(xml, /<XchgRate>129\.505<\/XchgRate>/);
  assert.match(xml, /<DbtrAgt>.*<MmbId>GTBANKNGA<\/MmbId>/);
  assert.match(xml, /<CdtrAgt>.*<MmbId>EQTYBKKEN<\/MmbId>/);
  assert.match(xml, /<CreDtTm>2026-10-06T10:00:00Z<\/CreDtTm>/);
});

test("pacs.008 escapes free text and omits FX rate for same-currency payments", () => {
  const xml = buildPacs008({ ...base, recipientCurrency: "USD", recipientAmount: 100, fxRate: 1 });
  assert.match(xml, /Rent &lt;Oct&gt; &amp; utilities/);
  assert.doesNotMatch(xml, /<XchgRate>/);
  assert.doesNotMatch(xml, /<Oct>/);
});

test("pacs.002 reports acceptance and rejection with a reason", () => {
  assert.match(buildPacs002(base, "ACSC"), /<TxSts>ACSC<\/TxSts>/);
  const rjct = buildPacs002(base, "RJCT", "AM04");
  assert.match(rjct, /<TxSts>RJCT<\/TxSts>/);
  assert.match(rjct, /<Prtry>AM04<\/Prtry>/);
});

test("pacs.004 maps scheme reasons to ISO return codes and returns the credited amount", () => {
  const xml = buildPacs004(base, "RTN-1", "fraud", new Date("2026-10-07T00:00:00Z"));
  assert.match(xml, /<Cd>FRAD<\/Cd>/);
  assert.match(xml, /<RtrdIntrBkSttlmAmt Ccy="KES">12950\.50<\/RtrdIntrBkSttlmAmt>/);
  assert.match(xml, /<OrgnlEndToEndId>EIAPAYPAN20261006ABCDEFGHIJK<\/OrgnlEndToEndId>/);
});
