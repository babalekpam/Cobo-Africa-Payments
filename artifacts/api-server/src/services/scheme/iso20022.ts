// ISO 20022 message layer for the IAPAY scheme. Banks and PSPs integrate with
// payment schemes (SEPA Instant, FedNow, Pix) through ISO 20022 messages, so the
// switch exposes every cleared transfer in the same vocabulary:
//   pacs.008 — FIToFICustomerCreditTransfer (the payment itself)
//   pacs.002 — FIToFIPaymentStatusReport    (accepted / rejected)
//   pacs.004 — PaymentReturn                (voluntary return / dispute refund)
// Pure functions only — no I/O — so they are unit-tested and reusable by a
// participant-side gateway. Outbound generation only; inbound parsing is not yet implemented.

export interface Iso20022Party {
  name: string;
  /** Scheme participant code, used as the clearing-system member id. */
  participantCode: string;
  country: string;
}

export interface Iso20022Transfer {
  reference: string;
  endToEndId: string;
  /** Amount debited at the sending institution. */
  amount: number;
  currency: string;
  /** Amount credited at the receiving institution (differs on cross-currency payments). */
  recipientAmount: number;
  recipientCurrency: string;
  fxRate: number | null;
  initiatedAt: Date;
  clearedAt: Date | null;
  description?: string | null;
  /** IAPAY key (phone/email/ID/…) the creditor is addressed by; emitted as CdtrAcct. */
  creditorAlias?: string | null;
  debtor: Iso20022Party;
  creditor: Iso20022Party;
}

export const SCHEME_CLEARING_SYSTEM = "IAPAY";

const NS = {
  pacs008: "urn:iso:std:iso:20022:tech:xsd:pacs.008.001.08",
  pacs002: "urn:iso:std:iso:20022:tech:xsd:pacs.002.001.10",
  pacs004: "urn:iso:std:iso:20022:tech:xsd:pacs.004.001.09",
} as const;

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ISO 20022 amounts allow up to 5 fraction digits; we emit 2 (scheme ledger scale).
function amt(value: number): string {
  return value.toFixed(2);
}

