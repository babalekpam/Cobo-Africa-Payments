import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';
globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);

// src/tests/iso20022.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";

// src/services/scheme/iso20022.ts
var SCHEME_CLEARING_SYSTEM = "IAPAY";
var NS = {
  pacs008: "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
  pacs002: "urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10",
  pacs004: "urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09"
};
function xmlEscape(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function amt(value) {
  return value.toFixed(2);
}
function isoDateTime(d) {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}
function text(value, max) {
  return xmlEscape(value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max));
}
function agent(tag, party) {
  return `<${tag}><FinInstnId><ClrSysMmbId><ClrSysId><Prtry>${SCHEME_CLEARING_SYSTEM}</Prtry></ClrSysId><MmbId>${xmlEscape(party.participantCode)}</MmbId></ClrSysMmbId><Nm>${text(party.agentName ?? party.name, 140)}</Nm><PstlAdr><Ctry>${xmlEscape(party.country)}</Ctry></PstlAdr></FinInstnId></${tag}>`;
}
function document(ns, root, body) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="${ns}"><${root}>${body}</${root}></Document>`;
}
function buildPacs008(t) {
  const msgId = `M${t.endToEndId}`.slice(0, 35);
  const grpHdr = `<GrpHdr><MsgId>${xmlEscape(msgId)}</MsgId><CreDtTm>${isoDateTime(t.clearedAt ?? t.initiatedAt)}</CreDtTm><NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd><ClrSys><Prtry>${SCHEME_CLEARING_SYSTEM}</Prtry></ClrSys></SttlmInf>${agent("InstgAgt", t.debtor)}${agent("InstdAgt", t.creditor)}</GrpHdr>`;
  const xchg = t.fxRate && t.fxRate !== 1 && t.recipientCurrency !== t.currency ? `<XchgRate>${t.fxRate}</XchgRate>` : "";
  const tx = `<CdtTrfTxInf><PmtId><InstrId>${xmlEscape(t.reference)}</InstrId><EndToEndId>${xmlEscape(t.endToEndId)}</EndToEndId><TxId>${xmlEscape(t.reference)}</TxId></PmtId><PmtTpInf><LclInstrm><Prtry>IAPAY-INSTANT</Prtry></LclInstrm></PmtTpInf><IntrBkSttlmAmt Ccy="${xmlEscape(t.recipientCurrency)}">${amt(t.recipientAmount)}</IntrBkSttlmAmt><InstdAmt Ccy="${xmlEscape(t.currency)}">${amt(t.amount)}</InstdAmt>${xchg}<ChrgBr>SLEV</ChrgBr><Dbtr><Nm>${text(t.debtor.name, 140)}</Nm></Dbtr>${agent("DbtrAgt", t.debtor)}${agent("CdtrAgt", t.creditor)}<Cdtr><Nm>${text(t.creditor.name, 140)}</Nm></Cdtr>` + (t.creditorAlias ? `<CdtrAcct><Id><Othr><Id>${text(t.creditorAlias, 140)}</Id><SchmeNm><Prtry>IAPAY-KEY</Prtry></SchmeNm></Othr></Id></CdtrAcct>` : "") + (t.description ? `<RmtInf><Ustrd>${text(t.description, 140)}</Ustrd></RmtInf>` : "") + `</CdtTrfTxInf>`;
  return document(NS.pacs008, "FIToFICstmrCdtTrf", grpHdr + tx);
}
function buildPacs002(t, status, rejectReason) {
  const hdr = `<GrpHdr><MsgId>${xmlEscape(`S${t.endToEndId}`.slice(0, 35))}</MsgId><CreDtTm>${isoDateTime(t.clearedAt ?? t.initiatedAt)}</CreDtTm></GrpHdr>`;
  const reason = status === "RJCT" ? `<StsRsnInf><Rsn><Prtry>${xmlEscape(rejectReason || "NARR")}</Prtry></Rsn></StsRsnInf>` : "";
  const info = `<TxInfAndSts><OrgnlInstrId>${xmlEscape(t.reference)}</OrgnlInstrId><OrgnlEndToEndId>${xmlEscape(t.endToEndId)}</OrgnlEndToEndId><TxSts>${status}</TxSts>${reason}</TxInfAndSts>`;
  return document(NS.pacs002, "FIToFIPmtStsRpt", hdr + info);
}
var RETURN_REASON_CODES = {
  voluntary: "CUST",
  // requested by customer
  fraud: "FRAD",
  error: "AM09",
  // wrong amount
  duplicate: "DUPL",
  other: "NARR"
};
function buildPacs004(original, returnReference, reason, returnedAt) {
  const hdr = `<GrpHdr><MsgId>${xmlEscape(`R${original.endToEndId}`.slice(0, 35))}</MsgId><CreDtTm>${isoDateTime(returnedAt)}</CreDtTm><NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd><ClrSys><Prtry>${SCHEME_CLEARING_SYSTEM}</Prtry></ClrSys></SttlmInf></GrpHdr>`;
  const tx = `<TxInf><RtrId>${xmlEscape(returnReference)}</RtrId><OrgnlInstrId>${xmlEscape(original.reference)}</OrgnlInstrId><OrgnlEndToEndId>${xmlEscape(original.endToEndId)}</OrgnlEndToEndId><RtrdIntrBkSttlmAmt Ccy="${xmlEscape(original.recipientCurrency)}">${amt(original.recipientAmount)}</RtrdIntrBkSttlmAmt><RtrRsnInf><Rsn><Cd>${RETURN_REASON_CODES[reason]}</Cd></Rsn></RtrRsnInf></TxInf>`;
  return document(NS.pacs004, "PmtRtr", hdr + tx);
}

// src/tests/iso20022.test.ts
var base = {
  reference: "IAP-ABC123",
  endToEndId: "EIAPAYPAN20261006ABCDEFGHIJK",
  amount: 100,
  currency: "USD",
  recipientAmount: 12950.5,
  recipientCurrency: "KES",
  fxRate: 129.505,
  initiatedAt: /* @__PURE__ */ new Date("2026-10-06T10:00:00.123Z"),
  clearedAt: /* @__PURE__ */ new Date("2026-10-06T10:00:00.456Z"),
  description: "Rent <Oct> & utilities",
  debtor: { name: "Ada Obi", participantCode: "GTBANKNGA", country: "NG" },
  creditor: { name: "Jomo K.", participantCode: "EQTYBKKEN", country: "KE" }
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
  const xml = buildPacs004(base, "RTN-1", "fraud", /* @__PURE__ */ new Date("2026-10-07T00:00:00Z"));
  assert.match(xml, /<Cd>FRAD<\/Cd>/);
  assert.match(xml, /<RtrdIntrBkSttlmAmt Ccy="KES">12950\.50<\/RtrdIntrBkSttlmAmt>/);
  assert.match(xml, /<OrgnlEndToEndId>EIAPAYPAN20261006ABCDEFGHIJK<\/OrgnlEndToEndId>/);
});
