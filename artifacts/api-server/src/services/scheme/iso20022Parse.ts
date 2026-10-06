// Inbound ISO 20022 parsing for the participant gateway: pacs.008 (a participant
// asks the switch to credit a key) and pacs.002 (a participant's accept/reject reply).
// Participant XML is untrusted input: size-capped, DOCTYPE/entity declarations are
// rejected outright, and every field the switch relies on is validated.

import { XMLParser } from "fast-xml-parser";

export const MAX_MESSAGE_BYTES = 256 * 1024;

export class Iso20022ParseError extends Error {}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  removeNSPrefix: true,
  parseTagValue: false, // keep ids/amounts as strings; we validate numbers ourselves
  processEntities: false,
});

function load(xml: string): Record<string, unknown> {
  if (typeof xml !== "string" || !xml.trim()) throw new Iso20022ParseError("Empty message");
  if (Buffer.byteLength(xml, "utf8") > MAX_MESSAGE_BYTES) throw new Iso20022ParseError("Message too large");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Iso20022ParseError("DOCTYPE/ENTITY not allowed");
  try {
    return parser.parse(xml) as Record<string, unknown>;
  } catch {
    throw new Iso20022ParseError("Malformed XML");
  }
}

function dig(obj: unknown, ...path: string[]): unknown {
  let cur: unknown = obj;
  for (const key of path) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function str(obj: unknown, ...path: string[]): string | undefined {
  const v = dig(obj, ...path);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

function need(value: string | undefined, label: string): string {
  if (!value) throw new Iso20022ParseError(`Missing ${label}`);
  return value;
}

export interface ParsedPacs008 {
  msgId: string;
  instrId: string;
  endToEndId: string;
  amount: number;
  currency: string;
  debtorName: string;
  debtorAgentCode: string;
  creditorAgentCode: string;
  /** IAPAY key the payment is addressed to (CdtrAcct/Id/Othr/Id). */
  creditorAlias: string;
  remittance: string | null;
}

export function parsePacs008(xml: string): ParsedPacs008 {
  const doc = load(xml);
  const root = dig(doc, "Document", "FIToFICstmrCdtTrf");
  if (!root) throw new Iso20022ParseError("Not a pacs.008 message");
  const tx = dig(root, "CdtTrfTxInf");
  if (!tx || Array.isArray(tx)) throw new Iso20022ParseError("Exactly one CdtTrfTxInf is required");

  const amountNode = dig(tx, "IntrBkSttlmAmt");
  const amountText = typeof amountNode === "string" ? amountNode : str(amountNode, "#text");
  const currency = need(str(amountNode, "@_Ccy"), "settlement currency");
  if (!/^[A-Z]{3}$/.test(currency)) throw new Iso20022ParseError("Invalid currency");
  if (!amountText || !/^\d{1,16}(\.\d{1,5})?$/.test(amountText)) throw new Iso20022ParseError("Invalid amount");
  const amount = Number(amountText);
  if (!(amount > 0)) throw new Iso20022ParseError("Amount must be positive");

  return {
    msgId: need(str(root, "GrpHdr", "MsgId"), "MsgId"),
    instrId: need(str(tx, "PmtId", "InstrId"), "InstrId"),
    endToEndId: need(str(tx, "PmtId", "EndToEndId"), "EndToEndId"),
    amount,
    currency,
    // Free text from a participant is stored and shown downstream: cap its length.
    debtorName: (str(tx, "Dbtr", "Nm") ?? "Unknown").slice(0, 140),
    debtorAgentCode: need(str(tx, "DbtrAgt", "FinInstnId", "ClrSysMmbId", "MmbId"), "debtor agent"),
    creditorAgentCode: need(str(tx, "CdtrAgt", "FinInstnId", "ClrSysMmbId", "MmbId"), "creditor agent"),
    creditorAlias: need(str(tx, "CdtrAcct", "Id", "Othr", "Id"), "creditor key (CdtrAcct)"),
    remittance: str(tx, "RmtInf", "Ustrd")?.slice(0, 140) ?? null,
  };
}

export interface ParsedPacs002 {
  status: string; // ACSC | RJCT | PDNG | ...
  reason: string | null;
  originalEndToEndId: string;
}

export function parsePacs002(xml: string): ParsedPacs002 {
  const doc = load(xml);
  const root = dig(doc, "Document", "FIToFIPmtStsRpt");
  if (!root) throw new Iso20022ParseError("Not a pacs.002 message");
  const info = dig(root, "TxInfAndSts");
  if (!info || Array.isArray(info)) throw new Iso20022ParseError("Exactly one TxInfAndSts is required");
  return {
    status: need(str(info, "TxSts"), "TxSts"),
    reason: str(info, "StsRsnInf", "Rsn", "Prtry") ?? str(info, "StsRsnInf", "Rsn", "Cd") ?? null,
    originalEndToEndId: need(str(info, "OrgnlEndToEndId"), "OrgnlEndToEndId"),
  };
}