function isoDateTime(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Max140Text-style trimming so free text can't break a schema.
function text(value: string, max: number): string {
  return xmlEscape(value.replace(/[\r\n\t]+/g, " ").trim().slice(0, max));
}

function agent(tag: "DbtrAgt" | "CdtrAgt" | "InstgAgt" | "InstdAgt", party: Iso20022Party): string {
  return (
    `<${tag}><FinInstnId><ClrSysMmbId><ClrSysId><Prtry>${SCHEME_CLEARING_SYSTEM}</Prtry></ClrSysId>` +
    `<MmbId>${xmlEscape(party.participantCode)}</MmbId></ClrSysMmbId>` +
    `<Nm>${text(party.name, 140)}</Nm><PstlAdr><Ctry>${xmlEscape(party.country)}</Ctry></PstlAdr></FinInstnId></${tag}>`
  );
}

function document(ns: string, root: string, body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<Document xmlns="${ns}"><${root}>${body}</${root}></Document>`;
}

export function buildPacs008(t: Iso20022Transfer): string {
  const msgId = `M${t.endToEndId}`.slice(0, 35);
  const grpHdr =
    `<GrpHdr><MsgId>${xmlEscape(msgId)}</MsgId><CreDtTm>${isoDateTime(t.clearedAt ?? t.initiatedAt)}</CreDtTm>` +
    `<NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd><ClrSys><Prtry>${SCHEME_CLEARING_SYSTEM}</Prtry></ClrSys></SttlmInf>` +
    `${agent("InstgAgt", t.debtor)}${agent("InstdAgt", t.creditor)}</GrpHdr>`;

  const xchg =
    t.fxRate && t.fxRate !== 1 && t.recipientCurrency !== t.currency ? `<XchgRate>${t.fxRate}</XchgRate>` : "";

  const tx =
    `<CdtTrfTxInf><PmtId><InstrId>${xmlEscape(t.reference)}</InstrId><EndToEndId>${xmlEscape(t.endToEndId)}</EndToEndId>` +
    `<TxId>${xmlEscape(t.reference)}</TxId></PmtId>` +
    `<PmtTpInf><LclInstrm><Prtry>IAPAY-INSTANT</Prtry></LclInstrm></PmtTpInf>` +
    `<IntrBkSttlmAmt Ccy="${xmlEscape(t.recipientCurrency)}">${amt(t.recipientAmount)}</IntrBkSttlmAmt>` +
    `<InstdAmt Ccy="${xmlEscape(t.currency)}">${amt(t.amount)}</InstdAmt>${xchg}` +
    `<ChrgBr>SLEV</ChrgBr>` +
    `<Dbtr><Nm>${text(t.debtor.name, 140)}</Nm></Dbtr>${agent("DbtrAgt", t.debtor)}` +
    `${agent("CdtrAgt", t.creditor)}<Cdtr><Nm>${text(t.creditor.name, 140)}</Nm></Cdtr>` +
    (t.creditorAlias
      ? `<CdtrAcct><Id><Othr><Id>${text(t.creditorAlias, 140)}</Id><SchmeNm><Prtry>IAPAY-KEY</Prtry></SchmeNm></Othr></Id></CdtrAcct>`
      : "") +
    (t.description ? `<RmtInf><Ustrd>${text(t.description, 140)}</Ustrd></RmtInf>` : "") +
    `</CdtTrfTxInf>`;

  return document(NS.pacs008, "FIToFICstmrCdtTrf", grpHdr + tx);
}

export type Pacs002Status = "ACSC" | "RJCT"; // AcceptedSettlementCompleted | Rejected

export function buildPacs002(
  t: Pick<Iso20022Transfer, "reference" | "endToEndId" | "clearedAt" | "initiatedAt">,
  status: Pacs002Status,
  rejectReason?: string
): string {
  const hdr = `<GrpHdr><MsgId>${xmlEscape(`S${t.endToEndId}`.slice(0, 35))}</MsgId><CreDtTm>${isoDateTime(t.clearedAt ?? t.initiatedAt)}</CreDtTm></GrpHdr>`;
  const reason = status === "RJCT" ? `<StsRsnInf><Rsn><Prtry>${xmlEscape(rejectReason || "NARR")}</Prtry></Rsn></StsRsnInf>` : "";
  const info =
    `<TxInfAndSts><OrgnlInstrId>${xmlEscape(t.reference)}</OrgnlInstrId><OrgnlEndToEndId>${xmlEscape(t.endToEndId)}</OrgnlEndToEndId>` +
    `<TxSts>${status}</TxSts>${reason}</TxInfAndSts>`;
  return document(NS.pacs002, "FIToFIPmtStsRpt", hdr + info);
}

/** ISO 20022 external return reason codes the scheme maps its own reasons onto. */
export const RETURN_REASON_CODES = {
  voluntary: "CUST", // requested by customer
  fraud: "FRAD",
  error: "AM09", // wrong amount
  duplicate: "DUPL",
  other: "NARR",
} as const;

export function buildPacs004(
  original: Iso20022Transfer,
  returnReference: string,
  reason: keyof typeof RETURN_REASON_CODES,
  returnedAt: Date
): string {
  const hdr =
    `<GrpHdr><MsgId>${xmlEscape(`R${original.endToEndId}`.slice(0, 35))}</MsgId><CreDtTm>${isoDateTime(returnedAt)}</CreDtTm>` +
    `<NbOfTxs>1</NbOfTxs><SttlmInf><SttlmMtd>CLRG</SttlmMtd><ClrSys><Prtry>${SCHEME_CLEARING_SYSTEM}</Prtry></ClrSys></SttlmInf></GrpHdr>`;
  const tx =
    `<TxInf><RtrId>${xmlEscape(returnReference)}</RtrId><OrgnlInstrId>${xmlEscape(original.reference)}</OrgnlInstrId>` +
    `<OrgnlEndToEndId>${xmlEscape(original.endToEndId)}</OrgnlEndToEndId>` +
    `<RtrdIntrBkSttlmAmt Ccy="${xmlEscape(original.recipientCurrency)}">${amt(original.recipientAmount)}</RtrdIntrBkSttlmAmt>` +
    `<RtrRsnInf><Rsn><Cd>${RETURN_REASON_CODES[reason]}</Cd></Rsn></RtrRsnInf></TxInf>`;
  return document(NS.pacs004, "PmtRtr", hdr + tx);
}
